# Deployment Plan: Frontend (Firebase Hosting) + Gateway, Users, Document Reader (Cloud Run)

## Step-by-Step Deployment Guide

The steps below are split by where they run. Complete all GCP Console steps before pushing to prod.

### PART A — 🖥️ Your Local Machine

#### A1. Install required tools

```bash
# Google Cloud SDK
curl https://sdk.cloud.google.com | bash && exec -l $SHELL
gcloud components install beta

# Firebase CLI
npm install -g firebase-tools

# Verify
gcloud version && firebase --version
```

#### A2. Log in and set active project

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID

firebase login
firebase use --add YOUR_PROJECT_ID   # sets as default project
```

#### A3. Enable required Google Cloud APIs

Run once per project:

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  firebase.googleapis.com \
  firestore.googleapis.com \
  vision.googleapis.com \
  iam.googleapis.com
```

#### A4. Add Firebase Hosting to `firebase.json` if not already present

If the current `firebase.json` only configures emulators, add a hosting section pointing at the frontend build output:

```json
{
  "hosting": {
    "public": "apps/frontend/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "**", "destination": "/index.html" }
    ]
  },
  "emulators": { ... }
}
```

The rewrites rule is the Firebase Hosting equivalent of nginx's SPA fallback (`try_files $uri /index.html`).

#### A5. Verify the frontend builds successfully with production values

Before committing to the pipeline, do a local test build:

```bash
cd apps/frontend
VITE_GATEWAY_URL=https://gateway-api-xxxx-uc.a.run.app \
VITE_FIREBASE_API_KEY=AIza... \
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com \
FIREBASE_PROJECT_ID=your-project-id \
VITE_FEATURE_DOCUMENT_READ=true \
VITE_FEATURE_USER_MANAGEMENT=true \
npm run build
# Check apps/frontend/dist/index.html exists
```

#### A6. Set GitHub repository secrets

Go to GitHub → repo → Settings → Secrets and variables → Actions and add:

| Secret name | Value | Notes |
| :--- | :--- | :--- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/123.../providers/github` | Created in Part B step B4 |
| `GCP_SERVICE_ACCOUNT` | `deployer@your-project.iam.gserviceaccount.com` | Created in Part B step B2 |
| `GCP_PROJECT_ID` | `your-gcp-project-id` | |
| `GCP_DEPLOY_REGION` | `us-central1` | or your preferred region |
| `GCP_IMAGE_REGISTRY` | `gcr.io` | or `us-docker.pkg.dev` if using Artifact Registry |

---

### PART B — ☁️ Google Cloud Console (or gcloud CLI)

#### B1. Create a dedicated Cloud Build / deploy service account

```bash
gcloud iam service-accounts create deployer \
  --display-name="Cloud Build Deployer" \
  --project YOUR_PROJECT_ID
```

Grant it the roles Cloud Build needs:

```bash
PROJECT=YOUR_PROJECT_ID
SA=deployer@${PROJECT}.iam.gserviceaccount.com

# Deploy to Cloud Run
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/run.admin"

# Push images to Container Registry / GCR
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/storage.admin"

# Act as the Cloud Run runtime service account
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser"

# Deploy to Firebase Hosting
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/firebasehosting.admin"

# Read secrets (if using Secret Manager for env vars)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
```

#### B2. Create a dedicated Cloud Run runtime service account

This is the identity each Cloud Run service runs as — separate from the deployer SA:

```bash
gcloud iam service-accounts create cloud-run-runtime \
  --display-name="Cloud Run Runtime SA" \
  --project YOUR_PROJECT_ID

SA_RUNTIME=cloud-run-runtime@${PROJECT}.iam.gserviceaccount.com

# Firestore access
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_RUNTIME" --role="roles/datastore.user"

# Cloud Vision API (document-reader)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_RUNTIME" --role="roles/visionai.viewer"

# Pub/Sub (gateway, users)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_RUNTIME" --role="roles/pubsub.publisher"

# Secret Manager (if secrets are mounted at runtime)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_RUNTIME" --role="roles/secretmanager.secretAccessor"
```

#### B3. Store sensitive configuration in Secret Manager (no `config.yaml` in prod)

Never pass sensitive values as plain `--set-env-vars`; use Secret Manager:

```bash
# gateway-api: Firebase project ID (non-sensitive, can be plain env var)
# gateway-api: downstream service URLs (set after Cloud Run services are deployed)

# users-api secrets
echo -n "bootstrap-admin@yourdomain.com" | \
  gcloud secrets create BOOTSTRAP_ADMIN_USER_EMAIL --data-file=- --project $PROJECT

echo -n "yourdomain.com" | \
  gcloud secrets create ONBOARDABLE_EMAIL_DOMAINS --data-file=- --project $PROJECT

# document-reader: GCP_PROJECT_ID (non-sensitive, plain env var is fine)
```

> **Rule of thumb**: Anything in `.env.example` that is an email, key, or credential → Secret Manager. Project IDs, ports, feature flags → plain `--set-env-vars`.

#### B4. Set up Workload Identity Federation for GitHub Actions

This allows GitHub Actions to authenticate to GCP without a long-lived service account key:

```bash
# Create the pool
gcloud iam workload-identity-pools create "github-pool" \
  --project=$PROJECT \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create the provider
gcloud iam workload-identity-pools providers create-oidc "github-provider" \
  --project=$PROJECT \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Allow impersonation from YOUR repo
REPO="RichardRosenblat/elastic-resume-base"
POOL_ID=$(gcloud iam workload-identity-pools describe github-pool \
  --project=$PROJECT --location=global --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding \
  deployer@${PROJECT}.iam.gserviceaccount.com \
  --project=$PROJECT \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${REPO}"

# Get the provider resource name to paste into GitHub secrets
gcloud iam workload-identity-pools providers describe github-provider \
  --project=$PROJECT \
  --location=global \
  --workload-identity-pool=github-pool \
  --format="value(name)"
# → paste this into GitHub secret GCP_WORKLOAD_IDENTITY_PROVIDER
```

#### B5. Set up Firebase Hosting in the Firebase Console

1.  Go to Firebase Console → your project → Hosting
2.  Click **Get started** and follow the wizard (choose "Set up Firebase Hosting")
3.  When prompted to deploy, skip — Cloud Build will deploy
4.  Optionally add a custom domain under **Hosting** → **Add custom domain**

#### B6. Configure Firebase Authentication

1.  Go to Firebase Console → Authentication → Sign-in method
2.  Enable Google sign-in (and any other providers your app uses)
3.  Add the Cloud Run gateway URL and Firebase Hosting URL to **Authorized domains**:
    *   `your-project.firebaseapp.com` (already added)
    *   `your-project.web.app` (already added)
    *   Your custom domain if you have one

---

### PART C — 🚀 First Deployment Sequence

Because the Cloud Run service URLs are not known until after first deploy (they contain a random hash), follow this order:

1.  Deploy `document-reader` and `users-api` first — push to prod with gateway's downstream URL env vars pointing at placeholder values (or the known URL pattern if you set a custom domain/Cloud Run service name with `--no-traffic`)
2.  Note the assigned URLs from the Cloud Run console
3.  Update `gateway-api`'s `--set-env-vars` in `cloudbuild.yaml` with the real `DOCUMENT_READER_SERVICE_URL` and `USER_API_SERVICE_URL` values
4.  Re-push to prod — now the full pipeline runs and gateway deploys with correct downstream URLs
5.  Update Firebase Hosting authorized domains in Firebase Console with the gateway Cloud Run URL
6.  Update `VITE_GATEWAY_URL` in the `build-frontend` step with the gateway Cloud Run URL and push again

> **Tip**: Assign a Cloud Run custom domain or use a fixed service name with `--tag` to get stable URLs and avoid the circular URL dependency above.

---

### PART D — ✅ Post-Deployment Checklist

**In GCP Console / Cloud Run:**

*   Confirm all 3 services show Revision deployed — serving 100% traffic
*   Check logs: Cloud Run → service → Logs — no startup errors
*   Verify health endpoints respond: `GET /health/live` on each service
*   Confirm `document-reader` can call Vision API (check IAM binding for `cloud-run-runtime` SA)

**In Firebase Console:**

*   Hosting shows a green deploy with the correct URL
*   Open the URL in a browser — React app loads, no console auth errors
*   Sign in with a Google account — Firebase Auth works
*   Confirm the gateway URL in the browser's network tab matches production

**Security checks:**

*   Confirm no `config.yaml` or `.env` files were committed (`git log --all -- config.yaml`)
*   `GOOGLE_SERVICE_ACCOUNT_KEY` is NOT set in any Cloud Run env var
*   All sensitive values (API keys, tokens) live in Secret Manager, not in `--set-env-vars`
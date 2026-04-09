# Deployment Plan: Frontend (Firebase Hosting) + All Cloud Run Services

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
  iam.googleapis.com \
  pubsub.googleapis.com \
  aiplatform.googleapis.com \
  translate.googleapis.com \
  cloudkms.googleapis.com
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

# Act as every Cloud Run runtime service account (needed for --service-account flag)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/iam.serviceAccountUser"

# Deploy to Firebase Hosting
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/firebasehosting.admin"

# Read secrets (if using Secret Manager for env vars)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
```

#### B2. Create per-service Cloud Run runtime service accounts

Each Cloud Run service runs under its own dedicated identity following the
least-privilege principle.  Create one service account per service, then grant
only the roles that service needs.

```bash
PROJECT=YOUR_PROJECT_ID

# Helper — create SA and print its email
create_sa() {
  local NAME=$1 DISPLAY=$2
  gcloud iam service-accounts create "$NAME" \
    --display-name="$DISPLAY" \
    --project "$PROJECT"
  echo "${NAME}@${PROJECT}.iam.gserviceaccount.com"
}

create_sa svc-gateway       "Gateway API Runtime"
create_sa svc-document-reader "Document Reader Runtime"
create_sa svc-users-api     "Users API Runtime"
create_sa svc-ingestor-api  "Ingestor API Runtime"
create_sa svc-ai-worker     "AI Worker Runtime"
create_sa svc-search-base   "Search Base Runtime"
create_sa svc-file-generator "File Generator Runtime"
create_sa svc-dlq-notifier  "DLQ Notifier Runtime"
```

Grant each SA only the permissions its service requires:

```bash
# ── gateway-api ──────────────────────────────────────────────────────────────
SA_GW="svc-gateway@${PROJECT}.iam.gserviceaccount.com"
# Firestore (Firebase Admin SDK for token verification)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_GW" --role="roles/datastore.user"
# Pub/Sub (publish ingest events)
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_GW" --role="roles/pubsub.publisher"

# ── document-reader ───────────────────────────────────────────────────────────
SA_DR="svc-document-reader@${PROJECT}.iam.gserviceaccount.com"
# Cloud Vision OCR
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_DR" --role="roles/visionai.viewer"

# ── users-api ─────────────────────────────────────────────────────────────────
SA_UA="svc-users-api@${PROJECT}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_UA" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_UA" --role="roles/secretmanager.secretAccessor"

# ── ingestor-api ──────────────────────────────────────────────────────────────
SA_IN="svc-ingestor-api@${PROJECT}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_IN" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_IN" --role="roles/pubsub.publisher"

# ── ai-worker ─────────────────────────────────────────────────────────────────
SA_AW="svc-ai-worker@${PROJECT}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_AW" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_AW" --role="roles/pubsub.publisher"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_AW" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_AW" --role="roles/cloudkms.cryptoKeyEncrypterDecrypter"

# ── search-base ───────────────────────────────────────────────────────────────
SA_SB="svc-search-base@${PROJECT}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_SB" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_SB" --role="roles/pubsub.subscriber"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_SB" --role="roles/aiplatform.user"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_SB" --role="roles/cloudkms.cryptoKeyDecrypter"

# ── file-generator ────────────────────────────────────────────────────────────
SA_FG="svc-file-generator@${PROJECT}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_FG" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_FG" --role="roles/cloudtranslate.user"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_FG" --role="roles/cloudkms.cryptoKeyDecrypter"

# ── dlq-notifier ──────────────────────────────────────────────────────────────
SA_DQ="svc-dlq-notifier@${PROJECT}.iam.gserviceaccount.com"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_DQ" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_DQ" --role="roles/pubsub.subscriber"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$SA_DQ" --role="roles/secretmanager.secretAccessor"
```

#### B3. Grant the gateway service account permission to invoke backend services

The gateway SA (`svc-gateway`) is the only identity that may call the private
backend Cloud Run services.  Run these bindings **after** the services have been
deployed at least once (the service resource must exist for the binding to apply):

```bash
PROJECT=YOUR_PROJECT_ID
SA_GW="svc-gateway@${PROJECT}.iam.gserviceaccount.com"
REGION=us-central1   # adjust if different

for SERVICE in document-reader users-api ingestor-api search-base file-generator dlq-notifier; do
  gcloud run services add-iam-policy-binding "$SERVICE" \
    --region="$REGION" \
    --member="serviceAccount:$SA_GW" \
    --role="roles/run.invoker"
done
```

#### B4. Grant the Pub/Sub service agent permission to invoke push-target services

Cloud Pub/Sub uses its own service agent to authenticate push delivery to Cloud
Run endpoints.  Grant it `roles/run.invoker` on every service that receives
Pub/Sub push messages (`ai-worker`, `search-base`, `dlq-notifier`):

```bash
PROJECT=YOUR_PROJECT_ID
REGION=us-central1   # adjust if different

# Look up the project number (needed for the Pub/Sub service agent email)
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")
SA_PUBSUB="service-${PROJECT_NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"

for SERVICE in ai-worker search-base dlq-notifier; do
  gcloud run services add-iam-policy-binding "$SERVICE" \
    --region="$REGION" \
    --member="serviceAccount:$SA_PUBSUB" \
    --role="roles/run.invoker"
done
```

#### B5. Store sensitive configuration in Secret Manager (no `config.yaml` in prod)

Never pass sensitive values as plain `--set-env-vars`; use Secret Manager:

```bash
# users-api secrets
echo -n "bootstrap-admin@yourdomain.com" | \
  gcloud secrets create BOOTSTRAP_ADMIN_USER_EMAIL --data-file=- --project $PROJECT

echo -n "yourdomain.com" | \
  gcloud secrets create ONBOARDABLE_EMAIL_DOMAINS --data-file=- --project $PROJECT

# dlq-notifier SMTP secrets
echo -n "smtp.example.com" | gcloud secrets create SMTP_HOST --data-file=- --project $PROJECT
echo -n "587"              | gcloud secrets create SMTP_PORT --data-file=- --project $PROJECT
echo -n "user@example.com" | gcloud secrets create SMTP_USER --data-file=- --project $PROJECT
echo -n "s3cr3t"           | gcloud secrets create SMTP_PASSWORD --data-file=- --project $PROJECT
echo -n "noreply@example.com" | gcloud secrets create SMTP_FROM --data-file=- --project $PROJECT
echo -n "ops@example.com"  | gcloud secrets create NOTIFICATION_RECIPIENTS --data-file=- --project $PROJECT
```

> **Rule of thumb**: Anything in `.env.example` that is an email, key, or credential → Secret Manager. Project IDs, ports, feature flags → plain `--set-env-vars`.

#### B6. Set up Workload Identity Federation for GitHub Actions

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

#### B7. Set up Firebase Hosting in the Firebase Console

1.  Go to Firebase Console → your project → Hosting
2.  Click **Get started** and follow the wizard (choose "Set up Firebase Hosting")
3.  When prompted to deploy, skip — Cloud Build will deploy
4.  Optionally add a custom domain under **Hosting** → **Add custom domain**

#### B8. Configure Firebase Authentication

1.  Go to Firebase Console → Authentication → Sign-in method
2.  Enable Google sign-in (and any other providers your app uses)
3.  Add the Cloud Run gateway URL and Firebase Hosting URL to **Authorized domains**:
    *   `your-project.firebaseapp.com` (already added)
    *   `your-project.web.app` (already added)
    *   Your custom domain if you have one

---

### PART C — 🚀 First Deployment Sequence

Because the Cloud Run service URLs are not known until after first deploy (they contain a random hash), follow this order:

1.  Deploy all backend services first (`document-reader`, `users-api`, `ingestor-api`, `ai-worker`, `search-base`, `file-generator`, `dlq-notifier`) — push to prod with the gateway's downstream URL env vars pointing at placeholder values (or the known URL pattern if you set a custom domain)
2.  Note the assigned URLs from the Cloud Run console for each service
3.  Update `gateway-api`'s `--set-env-vars` in `cloudbuild.yaml` with the real URLs for all downstream services:
    -   `DOCUMENT_READER_SERVICE_URL`
    -   `USER_API_SERVICE_URL`
    -   `INGESTOR_SERVICE_URL`
    -   `SEARCH_BASE_SERVICE_URL`
    -   `FILE_GENERATOR_SERVICE_URL`
    -   `DLQ_NOTIFIER_SERVICE_URL`
4.  Run the gateway invoker grants from B3 now that all services exist
5.  Run the Pub/Sub service agent grants from B4
6.  Re-push to prod — now the full pipeline runs and gateway deploys with correct downstream URLs
7.  Update Firebase Hosting authorized domains in Firebase Console with the gateway Cloud Run URL
8.  Update `VITE_GATEWAY_URL` in the `build-frontend` step with the gateway Cloud Run URL and push again

> **Tip**: Assign Cloud Run custom domains or use fixed service names with `--tag` to get stable URLs and avoid the circular URL dependency above.

---

### PART D — ✅ Post-Deployment Checklist

**In GCP Console / Cloud Run:**

*   Confirm all services show Revision deployed — serving 100% traffic
*   Check logs: Cloud Run → service → Logs — no startup errors
*   Verify health endpoints respond: `GET /health/live` on each service
*   Confirm `document-reader` can call Vision API (check IAM binding for `svc-document-reader` SA)
*   Confirm only `gateway-api` has **Allow unauthenticated invocations** enabled; all other services show **Require authentication**
*   Confirm `svc-gateway` has `roles/run.invoker` on every private backend service
*   Confirm the Pub/Sub service agent has `roles/run.invoker` on `ai-worker`, `search-base`, and `dlq-notifier`

**In Firebase Console:**

*   Hosting shows a green deploy with the correct URL
*   Open the URL in a browser — React app loads, no console auth errors
*   Sign in with a Google account — Firebase Auth works
*   Confirm the gateway URL in the browser's network tab matches production

**Security checks:**

*   Confirm no `config.yaml` or `.env` files were committed (`git log --all -- config.yaml`)
*   `GOOGLE_SERVICE_ACCOUNT_KEY` is NOT set in any Cloud Run env var
*   All sensitive values (API keys, tokens, SMTP credentials) live in Secret Manager, not in `--set-env-vars`
*   Verify each Cloud Run service runs under its own dedicated SA (`svc-<service>@PROJECT...`) — no service uses the legacy `cloud-run-runtime` SA
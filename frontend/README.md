# Frontend SPA

React + TypeScript single-page application (SPA) for [Elastic Resume Base](../README.md). Provides the user interface for authentication, user management, resume ingestion, search, and resume generation.

## Overview

- **Framework:** React 19 + TypeScript + Vite
- **UI library:** Material UI (MUI) v7
- **Authentication:** Firebase Auth (email/password + Google SSO via `firebase/auth`)
- **HTTP client:** Axios with automatic Bearer-token injection
- **Routing:** React Router v7
- **Internationalisation (i18n):** i18next with locale files for English (`en`), Portuguese (`pt-BR`), and Spanish (`es`)
- **Testing:** Vitest + React Testing Library

All API calls go through the BFF Gateway (`VITE_BFF_URL`). The frontend never communicates directly with the Users API or any other microservice.

---

## Project Structure

```
frontend/
├── public/                  # Static assets served at the root path
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/              # Imported assets (images used inside components)
│   ├── components/          # Shared UI components
│   │   ├── ErrorMessage.tsx       # Dismissible MUI Alert for error states
│   │   ├── LoadingSpinner.tsx     # Centred progress indicator
│   │   ├── ProtectedRoute.tsx     # Auth + RBAC guard for React Router
│   │   └── Layout/
│   │       ├── AppLayout.tsx      # Responsive drawer + topbar shell
│   │       ├── Sidebar.tsx        # Navigation drawer
│   │       └── Topbar.tsx         # App bar with language switcher & user menu
│   ├── contexts/
│   │   └── AuthContext.tsx        # Firebase Auth state + BFF profile context
│   ├── hooks/
│   │   └── useFeatureFlags.ts     # Returns feature-flag config from VITE_ env vars
│   ├── i18n/
│   │   ├── index.ts               # i18next initialisation
│   │   └── locales/
│   │       ├── en.json            # English strings
│   │       ├── pt-BR.json         # Portuguese (Brazil) strings
│   │       └── es.json            # Spanish strings
│   ├── pages/
│   │   ├── Account/               # User account settings (email, language)
│   │   ├── Dashboard/             # Welcome screen with profile summary
│   │   ├── Login/                 # Email/password + Google sign-in
│   │   ├── NotFound/              # 404 page
│   │   ├── PendingApproval/       # Shown when user.enable = false
│   │   ├── Resumes/               # Resume ingest & generation (feature-flagged)
│   │   ├── Search/                # Semantic search (feature-flagged)
│   │   └── Users/                 # Admin-only user management
│   ├── services/
│   │   └── api.ts                 # Axios client + all BFF API call functions
│   ├── test/
│   │   └── setup.ts               # Vitest / @testing-library/jest-dom setup
│   ├── theme/
│   │   └── index.ts               # MUI theme derived from VITE_ colour env vars
│   ├── types/
│   │   └── index.ts               # Shared TypeScript interfaces
│   ├── App.tsx                    # Root component with routing tree
│   ├── config.ts                  # Runtime config read from VITE_ env vars
│   ├── firebase.ts                # Firebase app + Auth initialisation
│   ├── index.css                  # Global CSS resets
│   └── main.tsx                   # React entry point (createRoot)
├── .dockerignore
├── .env.example                   # Env var template (copy to .env.local)
├── .gitignore
├── Dockerfile
├── eslint.config.js
├── index.html
├── nginx.conf                     # Nginx config for the production Docker image
├── package.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts                 # Vite + Vitest configuration
```

---

## Environment Variables

Copy `.env.example` to `.env.local` (local dev) or supply the variables through your deployment platform. All variables are prefixed `VITE_` so that Vite injects them into the client bundle at build time.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_APP_NAME` | No | `Elastic Resume Base` | Application title shown in the UI |
| `VITE_BFF_URL` | Yes | `http://localhost:3000` | Base URL of the BFF Gateway |
| `VITE_PRIMARY_COLOR` | No | `#1976d2` | MUI primary colour (hex) |
| `VITE_SECONDARY_COLOR` | No | `#9c27b0` | MUI secondary colour (hex) |
| `VITE_LOGO_URL` | No | *(none)* | URL for the brand logo rendered in the sidebar |
| `VITE_FIREBASE_API_KEY` | Yes | — | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | — | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Yes | `demo-elastic-resume-base` | Firebase project ID |
| `VITE_FEATURE_RESUME_INGEST` | No | `false` | Enable resume ingest UI |
| `VITE_FEATURE_RESUME_SEARCH` | No | `false` | Enable semantic search UI |
| `VITE_FEATURE_DOCUMENT_READ` | No | `false` | Enable document reader UI |
| `VITE_FEATURE_RESUME_GENERATE` | No | `false` | Enable resume generation UI |
| `VITE_FEATURE_USER_MANAGEMENT` | No | `true` | Enable user management UI (admin only) |

> Features that are disabled are still rendered in the navigation but their interactive controls are shown as disabled/coming-soon rather than hidden, to make rollout communication easier.

---

## Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- A running BFF Gateway (see [`../bff-gateway/README.md`](../bff-gateway/README.md)) **or** the full Docker Compose stack
- Firebase project credentials (or the local Firebase Emulator)

### Steps

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Create your local env file
cp .env.example .env.local
# Edit .env.local and fill in VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, etc.

# 3. Start the dev server
npm run dev
```

The app will be available at **http://localhost:5173** with hot-module replacement.

### Running with the Full Docker Compose Stack

```bash
# From the repository root
docker-compose up
```

The frontend service is mapped to **http://localhost:5174** when started via Docker Compose.

---

## Building for Production

```bash
npm run build
```

The output is written to `dist/`. The `Dockerfile` uses Nginx to serve these static files in production.

---

## Running Tests

```bash
# Run all tests once (CI mode)
npm test

# Watch mode (interactive)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

Tests use **Vitest** with **React Testing Library** and **jsdom**. All Firebase and BFF API calls are mocked in test files so no running backend is required.

---

## Running Lint

```bash
npm run lint
```

The project uses ESLint with the recommended TypeScript + React rules.

---

## Feature Flags

Feature availability is controlled at runtime through `VITE_FEATURE_*` environment variables (which are sourced from `config.yaml` via the build pipeline). The `useFeatureFlags` hook returns the current flag set; pages and components use this to conditionally enable controls.

When a feature flag is `false`:
- Its UI section is still rendered.
- Interactive controls (buttons, inputs) are `disabled`.
- A "coming soon" label is shown instead of the actual content.

This approach makes it straightforward to enable features for specific deployments without code changes.

---

## Internationalisation (i18n)

The application supports three locales out of the box:

| Code | Language |
|---|---|
| `en` | English |
| `pt-BR` | Portuguese (Brazil) |
| `es` | Spanish |

Translation strings live in `src/i18n/locales/<locale>.json`. The language switcher in the top bar cycles through all available locales. The user's preferred language can also be saved from the Account page.

To add a new locale:

1. Create `src/i18n/locales/<new-code>.json` with all keys from `en.json`.
2. Register it in `src/i18n/index.ts`.
3. Add a `<MenuItem>` for it in the `LANGUAGES` array in `src/components/Layout/Topbar.tsx`.

---

## Authentication Flow

1. The user signs in via email/password or Google OAuth (Firebase Auth).
2. On `onAuthStateChanged`, the app fetches `GET /api/v1/me` from the BFF Gateway, passing the Firebase ID token as a Bearer token.
3. The BFF verifies the token, resolves the user's `role` and `enable` status from the Users API, and returns the user profile.
4. If `enable = false`, the user is shown the Pending Approval screen and cannot access any protected pages.
5. Admin-only pages (e.g., `/users`) are guarded by `<ProtectedRoute adminOnly />` which checks `userProfile.role === 'admin'`.

---

## Docker

```bash
# Build the production image
docker build -t elastic-resume-frontend .

# Run the container
docker run -p 80:80 elastic-resume-frontend
```

The image uses a multi-stage build: the first stage builds the Vite bundle; the second stage copies `dist/` into a minimal Nginx image.


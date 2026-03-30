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
│   │   ├── ThemeProvider.tsx      # React context + MUI bridge (AppThemeProvider, useAppTheme)
│   │   ├── index.ts               # Public re-exports for the theme system
│   │   ├── loadTheme.ts           # Loads template theme.json and optional local override
│   │   ├── toCssVariables.ts      # Converts AppTheme → CSS custom properties
│   │   ├── types.ts               # TypeScript interfaces (AppTheme, Palette, Branding…)
│   │   ├── theme.json             # Template + preset examples (committed)
│   │   └── theme.local.json       # Local active theme override (git-ignored)
│   ├── types/
│   │   └── index.ts               # Shared TypeScript interfaces
│   ├── App.tsx                    # Root component with routing tree
│   ├── config.ts                  # Runtime config read from VITE_ env vars
│   ├── firebase.ts                # Firebase app + Auth initialisation
│   ├── index.css                  # Global CSS resets
│   └── main.tsx                   # React entry point (createRoot)
├── .dockerignore
├── .gitignore
├── Dockerfile
├── eslint.config.js
├── index.html
├── nginx.conf                     # Nginx config for the production Docker image
├── package.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts                 # Vite + Vitest configuration (loads config.yaml via Toolbox)
```

---

## Environment Variables

All runtime variables are loaded from the monorepo-wide `config.yaml` through the shared Toolbox `loadConfigYaml` utility. The frontend consumes the resulting `VITE_*` values (see [Local Development Setup](#local-development-setup)).

For Docker / CI builds, pass these as `--build-arg` flags or inject them via your deployment platform — they are declared as `ARG`/`ENV` in the `Dockerfile`.

> **Separation of concerns**
> - **Operational / infrastructure config** (URLs, API keys, feature flags, support email) → `config.yaml` / `VITE_*` env vars
> - **Appearance** (colours, fonts, branding, dark-mode default) → `src/theme/theme.json`
>
> Never put appearance settings in `config.yaml`, and never put operational settings in `theme.json`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_BFF_URL` | Yes | `http://localhost:3000` | Base URL of the BFF Gateway |
| `VITE_SUPPORT_EMAIL` | No | *(empty)* | Support contact email shown in the page footer — leave empty to hide the footer |
| `VITE_FIREBASE_API_KEY` | Yes | — | Firebase project API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Yes | — | Firebase Auth domain |
| `FIREBASE_PROJECT_ID` | Yes | `demo-elastic-resume-base` | Shared Firebase project ID; mapped to frontend `VITE_FIREBASE_PROJECT_ID` by Vite config |
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
# 1. Copy the monorepo config template (only needed once per clone)
cp config_example.yaml config.yaml          # from the repo root
# Edit config.yaml — fill in VITE_FIREBASE_API_KEY and VITE_FIREBASE_AUTH_DOMAIN
# under systems.frontend. Keep FIREBASE_PROJECT_ID in systems.shared.

# 2. Install frontend dependencies
cd frontend
npm install

# 3. Start the dev server
npm run dev
```

The Vite dev server loads `../config.yaml` automatically via the Toolbox loader in `vite.config.ts`. If you prefer to override individual values, you can still set shell variables before running `npm run dev`.

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

## Theme System

Theme configuration supports a two-file strategy:
- `src/theme/theme.json` is a committed template that includes two ready presets (`Corporate Blue` and `Warm Neutral`).
- `src/theme/theme.local.json` is the active local override (git-ignored) loaded automatically when present.

Branding now supports dual identity in the topbar:
- `branding.logoUrl`: core app logo/favicon.
- `branding.companyLogo`: partner/customer logo rendered next to the app identity.

```jsonc
// src/theme/theme.local.json (excerpt)
{
  "mode": "dark",
  "branding": {
    "appName": "Elastic Resume Base",
    "companyName": "My Company",
    "logoUrl": "/assets/app-logo.svg",
    "companyLogo": "/assets/company-logo.svg"
  }
}
```

### Dark / Light Mode

The top bar includes a mode toggle button. The user's choice is persisted in `localStorage` under the key `appThemeMode` and takes precedence over the loaded theme file's `mode` field on subsequent visits.

### Using the Theme in Components

```tsx
import { useAppTheme } from './theme';

function MyComponent() {
  const { theme, mode, toggleTheme } = useAppTheme();

  return (
    <div>
      <p>Company: {theme.branding.companyName}</p>
      <p>Current mode: {mode}</p>
      <button onClick={toggleTheme}>Toggle dark/light</button>
    </div>
  );
}
```

### CSS Variables

The theme is also injected as CSS custom properties into `<html>` so that plain CSS can reference them:

```css
.my-element {
  color: var(--color-primary-main);
  background: var(--color-background-default);
  font-family: var(--font-family);
}
```

### Alert Colours

Alert components (`success`, `warning`, `error`, `info`) can be individually styled via the `palette.alerts` section.  Two variants are supported:

- **standard** — used for inline alerts (e.g. `ErrorMessage`, form feedback).  Configure `bg` (background) and `color` (text + icon).
- **filled** — used for toast notifications.  Configure `filledBg` (background) and `filledColor` (text).

A `default` tone is also available for neutral/unstyled alerts.

```jsonc
// src/theme/theme.local.json (excerpt)
{
  "palette": {
    "alerts": {
      "success": {
        "bg": "#EDF7ED",
        "color": "#1D5E28",
        "filledBg": "#198754",
        "filledColor": "#FFFFFF"
      },
      "error": {
        "bg": "#FDEDED",
        "color": "#8B1A1A",
        "filledBg": "#C53030",
        "filledColor": "#FFFFFF"
      },
      "warning": {
        "bg": "#FFF8E1",
        "color": "#7A5310",
        "filledBg": "#B7791F",
        "filledColor": "#FFFFFF"
      },
      "info": {
        "bg": "#E8F4FD",
        "color": "#1A4B8C",
        "filledBg": "#2563EB",
        "filledColor": "#FFFFFF"
      },
      "default": {
        "bg": "#F3F7FC",
        "color": "#3E5166",
        "filledBg": "#3E5166",
        "filledColor": "#FFFFFF"
      }
    }
  }
}
```

When any tone property is omitted, MUI derives the colour automatically from the corresponding semantic palette role (`palette.success`, `palette.error`, etc.).

Alert colours are also exposed as CSS custom properties:
- `--color-alert-<severity>-bg`
- `--color-alert-<severity>-color`
- `--color-alert-<severity>-filled-bg`
- `--color-alert-<severity>-filled-color`

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
2. On `onAuthStateChanged`, the app fetches `GET /api/v1/users/me` from the BFF Gateway, passing the Firebase ID token as a Bearer token.
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


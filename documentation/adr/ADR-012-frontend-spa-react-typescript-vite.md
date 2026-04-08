# ADR-012: Use React + TypeScript + Vite for the Frontend SPA

**Date:** 2024-01-15
**Status:** Accepted

---

## Context

The platform requires a rich browser-based interface for user management, resume ingestion, semantic search, and document processing. The frontend must:

- Integrate with Firebase Auth for Google SSO and email/password login
- Communicate exclusively with the Gateway API (no direct microservice calls)
- Support multi-language content (English, Portuguese, Spanish)
- Be deployable to Firebase Hosting (static hosting, no SSR required)
- Enforce role-based access control (admin vs. user views) at the routing level

The project is already deeply embedded in the GCP/Firebase ecosystem and the team has strong TypeScript experience. A type-safe, component-based SPA is the natural fit.

---

## Decision

Use **React 19** as the UI library, **TypeScript** for static typing, and **Vite** as the build tool and dev server. The UI component library is **Material UI (MUI) v7**. Routing is handled by **React Router v7**, and internationalisation by **i18next**. Feature flags are exposed via `VITE_FEATURE_*` environment variables baked in at build time.

The application is deployed as a static bundle to **Firebase Hosting**.

---

## Alternatives Considered

| Option | Reason Not Chosen |
|--------|------------------|
| **Next.js** | SSR/SSG adds complexity for what is a fully authenticated admin SPA; Firebase Hosting static deployment is simpler and sufficient |
| **Vue.js** | Smaller ecosystem for enterprise component libraries; less TypeScript-first tooling compared to React |
| **Angular** | Heavier opinionated framework; longer onboarding curve; overkill for a single-product SPA |
| **Svelte/SvelteKit** | Smaller community; fewer Firebase Auth integration examples; SSR story adds unnecessary complexity |

---

## Consequences

- **Easier:** Tree-shaking via Vite produces small production bundles; HMR in development is near-instant; Firebase Hosting deployment is a single `firebase deploy --only hosting` command.
- **Harder:** No server-side rendering means all auth state is client-side; SEO is not a concern (authenticated tool), so this is acceptable.
- **Follow-on decisions required:** Auth client abstraction (→ ADR-013), feature flag strategy via `VITE_FEATURE_*` variables.

# Frontend Coding Standards

This document defines the coding standards and best practices for the React + TypeScript frontend SPA (`frontend/`) in the Elastic Resume Base project. All contributors must follow these guidelines to ensure consistency, maintainability, and accessibility across the codebase.

---

## Table of Contents

- [Language and Runtime](#language-and-runtime)
- [Style Guide](#style-guide)
- [Project Structure](#project-structure)
- [Naming Conventions](#naming-conventions)
- [TypeScript Usage](#typescript-usage)
- [JSDoc and Comments](#jsdoc-and-comments)
- [Component Design](#component-design)
- [State Management](#state-management)
- [API Calls](#api-calls)
- [Feature Flags](#feature-flags)
- [Internationalisation (i18n)](#internationalisation-i18n)
- [Accessibility](#accessibility)
- [Error Handling and Loading States](#error-handling-and-loading-states)
- [Testing](#testing)
- [Linting and Formatting](#linting-and-formatting)
- [Environment Variables](#environment-variables)
- [Build Pipeline](#build-pipeline)

---

## Language and Runtime

- Use **Node.js v22 LTS** or higher for local development tooling (Vite, Vitest).
- All source files must be **TypeScript** (`.ts` / `.tsx`). Plain JavaScript (`.js`) is only acceptable for Vite or ESLint configuration files.
- Target **ES2022** (`"target": "ES2022"` in `tsconfig.app.json`).
- Use **React 18 / 19** functional components exclusively. Class components are not permitted.

---

## Style Guide

- **Indentation:** 2 spaces. Never use tabs.
- **Line length:** Maximum 100 characters.
- **Semicolons:** Always use semicolons at the end of statements.
- **String quotes:** Use single quotes `'` for strings in TypeScript/TSX; use template literals `` ` `` for string interpolation.
- **Trailing commas:** Use trailing commas in multi-line objects and arrays (ES5+).

```tsx
// Good
const greeting = 'Hello, world!';
const message = `Welcome, ${user.name}!`;

// Bad
const greeting = "Hello, world!"
const message = "Welcome, " + user.name + "!"
```

---

## Project Structure

```
frontend/src/
├── assets/          # Static assets imported directly by components
├── components/      # Reusable, presentational UI components
│   └── Layout/      # App shell (drawer, topbar)
├── contexts/        # React context providers (e.g. AuthContext)
├── hooks/           # Custom React hooks (e.g. useFeatureFlags)
├── i18n/            # i18next initialisation and locale JSON files
├── pages/           # One folder per route; each folder is one page component
├── services/        # Non-React modules: API client, Firebase helpers
├── test/            # Test setup files (Vitest + jsdom)
├── theme/           # MUI theme factory
└── types/           # Shared TypeScript interfaces
```

Rules:
- A page component lives in `pages/<PageName>/<PageName>Page.tsx`.
- Its co-located test file is `pages/<PageName>/<PageName>Page.test.tsx`.
- Reusable components that span multiple pages live in `components/`.
- No business logic in page files beyond orchestrating hooks and services.

---

## Naming Conventions

| Artefact | Convention | Example |
|---|---|---|
| React components | PascalCase | `LoadingSpinner`, `UsersPage` |
| Hooks | `use` prefix + camelCase | `useFeatureFlags`, `useAuth` |
| Regular functions / variables | camelCase | `fetchUserProfile`, `handleSubmit` |
| TypeScript interfaces | PascalCase | `UserProfile`, `ApiResponse<T>` |
| TypeScript type aliases | PascalCase | `AuthContextType` |
| Enum-like constants | UPPER_SNAKE_CASE | `LANGUAGES`, `ADMIN_ONLY_FIELDS` |
| Locale files | lowercase BCP-47 with `.json` | `en.json`, `pt-BR.json`, `es.json` |

---

## TypeScript Usage

- **No `any`** unless absolutely unavoidable (e.g. third-party library gaps). Use `unknown` and narrow with type guards instead.
- **No non-null assertions (`!`)** without a comment explaining why the value is guaranteed non-null.
- All exported functions must have explicit return types.
- All props interfaces must be explicitly declared (not inlined in the function signature unless trivially simple).
- Prefer `interface` over `type` for object shapes; use `type` for unions, intersections, and mapped types.
- Avoid `React.FC`; write components as plain functions with explicit prop types.

```tsx
// Good
interface ButtonProps {
  label: string;
  onClick: () => void;
}

export default function SubmitButton({ label, onClick }: ButtonProps): JSX.Element {
  return <Button onClick={onClick}>{label}</Button>;
}

// Bad
const SubmitButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <Button onClick={onClick}>{label}</Button>
);
```

---

## JSDoc and Comments

Follow the same JSDoc standard as the rest of the codebase:

- Every exported function, hook, component, and interface **must** have a JSDoc comment.
- Use `@param`, `@returns`, and `@example` tags where they add clarity.
- Inline comments should explain *why*, not *what*.

```tsx
/**
 * Returns the current feature-flag state derived from Vite env variables.
 *
 * @returns A {@link FeatureFlags} object. Each key is `true` when the
 *   corresponding backend service is available.
 *
 * @example
 * const { resumeSearch } = useFeatureFlags();
 * if (!resumeSearch) return <ComingSoon />;
 */
export function useFeatureFlags(): FeatureFlags {
  return config.features;
}
```

---

## Component Design

- Keep components small and focused (single responsibility).
- Extract repeated JSX into named components rather than inline helpers.
- Never put API calls directly in JSX event handlers — delegate to a service function in `services/api.ts`.
- Co-locate a component's test file next to the component file.
- Use MUI components as the primary building blocks. Do not re-implement layout primitives (cards, tables, dialogs) from scratch.
- Mark all interactive controls that depend on a disabled feature flag with `disabled={!features.<flag>}` and show a `dashboard.comingSoon` label.

---

## State Management

- Use React's built-in `useState` and `useContext` for local and shared state.
- Auth state is managed by `AuthContext`; all components should use the `useAuth()` hook.
- Do **not** add a global state library (Redux, Zustand, etc.) unless the codebase grows to require it — discuss in an ADR first.
- Avoid storing derived state; compute it from existing state where possible.

---

## API Calls

- All BFF API calls must go through `src/services/api.ts`.
- Never call `fetch` or Axios directly in a component.
- API functions must return typed promises; never use `any` as a return type.
- Handle loading and error states explicitly in components using local state.
- Use `void` to discard floating promises from event handlers: `onClick={() => { void handleSubmit(); }}`.

```tsx
// Good — clear loading/error state
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleSave = async () => {
  setLoading(true);
  setError(null);
  try {
    await updateUser(uid, { role });
  } catch {
    setError(t('common.error'));
  } finally {
    setLoading(false);
  }
};

// Bad — unhandled promise, no user feedback
<Button onClick={() => updateUser(uid, { role })}>Save</Button>
```

---

## Feature Flags

Feature availability is controlled by `VITE_FEATURE_*` environment variables surfaced through the `useFeatureFlags()` hook.

Rules:
- Never hard-code `true` / `false` feature state inside a component.
- Always use the hook: `const features = useFeatureFlags();`
- When a feature is disabled, **disable** (not hide) the relevant controls and display a `dashboard.comingSoon` label so users understand the feature is coming.
- Features can be removed from the UI only after the corresponding backend service is stable and the flag has been enabled in production.

---

## Internationalisation (i18n)

- All user-visible strings must come from `react-i18next`; do **not** hard-code English strings in components.
- Use the `useTranslation()` hook and the `t()` function.
- Locale keys follow a `namespace.camelCaseKey` pattern (e.g. `auth.email`, `dashboard.welcome`).
- When adding a new string, add the key and its English value to `src/i18n/locales/en.json` first, then add translations to all other locale files (`pt-BR.json`, `es.json`).
- Keep locale JSON files sorted alphabetically within each namespace.

```tsx
// Good
const { t } = useTranslation();
<Typography>{t('dashboard.welcome', { name: user.name })}</Typography>

// Bad
<Typography>Welcome, {user.name}!</Typography>
```

---

## Accessibility

- All interactive elements must be keyboard-accessible (MUI components satisfy this by default).
- Images must have descriptive `alt` attributes; decorative images use `alt=""`.
- Form inputs must be associated with a `<label>` (use the MUI `InputLabel` + `FormControl` pattern).
- Color contrast must meet WCAG 2.1 AA (4.5:1 for normal text, 3:1 for large text).
- Use semantic HTML elements (`<main>`, `<nav>`, `<section>`, `<button>`) rather than `<div>` with `onClick`.
- Do not rely on color alone to convey information; always provide a text or icon complement.

---

## Error Handling and Loading States

- Every data-fetching section must show:
  - A `<LoadingSpinner />` while the request is in flight.
  - An `<ErrorMessage />` when the request fails.
- Never swallow errors silently; always set an error state or re-throw.
- Use `try / catch / finally` in async handlers — set loading to `false` in `finally`.
- HTTP 401 responses are automatically handled by the Axios interceptor in `api.ts` (signs the user out).

---

## Testing

- Use **Vitest** + **React Testing Library** for all tests.
- Test files are co-located with the source file (`<Component>.test.tsx`).
- Each test file must mock:
  - `../../firebase` — prevents real Firebase initialisation.
  - `../../contexts/AuthContext` — returns a controlled user state.
  - `../../services/api` — prevents real HTTP calls.
  - `react-i18next` — returns `t: (key) => key` so assertions use i18n keys.
- Test behaviour from the user's perspective (rendered text, roles, interactions); avoid testing implementation details.
- Name test cases with plain English: `it('shows an error alert when the API call fails')`.

```tsx
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'test-uid', email: 'test@example.com' },
    userProfile: { uid: 'test-uid', email: 'test@example.com', role: 'user', enable: true },
    loading: false,
    isAdmin: false,
    logout: vi.fn(),
    getToken: vi.fn(),
  }),
}));
```

---

## Linting and Formatting

```bash
# Lint the project
npm run lint

# Type-check without emitting
npx tsc --noEmit
```

The project uses ESLint with `@typescript-eslint/recommended` and React hooks rules. Fix all lint warnings before submitting a pull request — do not suppress rules with `// eslint-disable` without a comment explaining the exception.

---

## Environment Variables

All runtime configuration is injected via `VITE_` prefixed environment variables. See [`frontend/.env.example`](../../frontend/.env.example) for the full list.

Rules:
- Never commit real credentials (API keys, secrets) to source control.
- Never access `import.meta.env` directly in component code — use `config` from `src/config.ts` instead, which provides type-safe defaults.
- Add any new variable to `.env.example` with a placeholder value and a comment describing its purpose.

---

## Build Pipeline

```bash
# Development server (http://localhost:5173)
npm run dev

# Production build → dist/
npm run build

# Preview the production build locally
npm run preview

# Run tests
npm test

# Generate coverage report
npm run test:coverage
```

The `Dockerfile` performs a multi-stage build: a Node.js stage compiles the Vite bundle; an Nginx stage serves the static `dist/` files. The `nginx.conf` routes all requests to `index.html` to support client-side routing.

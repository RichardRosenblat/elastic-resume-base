# Node.js Coding Standards

This document defines the coding standards and best practices for the Node.js services (BFF Gateway and Users API) in the Elastic Resume Base project. All contributors must follow these guidelines to ensure consistency, maintainability, and security across the codebase.

---

## Table of Contents

- [Node.js Coding Standards](#nodejs-coding-standards)
  - [Table of Contents](#table-of-contents)
  - [Language and Runtime](#language-and-runtime)
  - [Style Guide](#style-guide)
  - [Project Structure](#project-structure)
  - [Naming Conventions](#naming-conventions)
  - [TypeScript Usage](#typescript-usage)
  - [JSDoc and Comments](#jsdoc-and-comments)
  - [Error Handling](#error-handling)
  - [Logging](#logging)
  - [Shared Libraries](#shared-libraries)
  - [Security](#security)
  - [Dependencies](#dependencies)
  - [Testing](#testing)
  - [Linting and Formatting](#linting-and-formatting)
  - [Environment Variables](#environment-variables)
  - [Build Pipeline](#build-pipeline)
    - [Scripts](#scripts)
    - [esbuild configuration (`esbuild.config.mjs`)](#esbuild-configuration-esbuildconfigmjs)
    - [`tsconfig.json` conventions](#tsconfigjson-conventions)
  - [Async Programming](#async-programming)
  - [API Design](#api-design)

---

## Language and Runtime

- Use **Node.js v22 LTS** or higher.
- All services must specify a pinned Node.js version in their `Dockerfile` (`FROM node:22-alpine`).
- Use **TypeScript** for all source files. JavaScript (`.js`) is only acceptable for configuration files (e.g., `jest.config.cjs`, `eslint.config.js`) when TypeScript is not supported.
- Target **ES2022** or higher in `tsconfig.json`.
- Use **ECMAScript Modules (ESM)** with `"type": "module"` in `package.json`.

---

## Style Guide

All Node.js/TypeScript code must be consistently formatted. The following rules apply:

- **Indentation:** 2 spaces. Never use tabs.
- **Line length:** Maximum 100 characters.
- **Semicolons:** Always use semicolons at the end of statements.
- **String quotes:** Use single quotes `'` for strings; use template literals `` ` `` for string interpolation.
- **Trailing commas:** Use trailing commas in multi-line objects, arrays, and parameter lists (ES5+).
- **Blank lines:** One blank line between logically separate blocks of code; two blank lines between top-level declarations.

```typescript
// Good
import Fastify from 'fastify';
import { ResumeService } from './services/resume.service.js';

const app = Fastify();

app.get('/resumes/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const resume = await resumeService.findById(id);
  reply.send(resume);
});


// Bad
import fastify from "fastify"
import {ResumeService} from "./services/resume.service.js"
var app = fastify()
app.get('/resumes/:id',async(request,reply)=>{reply.send(await resumeService.findById((request.params as any).id))})
```

---

## Project Structure

All Node.js services should follow this structure:

```
bff-gateway/               # or users-api/
├── src/
│   ├── app.ts               # Fastify app factory (buildApp function)
│   ├── server.ts            # HTTP server entrypoint (calls buildApp + app.listen)
│   ├── config.ts            # Environment variable loading and validation (Zod)
│   ├── swagger.ts           # @fastify/swagger + @fastify/swagger-ui setup
│   ├── routes/              # Route definitions (one file per resource)
│   │   ├── index.ts         # Root plugin that registers all sub-routes
│   │   ├── health.ts
│   │   └── users.ts
│   ├── controllers/         # Request/response handling (FastifyRequest/FastifyReply)
│   │   └── users.controller.ts
│   ├── services/            # Business logic and external API clients
│   │   └── users.service.ts
│   ├── middleware/          # Fastify hooks (onRequest, onResponse, setErrorHandler)
│   │   ├── auth.ts          # authHook (JWT verification)
│   │   ├── correlationId.ts # correlationIdHook
│   │   ├── requestLogger.ts # requestLoggerHook
│   │   └── errorHandler.ts  # setErrorHandler implementation
│   ├── models/              # TypeScript interfaces and type definitions
│   │   └── index.ts
│   └── utils/               # Shared utility functions
│       └── logger.ts
├── tests/
│   ├── unit/
│   │   └── *.test.ts
│   └── integration/
│       └── *.test.ts
├── Dockerfile
├── package.json
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
└── .env.example
```

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files | `kebab-case` | `resume.service.ts` |
| Directories | `kebab-case` | `middleware/` |
| Variables | `camelCase` | `const resumeId = 'abc123';` |
| Functions | `camelCase` | `function getResumeById()` |
| Classes | `PascalCase` | `class ResumeService` |
| Interfaces | `PascalCase` (no `I` prefix) | `interface ResumeData` |
| Type aliases | `PascalCase` | `type ResumeId = string;` |
| Enums | `PascalCase` | `enum ResumeStatus` |
| Enum values | `UPPER_SNAKE_CASE` | `ResumeStatus.PROCESSING_COMPLETE` |
| Constants | `UPPER_SNAKE_CASE` | `const MAX_RETRIES = 3;` |
| Private class members | `_camelCase` | `private _cache: Map<string, Resume>;` |
| Route paths | `kebab-case` | `/api/v1/resume-data` |

---

## TypeScript Usage

- Always enable **strict mode** in `tsconfig.json` (`"strict": true`).
- Prefer `interface` for object shapes; use `type` for unions, intersections, and utility types.
- **Never use `any`**. Use `unknown` when the type is truly unknown, then narrow it safely.
- Use non-null assertion (`!`) sparingly and only when the type system cannot infer a known-non-null value.
- Prefer `readonly` for properties that should not be mutated after construction.
- Use TypeScript generics to create reusable, type-safe utility functions.
- Augment Fastify's type declarations in `src/models/index.ts` for request extensions (e.g., `correlationId`, `user`).

```typescript
// Fastify type augmentation
declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
    user: { uid: string; email?: string };
  }
}


// Good
interface ResumeData {
  readonly id: string;
  candidateName: string;
  skills: readonly string[];
  createdAt: Date;
}

function parseResponse<T>(data: unknown): T {
  // Perform runtime validation then return
  return data as T;
}


// Bad
const data: any = response.body;
let result: Object = {};
```

Example `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## JSDoc and Comments

Use **JSDoc** for all public functions, classes, methods, and interfaces. This enables IntelliSense and auto-generated documentation.

```typescript
/**
 * Verifies a Firebase ID token and returns the decoded claims.
 *
 * @param idToken - The raw Firebase ID token from the Authorization header.
 * @returns The decoded token claims including uid and email.
 * @throws {UnauthorizedError} If the token is invalid or expired.
 */
async function verifyIdToken(idToken: string): Promise<DecodedIdToken> {
  ...
}
```

- All public APIs, controllers, services, and middleware must have a JSDoc comment.
- Use inline comments sparingly and only to explain **why**, not **what**.
- Do not leave commented-out code in committed files.

---

## Error Handling

- Use a **centralized error handler** registered via `app.setErrorHandler()` in Fastify to catch and format all errors consistently.
- Register `setErrorHandler` **before** registering routes so it applies to all child scopes.
- Define custom error classes extending `AppError` from `@elastic-resume-base/synapse` for domain-specific errors.
- Use `schemaErrorFormatter` in Fastify options to convert AJV body/query schema errors into your standard error class, ensuring a consistent response envelope even for low-level schema validation failures.
- Never let unhandled promise rejections crash the server; Fastify catches async handler errors automatically.
- Always include a meaningful `message` and an HTTP `statusCode` in error responses.

```typescript
// src/app.ts — register error handler BEFORE routes
import { ValidationError } from '@elastic-resume-base/synapse';

const app = Fastify({
  schemaErrorFormatter: (_errors, dataVar) => new ValidationError(`${dataVar} validation failed`),
});

app.setErrorHandler(errorHandler);        // must come before app.register(routes)
await app.register(routes);


// src/middleware/errorHandler.ts — centralized Fastify error handler
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '@elastic-resume-base/synapse';

export function errorHandler(err: Error, request: FastifyRequest, reply: FastifyReply): void {
  const correlationId = request.correlationId;

  if (err instanceof AppError) {
    reply.code(err.statusCode).send({
      success: false,
      error: { code: err.code, message: err.statusCode >= 500 ? 'An unexpected error occurred' : err.message },
      correlationId,
    });
    return;
  }

  reply.code(500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    correlationId,
  });
}
```

---

## Logging

- Use a structured logging library such as **Pino**. **Do not use `console.log()`** in production code.
- Configure the logger to output JSON in production for Google Cloud Logging compatibility.
- Attach `correlationId` to log entries via the `onRequest` hook for distributed tracing.
- Use **Toolbox** (`shared/Toolbox/src/`) to create a shared, pre-configured logger — do not duplicate logger setup in every service.

### Log Level Guidelines

Use the appropriate Pino log level for every log call. The `LOG_LEVEL` environment variable controls the minimum visible level (default `info`).

| Level | When to use |
|-------|-------------|
| `trace` | Highly granular steps: individual Firestore reads/writes, exact bytes sent/received |
| `debug` | Useful development detail: entering a function, resolved values, branch chosen |
| `info` | Significant lifecycle events that are always relevant: user created/updated/deleted, job accepted, service started |
| `warn` | Recoverable problems: validation failures, downstream service unavailable (with fallback), access denied |
| `error` | Unrecoverable errors that require operator attention: unhandled exceptions, unexpected 5xx paths |

```typescript
// src/utils/logger.ts — one-liner using the shared factory from Toolbox
import { createLogger } from '../../../shared/Toolbox/src/createLogger.js';
import { config } from '../config.js';

export const logger = createLogger({
  serviceName: 'my-service',
  logLevel: config.logLevel,   // 'trace' | 'debug' | 'info' | 'warn' | 'error'
  nodeEnv: config.nodeEnv,     // pretty-print in dev, GCP JSON in production
});


// Controller — debug on entry, info on mutation, warn on validation failure
export async function createUserHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'createUserHandler: validating request body');
  const parsed = schema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn({ correlationId: request.correlationId, issues: parsed.error.issues }, 'createUserHandler: validation failed');
    void reply.code(400).send(formatError('VALIDATION_ERROR', '...'));
    return;
  }
  logger.info({ correlationId: request.correlationId, email: parsed.data.email }, 'createUserHandler: creating user');
  const user = await createUser(parsed.data);
  logger.debug({ correlationId: request.correlationId, uid: user.uid }, 'createUserHandler: user created successfully');
  void reply.code(201).send(formatSuccess(user, request.correlationId));
}


// Service — trace for individual Firestore writes, debug for checks
export async function createUser(data: CreateUserRequest): Promise<UserRecord> {
  logger.debug({ email: data.email }, 'createUser: checking for duplicate email');
  const existing = await db.collection('users').where('email', '==', data.email).limit(1).get();
  if (!existing.empty) {
    logger.warn({ email: data.email }, 'createUser: email already exists');
    throw new ConflictError(`A user with email '${data.email}' already exists`);
  }
  logger.trace({ email: data.email }, 'createUser: writing document to Firestore');
  await db.collection('users').doc(uid).set(docData);
  logger.info({ uid, action: 'createUser' }, 'User created');
  return mapDocument(await db.collection('users').doc(uid).get());
}
```

- **Never log PII** (names, email addresses, document content, tokens).
- Log resource identifiers (e.g., `resumeId`, `userId`) rather than the data itself.

---

## Shared Libraries

The monorepo provides several internal packages under `shared/`. All services should use them instead of duplicating the logic. Each package has its own `README.md` with full API documentation.

| Package | Location | Purpose |
|---------|----------|---------|
| **Toolbox** | `shared/Toolbox/src/` | Cross-cutting utilities: `loadConfigYaml`, `createLogger`, `correlationIdHook`, `createRequestLoggerHook` |
| **Bowltie** | `@elastic-resume-base/bowltie` | Response formatting: `formatSuccess` / `formatError` |
| **Synapse** | `@elastic-resume-base/synapse` | Error classes (`AppError`, `NotFoundError`, `ConflictError`, …), `UserRepository` interface, `FirestoreUserRepository` |
| **Bugle** | `@elastic-resume-base/bugle` | Google API client: `getGoogleAuthClient`, `DrivePermissionsService` |

### Using Toolbox

Toolbox is a plain collection of TypeScript source files — it is **not** an npm package and requires no build step or `npm install`. Import directly from its `src/` files using a relative path:

```typescript
import { createLogger } from '../../../shared/Toolbox/src/createLogger.js';
import { loadConfigYaml } from '../../../shared/Toolbox/src/loadConfigYaml.js';
import { correlationIdHook } from '../../../shared/Toolbox/src/middleware/correlationId.js';
import { createRequestLoggerHook } from '../../../shared/Toolbox/src/middleware/requestLogger.js';
```

All runtime dependencies used by Toolbox (`pino`, `js-yaml`, `@google-cloud/pino-logging-gcp-config`) must be present in the consuming service's own `package.json`. The service's `tsconfig.json`, `jest.config.cjs`, and `esbuild.config.mjs` must also include the mapper entries described in the [canonical usage pattern](#toolbox--canonical-usage-pattern) so the TypeScript compiler, Jest, and esbuild each resolve Toolbox's dependencies from the service's own `node_modules`.

### Installing other shared libraries

Because these packages are not published to npm, install them using a relative path:

### Toolbox — canonical usage pattern

Every service must wire up Toolbox in exactly this way:

**`src/utils/logger.ts`**
```typescript
import { createLogger } from '../../../shared/Toolbox/src/createLogger.js';
import { config } from '../config.js';

export const logger = createLogger({
  serviceName: 'my-service',
  logLevel: config.logLevel,
  nodeEnv: config.nodeEnv,
});
```

**`src/utils/loadConfigYaml.ts`** (thin re-export)
```typescript
export { loadConfigYaml } from '../../../shared/Toolbox/src/loadConfigYaml.js';
```

**`src/middleware/correlationId.ts`** (thin re-export)
```typescript
export { correlationIdHook } from '../../../shared/Toolbox/src/middleware/correlationId.js';
```

**`src/middleware/requestLogger.ts`**
```typescript
import { createRequestLoggerHook } from '../../../shared/Toolbox/src/middleware/requestLogger.js';
import { logger } from '../utils/logger.js';

export const requestLoggerHook = createRequestLoggerHook(logger);
```

**`src/app.ts`** (register hooks)
```typescript
import { correlationIdHook } from './middleware/correlationId.js';
import { requestLoggerHook } from './middleware/requestLogger.js';

app.addHook('onRequest', correlationIdHook);
app.addHook('onResponse', requestLoggerHook);
```

**`tsconfig.json`** — `paths` entries redirect Toolbox deps to the service's `node_modules`:
```json
"paths": {
  "pino": ["./node_modules/pino"],
  "js-yaml": ["./node_modules/@types/js-yaml"],
  "@google-cloud/pino-logging-gcp-config": ["./node_modules/@google-cloud/pino-logging-gcp-config"]
}
```

> `js-yaml` maps to `@types/js-yaml` because js-yaml's `exports` field lacks a `types` condition, preventing TypeScript's NodeNext resolver from finding `@types/js-yaml` automatically via the normal fallback path. The actual js-yaml implementation is resolved at runtime by Node.js and esbuild.

**`esbuild.config.mjs`** — `nodePaths` ensures esbuild resolves Toolbox deps during bundling:
```javascript
import { resolve } from 'node:path';
await build({
  // ...
  packages: 'external',
  nodePaths: [resolve('node_modules')],
  // ...
});
```

### Bowltie — response formatting

Use `formatSuccess` / `formatError` from Bowltie in **all** controllers and error handlers to produce the standard JSON envelope. Do **not** build response objects manually.

```typescript
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';

// Success
void reply.code(200).send(formatSuccess(user, request.correlationId));
// → { success: true, data: user, meta: { correlationId, timestamp } }

// Error
void reply.code(404).send(formatError('NOT_FOUND', 'User not found', request.correlationId));
// → { success: false, error: { code: 'NOT_FOUND', message: '…' }, meta: { correlationId, timestamp } }
```

### Jest — mapping shared packages to TypeScript source

Add each npm-package shared library to `moduleNameMapper` in `jest.config.cjs` so `ts-jest` can compile it alongside the service without ESM/CJS interop issues. Also add entries for Toolbox's dependencies so Jest resolves them from the service's `node_modules` (Toolbox has no `node_modules` of its own):

```javascript
moduleNameMapper: {
  '^(\\.{1,2}/.*)\\.js$': '$1',
  '^@elastic-resume-base/bowltie$':  '<rootDir>/../shared/Bowltie/src/index.ts',
  '^@elastic-resume-base/synapse$':  '<rootDir>/../shared/Synapse/src/index.ts',
  '^@elastic-resume-base/bugle$':    '<rootDir>/../shared/Bugle/src/index.ts',
  '^pino$':                          '<rootDir>/node_modules/pino',
  '^js-yaml$':                       '<rootDir>/node_modules/js-yaml',
  '^@google-cloud/pino-logging-gcp-config$': '<rootDir>/node_modules/@google-cloud/pino-logging-gcp-config',
},
```

---

## Security

- **Never commit secrets, API keys, or credentials** to the repository.
- Load all secrets from environment variables or Google Cloud Secret Manager.
- Always verify Firebase ID tokens on every protected route using the Firebase Admin SDK.
- Validate and sanitize all incoming request bodies using **Zod** in controllers. Use Fastify route schemas (JSON Schema) only for coercion and `required` checks — delegate format/pattern validation to Zod to ensure consistent error envelopes.
- Use **`@fastify/helmet`** to set secure HTTP headers on all responses.
- Enable **`@fastify/cors`** only for known, allowed origins.
- Apply **`@fastify/rate-limit`** to all public API endpoints.

```typescript
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

await app.register(helmet);
await app.register(cors, { origin: config.allowedOrigins.split(',') });
await app.register(rateLimit, { max: 100, timeWindow: '15 minutes' });
```

- Never use `eval()`, `new Function()`, or dynamic `require()`/`import()` with user-controlled strings.
- Avoid prototype pollution — use `Object.create(null)` for dictionary objects when necessary.

---

## Dependencies

- Pin all dependencies to **exact versions** in `package.json` (`"fastify": "5.3.2"` not `"^5.3.2"`).
- Separate production and development dependencies using `dependencies` and `devDependencies`.
- Regularly audit dependencies for known vulnerabilities using `npm audit`.
- Avoid adding new dependencies without team review — prefer using built-in Node.js modules.

```json
{
  "dependencies": {
    "fastify": "5.3.2",
    "@fastify/helmet": "12.0.1",
    "@fastify/cors": "10.0.1",
    "@fastify/rate-limit": "10.2.1",
    "@fastify/swagger": "9.4.0",
    "@fastify/swagger-ui": "5.2.1",
    "firebase-admin": "12.1.0",
    "pino": "9.1.0",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "typescript": "5.4.5",
    "@types/node": "20.12.7",
    "jest": "29.7.0",
    "ts-jest": "29.1.4",
    "eslint": "8.57.0",
    "prettier": "3.2.5"
  }
}
```

---

## Testing

- Use **Jest** as the test runner with `ts-jest` for TypeScript support.
- Use **Fastify's built-in `app.inject()`** for HTTP endpoint testing — do **not** use supertest.
- Aim for a minimum of **80% code coverage** on business logic.
- Mock external dependencies (Firebase, downstream services) using `jest.mock()` or `jest.spyOn()`.
- Test files must be co-located in a `tests/` directory and named `*.test.ts`.
- Build the Fastify app once with `buildApp()` in `beforeAll` and close it in `afterAll`.

```typescript
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';

describe('GET /api/v1/resumes/:id', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with resume data when the resume exists', async () => {
    jest.spyOn(resumeService, 'findById').mockResolvedValueOnce({ id: 'test-123', skills: [] });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/resumes/test-123',
      headers: { authorization: 'Bearer mock-token' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('data.id', 'test-123');
  });

  it('returns 404 when the resume does not exist', async () => {
    jest.spyOn(resumeService, 'findById').mockResolvedValueOnce(null);

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/resumes/nonexistent',
      headers: { authorization: 'Bearer mock-token' },
    });

    expect(res.statusCode).toBe(404);
  });
});
```

Run tests with coverage:

```bash
npm test -- --coverage
```

---

## Linting and Formatting

All Node.js services must use the following tools:

| Tool | Purpose | Configuration |
|---|---|---|
| **ESLint** | Linting and static analysis | `.eslintrc.cjs` |
| **Prettier** | Code formatting | `.prettierrc` |
| **TypeScript** | Static type checking | `tsconfig.json` |

Example `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

Run all checks before committing:

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
```

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts",
    "test": "NODE_OPTIONS='--experimental-vm-modules' jest --runInBand --forceExit",
    "test:coverage": "NODE_OPTIONS='--experimental-vm-modules' jest --coverage",
    "lint": "eslint src/ tests/",
    "lint:fix": "eslint src/ tests/ --fix",
    "format": "prettier --write src/ tests/",
    "format:check": "prettier --check src/ tests/",
    "typecheck": "tsc --noEmit"
  }
}
```

---

## Environment Variables

- All environment variables for every service are defined in a **single nested `config.yaml`** at the repository root. The committed template is `config_example.yaml`; developers copy it to `config.yaml` (git-ignored) and fill in their values.
- Each Node.js service reads `config.yaml` **directly at startup** via `src/utils/loadConfigYaml.ts`, which merges `systems.shared` with `systems.<service-name>` into `process.env`. No preprocessing script is required.
- `loadConfigYaml` only sets keys that are **not already present** in `process.env`, so variables injected by the shell, Docker, CI, or a test harness always take precedence. If `config.yaml` cannot be found the function returns silently (graceful fallback to Zod defaults / existing env vars).
- For local development without Docker Compose, place `config.yaml` at the repository root; `loadConfigYaml` will find it automatically when you `npm run dev` from inside or outside the service directory.
- Validate environment variables at startup using **Zod**; fail fast if any required variable is missing.
- Never access `process.env` directly in business logic — always go through a validated `config` module.
- Never hardcode defaults that differ between environments; keep all defaults in the Zod schema or in `config_example.yaml`.

```typescript
// src/config.ts
import { z } from 'zod';
import { loadConfigYaml } from './utils/loadConfigYaml.js';

// Populate process.env from config.yaml before Zod reads it.
loadConfigYaml('my-service');

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().default(3000),
  projectId: z.string().default('demo-project'),
  firestoreEmulatorHost: z.string().optional(),
  firebaseAuthEmulatorHost: z.string().optional(),
  allowedOrigins: z.string().default('http://localhost:5173'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  return configSchema.parse({
    nodeEnv: process.env['NODE_ENV'],
    port: process.env['PORT'] ? parseInt(process.env['PORT'], 10) : undefined,
    projectId: process.env['FIREBASE_PROJECT_ID'],
    firestoreEmulatorHost: process.env['FIRESTORE_EMULATOR_HOST'],
    firebaseAuthEmulatorHost: process.env['FIREBASE_AUTH_EMULATOR_HOST'],
    allowedOrigins: process.env['ALLOWED_ORIGINS'],
    logLevel: process.env['LOG_LEVEL'],
  });
}

export const config = loadConfig();
```

---

## Build Pipeline

Each Node.js service uses **esbuild** for bundling alongside TypeScript for type checking.

### Scripts

| Script | Command | Purpose |
|---|---|---|
| `typecheck` | `tsc --noEmit` | Type-check only — no file output |
| `build` | `tsc --noEmit && node esbuild.config.mjs` | Type-check then produce bundle |
| `dev` | `tsx src/server.ts` | Run TypeScript directly (no build step) |

### esbuild configuration (`esbuild.config.mjs`)

```javascript
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'bundle',   // keep npm packages in node_modules at runtime
  outfile: 'dist/server.js',
  sourcemap: true,
});
```

- **`bundle: true`** — Recursively inlines all local `import` statements into `dist/server.js`.
- **`packages: 'external'`** — npm packages stay as `import` statements and are resolved from `node_modules/` at runtime. This avoids bundling packages that use native add-ons or dynamic `require()` calls.
- **`format: 'esm'`** — Output is an ES module, consistent with `"type": "module"` in `package.json`.
- **`sourcemap: true`** — Produces `dist/server.js.map` for readable stack traces.

### `tsconfig.json` conventions

Because esbuild handles all file emission, `tsconfig.json` should **not** include `declaration` or `declarationMap` (those are library-publishing options). The `outDir` and `rootDir` entries may be kept for reference but have no effect when `tsc` runs with `--noEmit`.

---

## Async Programming

- Use **`async/await`** for all asynchronous operations. Avoid raw promise chains (`.then().catch()`).
- Always `await` promises — do not fire-and-forget unless explicitly intentional, and document it clearly.
- Use `Promise.all()` to execute independent async operations concurrently.
- Handle errors from `async` functions in the caller or via middleware — Fastify automatically catches rejected promises from async route handlers and forwards them to `setErrorHandler`.

```typescript
// Good — concurrent execution
const [resume, user] = await Promise.all([
  resumeService.findById(resumeId),
  userService.findById(userId),
]);


// Bad — sequential when order doesn't matter
const resume = await resumeService.findById(resumeId);
const user = await userService.findById(userId);
```

---

## API Design

- Follow **RESTful** conventions for all endpoints.
- Version all APIs under a path prefix (e.g., `/api/v1/`).
- Use appropriate HTTP methods: `GET` (read), `POST` (create), `PUT`/`PATCH` (update), `DELETE` (delete).
- Use standard HTTP status codes consistently:
  - `200 OK` — successful read/update
  - `201 Created` — successful resource creation
  - `204 No Content` — successful delete
  - `400 Bad Request` — invalid input
  - `401 Unauthorized` — authentication required
  - `403 Forbidden` — authenticated but not authorized
  - `404 Not Found` — resource does not exist
  - `409 Conflict` — resource already exists
  - `500 Internal Server Error` — unexpected server error
- All responses must be JSON with a consistent envelope structure using `@elastic-resume-base/bowltie` (`formatSuccess` / `formatError`). Never build `{ success, data/error, meta }` objects manually.
- Document all endpoints using **OpenAPI/Swagger** via `@fastify/swagger` and `@fastify/swagger-ui`.
- Route JSON schemas should only declare `type` and `required` — leave format/length validation to Zod in the controller to ensure consistent error envelopes.

```typescript
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';

// Consistent success response envelope
void reply.code(200).send(formatSuccess(resume, request.correlationId));

// Consistent error response envelope
void reply.code(404).send(formatError('NOT_FOUND', 'Resume not found', request.correlationId));
```


# Node.js Coding Standards

This document defines the coding standards and best practices for the Node.js services (BFF Gateway and Users API) in the Elastic Resume Base project. All contributors must follow these guidelines to ensure consistency, maintainability, and security across the codebase.

---

## Table of Contents

- [Language and Runtime](#language-and-runtime)
- [Style Guide](#style-guide)
- [Project Structure](#project-structure)
- [Naming Conventions](#naming-conventions)
- [TypeScript Usage](#typescript-usage)
- [JSDoc and Comments](#jsdoc-and-comments)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Security](#security)
- [Dependencies](#dependencies)
- [Testing](#testing)
- [Linting and Formatting](#linting-and-formatting)
- [Environment Variables](#environment-variables)
- [Async Programming](#async-programming)
- [API Design](#api-design)

---

## Language and Runtime

- Use **Node.js v20 LTS** or higher.
- All services must specify a pinned Node.js version in their `Dockerfile` (`FROM node:20-alpine`).
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

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  ...(process.env['NODE_ENV'] !== 'production' && {
    transport: { target: 'pino-pretty' },
  }),
});


// Per-request correlation in onRequest hook
export function correlationIdHook(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void {
  const correlationId = (request.headers['x-correlation-id'] as string) || uuidv4();
  request.correlationId = correlationId;
  reply.header('x-correlation-id', correlationId);
  done();
}
```

- **Never log PII** (names, email addresses, document content, tokens).
- Log resource identifiers (e.g., `resumeId`, `userId`) rather than the data itself.

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
    "dev": "tsx src/server.ts",
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

- Load all configuration from environment variables.
- Validate required environment variables at startup using **Zod**; fail fast if any required variable is missing.
- Never access `process.env` directly in business logic — always go through a validated `config` module.

```typescript
// src/config.ts
import { z } from 'zod';

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
- All responses must be JSON with a consistent envelope structure using `@elastic-resume-base/bowltie` (bff-gateway) or an equivalent `{ success, data/error, correlationId }` shape.
- Document all endpoints using **OpenAPI/Swagger** via `@fastify/swagger` and `@fastify/swagger-ui`.
- Route JSON schemas should only declare `type` and `required` — leave format/length validation to Zod in the controller to ensure consistent error envelopes.

```typescript
// Consistent success response envelope
reply.code(200).send({
  success: true,
  data: resume,
  correlationId: request.correlationId,
});

// Consistent error response envelope
reply.code(404).send({
  success: false,
  error: { code: 'NOT_FOUND', message: 'Resume not found' },
  correlationId: request.correlationId,
});
```

---

## Table of Contents

- [Language and Runtime](#language-and-runtime)
- [Style Guide](#style-guide)
- [Project Structure](#project-structure)
- [Naming Conventions](#naming-conventions)
- [TypeScript Usage](#typescript-usage)
- [JSDoc and Comments](#jsdoc-and-comments)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Security](#security)
- [Dependencies](#dependencies)
- [Testing](#testing)
- [Linting and Formatting](#linting-and-formatting)
- [Environment Variables](#environment-variables)
- [Async Programming](#async-programming)
- [API Design](#api-design)

---

## Language and Runtime

- Use **Node.js v20 LTS** or higher.
- All services must specify a pinned Node.js version in their `Dockerfile` (`FROM node:20-alpine`).
- Use **TypeScript** for all source files. JavaScript (`.js`) is only acceptable for configuration files (e.g., `jest.config.js`, `eslint.config.js`) when TypeScript is not supported.
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
import express from 'express';
import { ResumeService } from './services/resume.service.js';

const app = express();

app.get('/resumes/:id', async (req, res) => {
  const { id } = req.params;
  const resume = await resumeService.findById(id);
  res.json(resume);
});


// Bad
import express from "express"
import {ResumeService} from "./services/resume.service.js"
var app = express()
app.get('/resumes/:id',async(req,res)=>{res.json(await resumeService.findById(req.params.id))})
```

---

## Project Structure

The BFF Gateway should follow this structure:

```
bff-gateway/
├── src/
│   ├── app.ts               # Express/Fastify app setup
│   ├── server.ts            # HTTP server entrypoint
│   ├── config.ts            # Environment variable loading and validation
│   ├── routes/              # Route definitions (one file per resource)
│   │   ├── index.ts
│   │   ├── resumes.routes.ts
│   │   └── users.routes.ts
│   ├── controllers/         # Request/response handling
│   │   ├── resumes.controller.ts
│   │   └── users.controller.ts
│   ├── services/            # Business logic and external API clients
│   │   ├── resume.service.ts
│   │   └── auth.service.ts
│   ├── middleware/          # Express/Fastify middleware
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   ├── models/              # TypeScript interfaces and type definitions
│   │   └── resume.model.ts
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

```typescript
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
    "module": "ESNext",
    "moduleResolution": "bundler",
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
 * @throws {AuthenticationError} If the token is invalid or expired.
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

- Use a **centralized error handling middleware** in Express/Fastify to catch and format all errors consistently.
- Define custom error classes extending `Error` for domain-specific errors.
- Never let unhandled promise rejections crash the server; use global handlers during startup.
- Always include a meaningful `message` and an HTTP `statusCode` in error responses.

```typescript
// Custom error classes
export class NotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends Error {
  readonly statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}


// Centralized error middleware (Express)
import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = 'statusCode' in err ? (err.statusCode as number) : 500;
  const message = statusCode < 500 ? err.message : 'Internal Server Error';

  logger.error('Request error', { statusCode, error: err.message, stack: err.stack });
  res.status(statusCode).json({ error: message });
};
```

---

## Logging

- Use a structured logging library such as **Pino** or **Winston**. **Do not use `console.log()`** in production code.
- Configure the logger to output JSON in production for Google Cloud Logging compatibility.
- Use a child logger per request to include `requestId`, `userId`, and other request-scoped context.

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: { target: 'pino-pretty' },
  }),
});


// Per-request child logger in middleware
app.use((req, _res, next) => {
  req.log = logger.child({ requestId: req.headers['x-request-id'] });
  next();
});
```

- **Never log PII** (names, email addresses, document content, tokens).
- Log resource identifiers (e.g., `resumeId`, `userId`) rather than the data itself.

---

## Security

- **Never commit secrets, API keys, or credentials** to the repository.
- Load all secrets from environment variables or Google Cloud Secret Manager.
- Always verify Firebase ID tokens on every protected route using the Firebase Admin SDK.
- Validate and sanitize all incoming request bodies using a schema validation library (e.g., **Zod**).
- Use **Helmet.js** to set secure HTTP headers on all responses.
- Enable **CORS** only for known, allowed origins.
- Apply **rate limiting** to all public API endpoints.

```typescript
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

- Never use `eval()`, `new Function()`, or dynamic `require()`/`import()` with user-controlled strings.
- Avoid prototype pollution — use `Object.create(null)` for dictionary objects when necessary.

---

## Dependencies

- Pin all dependencies to **exact versions** in `package.json` (`"express": "4.19.2"` not `"^4.19.2"`).
- Separate production and development dependencies using `dependencies` and `devDependencies`.
- Regularly audit dependencies for known vulnerabilities using `npm audit`.
- Avoid adding new dependencies without team review — prefer using built-in Node.js modules.

```json
{
  "dependencies": {
    "express": "4.19.2",
    "firebase-admin": "12.1.0",
    "pino": "9.1.0",
    "helmet": "7.1.0",
    "zod": "3.23.6"
  },
  "devDependencies": {
    "typescript": "5.4.5",
    "@types/express": "4.17.21",
    "jest": "29.7.0",
    "ts-jest": "29.1.4",
    "supertest": "7.0.0",
    "eslint": "9.3.0",
    "prettier": "3.2.5"
  }
}
```

---

## Testing

- Use **Jest** as the test runner with `ts-jest` for TypeScript support.
- Use **Supertest** for integration/HTTP endpoint testing.
- Aim for a minimum of **80% code coverage** on business logic.
- Mock external dependencies (Firebase, downstream services) using `jest.mock()` or `jest.spyOn()`.
- Test files must be co-located in a `tests/` directory and named `*.test.ts`.

```typescript
import request from 'supertest';
import { app } from '../../src/app.js';

describe('GET /resumes/:id', () => {
  it('returns 200 with resume data when the resume exists', async () => {
    jest.spyOn(resumeService, 'findById').mockResolvedValueOnce({ id: 'test-123', skills: [] });

    const res = await request(app).get('/resumes/test-123').set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', 'test-123');
  });

  it('returns 404 when the resume does not exist', async () => {
    jest.spyOn(resumeService, 'findById').mockResolvedValueOnce(null);

    const res = await request(app).get('/resumes/nonexistent').set('Authorization', 'Bearer mock-token');

    expect(res.status).toBe(404);
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
    "dev": "nodemon --exec ts-node src/server.ts",
    "test": "jest",
    "test:coverage": "jest --coverage",
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

- Load all configuration from environment variables.
- Validate required environment variables at startup using **Zod** or a similar schema library; fail fast if any required variable is missing.
- Never access `process.env` directly in business logic — always go through a validated `config` module.

```typescript
// src/config.ts
import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  GCP_PROJECT_ID: z.string().min(1),
  FIRESTORE_EMULATOR_HOST: z.string().optional(),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
```

---

## Async Programming

- Use **`async/await`** for all asynchronous operations. Avoid raw promise chains (`.then().catch()`).
- Always `await` promises — do not fire-and-forget unless explicitly intentional, and document it clearly.
- Use `Promise.all()` to execute independent async operations concurrently.
- Handle errors from `async` functions in the caller or via middleware — never leave unhandled rejections.

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
  - `422 Unprocessable Entity` — validation error
  - `500 Internal Server Error` — unexpected server error
- All responses must be JSON with a consistent envelope structure.
- Document all endpoints using **OpenAPI/Swagger** (e.g., via `@fastify/swagger` or `swagger-jsdoc`).

```typescript
// Consistent success response envelope
res.status(200).json({
  data: resume,
  meta: { requestId: req.headers['x-request-id'] },
});

// Consistent error response envelope
res.status(404).json({
  error: 'Resume not found',
  code: 'RESUME_NOT_FOUND',
});
```

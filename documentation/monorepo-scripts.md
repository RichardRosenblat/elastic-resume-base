# Monorepo Scripts Reference

This document describes the root-level scripts available in the Elastic Resume Base repository.

---

## Available Scripts

| Script | Platform | Command | Description |
|---|---|---|---|
| `build_shared.bat` | Windows | `.\build_shared.bat` | Builds all shared TypeScript libraries under `shared/` in order |
| `build_shared.sh` | Linux / macOS | `./build_shared.sh` | Same as above, cross-platform |

---

## When to Run Build Scripts

Run the build scripts in the following situations:

- **After cloning the repository** — shared libraries must be compiled before any Node.js service can start.
- **After modifying a shared library** — the service will continue using the old `dist/` output until you rebuild.
- **Before running Docker Compose for the first time** — some Dockerfiles copy pre-built `dist/` artifacts.
- **Before running tests in a Node.js service** — Jest resolves shared packages via `moduleNameMapper` to their TypeScript source, but TypeScript still needs the compiled output for type resolution from installed package symlinks.

---

## Build Order

The shared libraries are built in the following order, which satisfies their dependency graph:

1. **Synapse** (`shared/Synapse`) — error class hierarchy, `UserRepository` interface, `FirestoreUserRepository`
2. **Bowltie** (`shared/Bowltie`) — API response envelope; depends on Synapse error types
3. **Bugle** (`shared/Bugle`) — Google Auth and Drive permissions; no shared-lib dependencies

> **Toolbox** (`shared/Toolbox`) has no `package.json` and is automatically skipped by the build scripts. It is a plain source collection imported directly via relative paths — no build or install step required.

> The `shared/` directory is iterated in filesystem (alphabetical) order, which matches this build sequence. **Do not rename the library directories** without verifying the resulting build order.

---

## What the Scripts Do

Both scripts perform the same steps for each `shared/*/` subdirectory that contains a `package.json`:

1. Print a progress message: `Building shared/<LibraryName>/`
2. Run `npm install` to ensure dependencies are installed
3. Run `npm run build` to compile TypeScript to `dist/`

If any step fails, the script exits immediately with a non-zero exit code (Linux/macOS `set -e` behaviour; Windows via `call` return codes).

---

## Adding a New Shared Library

1. Create the new library directory under `shared/` following the structure defined in [Shared Library Standards](coding-standards/shared-libraries-standards.md).
2. Add a `package.json` with a `build` script (e.g., `tsc`).
3. The build scripts will automatically pick up the new directory on the next run — no changes to the scripts are required.
4. If the new library depends on another shared library, ensure its directory name sorts **after** its dependency in alphabetical order, or document the manual build order.

---

## Related Documents

- [Shared Library Standards](coding-standards/shared-libraries-standards.md) — how to develop and maintain shared libraries
- [Docker Orchestration](docker-orchestration.md) — using shared libraries inside Docker containers
- [Troubleshooting](troubleshooting.md#shared-library-build-issues) — common build issues and fixes

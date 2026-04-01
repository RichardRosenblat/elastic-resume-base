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

1. **Synapse** (`shared/Synapse/v1/synapse_ts`) — error class hierarchy, `UserRepository` interface, `FirestoreUserRepository`
2. **Bowltie** (`shared/Bowltie/v1/bowltie_ts`) — API response envelope; depends on Synapse error types
3. **Bugle** (`shared/Bugle/v1/bugle_ts`) — Google Auth and Drive permissions; no shared-lib dependencies

> The `shared/` directory is iterated in filesystem (alphabetical) order, which matches
> this build sequence. **Do not rename the library directories** without verifying the
> resulting build order.

---

## What the Scripts Do

Both scripts iterate every `shared/<LibraryName>/v*/` version directory in filesystem
(alphabetical) order. For each version directory they look for a `<lib_lower>_ts/`
subdirectory that contains a `package.json`. When found, the scripts perform:

1. Print a progress message: `Building shared/<LibraryName>/v<N>/<lib_lower>_ts/`
2. Run `npm install` to ensure dependencies are installed
3. Run `npm run build` to compile TypeScript to `dist/`

If any step fails, the script exits immediately with a non-zero exit code (Linux/macOS
`set -e` behaviour; Windows via `call` return codes).

> **Toolbox** (`shared/Toolbox`) has no `package.json` inside its `toolbox_ts/`
> directory and is automatically skipped by the build scripts. It is a plain TypeScript
> source collection imported directly by consuming services via a `tsconfig` path alias —
> no build or install step is required.

---

## Adding a New Shared Library

1. Create the new library directory under `shared/` following the structure defined in
   [Shared Library Standards](coding-standards/shared-libraries-standards.md) and
   [ADR-010](adr/ADR-010-shared-library-directory-architecture.md).
2. Create a `v1/` subdirectory and place the `<lib_lower>_ts/` and/or `<lib_lower>_py/`
   implementations inside it.
3. Add a `package.json` with a `build` script (e.g., `tsc`) inside `<lib_lower>_ts/`.
4. The build scripts will automatically pick up the new version directory on the next
   run — no changes to the scripts are required.
5. If the new library depends on another shared library, ensure its directory name sorts
   **after** its dependency in alphabetical order, or document the manual build order.

## Adding a New Major Version of an Existing Library

When a breaking change requires a new `v<N+1>/` directory (see
[ADR-010](adr/ADR-010-shared-library-directory-architecture.md) for the rules):

1. Create `shared/<LibraryName>/v<N+1>/` alongside the existing `v<N>/`.
2. Copy the contents of the current version directory as a starting point and apply
   the breaking changes.
3. The build scripts will discover and build the new version directory automatically.
4. Update consuming services to reference the new `v<N+1>/` path in their
   `package.json` or `requirements*.txt` files, one service at a time.

---

## Related Documents

- [Shared Library Standards](coding-standards/shared-libraries-standards.md) — how to develop and maintain shared libraries
- [ADR-010: Folder-Based Major-Version Directory Structure](adr/ADR-010-shared-library-directory-architecture.md) — architectural rationale for the `v<N>/` directory layer
- [Docker Orchestration](docker-orchestration.md) — using shared libraries inside Docker containers
- [Troubleshooting](troubleshooting.md#shared-library-build-issues) — common build issues and fixes

# Monorepo Scripts Reference

This document describes the root-level scripts available in the Elastic Resume Base repository.

---

## Available Scripts

| Script | Platform | Command | Description |
|---|---|---|---|
| `build_shared.bat` | Windows | `.\build_shared.bat` | Builds all shared TypeScript libraries under `shared/` in order |
| `build_shared.sh` | Linux / macOS | `./build_shared.sh` | Same as above, cross-platform |
| `start_firebase_emulators.bat` | Windows | `.\start_firebase_emulators.bat` | Starts the Firebase Emulator Suite and seeds the emulators with test data |
| `start_firebase_emulators.sh` | Linux / macOS | `./start_firebase_emulators.sh` | Same as above, cross-platform |

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

---

## Firebase Emulator Scripts

The `start_firebase_emulators.sh` (Linux / macOS) and `start_firebase_emulators.bat` (Windows) scripts provide a single command to launch the full Firebase Emulator Suite **and** automatically seed it with test data.

### When to Run

Run the firebase emulator scripts in the following situations:

- **During local development without Docker Compose** — when you want to run individual services directly (e.g., `npm run dev`) and still have a local Firestore, Auth, and Pub/Sub emulator available.
- **When you need pre-populated test data** — the scripts run a seeder after the emulators boot, creating sample records so you can exercise the full pipeline immediately.
- **When iterating on emulator configuration** — the scripts restart the emulators cleanly and re-seed on each invocation.

> **Note:** When running the stack via Docker Compose (`docker compose up`), the Firebase Emulator is already started as the `firebase-emulator` container. These root-level scripts are intended for running the emulators **outside** of Docker.

### What the Scripts Do

Both scripts perform the same two steps in parallel:

1. **Seeder (background):** Waits 45 seconds for the emulators to finish booting, then creates a Python virtual environment under `Scripts/emulator_scripts/venv/` (if one does not already exist), installs `google-cloud-pubsub` and `firebase-admin`, and runs `Scripts/emulator_scripts/seed_emulators.py` to populate Firestore and Pub/Sub with sample data.
2. **Emulators (foreground):** Changes into the `firebase_logs/` directory and runs `firebase emulators:start`, which reads `firebase.json` and starts Firestore, Auth, and Pub/Sub emulators. The emulator process blocks the terminal window until stopped.

On **Windows**, the seeder runs in a separate `cmd` window that can be closed once seeding completes. On **Linux / macOS**, the seeder runs as a background subshell (`&`) in the same terminal session.

### Prerequisites

- [Firebase CLI](https://firebase.google.com/docs/cli) installed and logged in (`firebase login`)
- A `firebase_logs/` directory at the repository root (created automatically by the Firebase CLI on first use, or you can create it manually: `mkdir firebase_logs`)
- Python 3.11+ available as `python3` (Linux / macOS) or `python` (Windows) for the seeder step

---

## Related Documents

- [Shared Library Standards](coding-standards/shared-libraries-standards.md) — how to develop and maintain shared libraries
- [ADR-010: Folder-Based Major-Version Directory Structure](adr/ADR-010-shared-library-directory-architecture.md) — architectural rationale for the `v<N>/` directory layer
- [Docker Orchestration](docker-orchestration.md) — using shared libraries inside Docker containers
- [Getting Started](getting-started.md) — full local development setup guide, including Firebase emulator usage
- [Troubleshooting](troubleshooting.md#shared-library-build-issues) — common build issues and fixes

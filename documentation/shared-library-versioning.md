# Shared Library Versioning Guide

This guide explains the versioning workflow for the shared libraries in `shared/`. It is
intended for both **library authors** (those who change a shared library) and **library
consumers** (those who work on services that depend on a shared library).

For the architectural decision behind this approach, see
[ADR-009](adr/ADR-009-shared-library-versioning.md).

---

## Overview

Every shared library carries a **semantic version** in:

- `package.json` (`"version"` field) — TypeScript libraries
- `pyproject.toml` (`version` field under `[project]`) — Python libraries

Every change to a shared library must be accompanied by a version bump and a
`CHANGELOG.md` entry in the same pull request.

---

## Semantic Versioning Rules

This project follows [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
(`MAJOR.MINOR.PATCH`):

| Change type | Bump | Example |
|---|---|---|
| New export, new optional parameter, new optional field — fully backward-compatible addition | **MINOR** | `1.0.0` → `1.1.0` |
| Bug fix, documentation update, internal refactor — no observable API change | **PATCH** | `1.0.0` → `1.0.1` |
| Removed export, renamed export, changed type signature, changed runtime behaviour | **MAJOR** | `1.0.0` → `2.0.0` |

> **Rule of thumb:** if a consuming service compiles and its tests pass without any code
> changes after the library update, it is at most a `MINOR` bump. If the consumer *must*
> change code to compile or pass tests, it is a `MAJOR` bump.

---

## Workflow for Library Authors

### 1. Make your change

Edit the source files in the library's `src/` (TypeScript) or inner package directory
(Python) as usual.

### 2. Bump the version

**TypeScript — edit `package.json`:**

```json
{
  "version": "1.1.0"
}
```

**Python — edit `pyproject.toml`:**

```toml
[project]
version = "1.1.0"
```

### 3. Update CHANGELOG.md

Add a new section at the top of the library's `CHANGELOG.md` (above the previous
release):

```markdown
## [1.1.0] — YYYY-MM-DD

### Added
- `newFunction(param: Type): ReturnType` — brief description.

### Changed
- `existingFunction` now accepts an optional `timeout` parameter (default: `5000` ms).

### Fixed
- Resolved a race condition in the singleton initialisation path.
```

Use these section headers as appropriate:

| Header | When to use |
|---|---|
| `### Added` | New exports, new optional parameters, new type aliases |
| `### Changed` | Changed default values, changed optional → required, changed return shape |
| `### Deprecated` | Exports that will be removed in the next major version |
| `### Removed` | Exports removed in this major version |
| `### Fixed` | Bug fixes |
| `### Security` | Vulnerability patches |
| `### Breaking Changes` | **Required** sub-section for any `MAJOR` bump |

### 4. Rebuild the library (TypeScript only)

```bash
cd shared/<LibraryName>/<lib_lower>_ts
npm run build
```

The updated `dist/` must be committed alongside the source changes so that consuming
services that do not run the build script locally are not broken.

### 5. Update consuming services (MAJOR bumps only)

If the bump is `MAJOR`, update every consuming service in the **same PR**:

- TypeScript services: fix any type errors and update imports.
- Python services: fix any import errors, update call sites, and re-run `pytest`.

List every affected service in the PR description alongside the breaking change summary.

---

## Workflow for Library Consumers

### Checking what changed

Before pulling new changes that touch a shared library, open the library's
`CHANGELOG.md` to understand what changed:

- `PATCH` bump → safe to adopt with no code changes.
- `MINOR` bump → safe to adopt; you may optionally use new APIs.
- `MAJOR` bump → **action required**: review `### Breaking Changes` and update your
  service's call sites.

### Adopting a MAJOR change

1. Read the `### Breaking Changes` section in the CHANGELOG entry for the new version.
2. Update the affected imports, call sites, and types in your service.
3. Run the service's tests: `npm test` (TypeScript) or `pytest` (Python).
4. If the breaking change was not covered by the library PR, open a follow-up PR against
   the branch that introduced the MAJOR bump.

---

## CHANGELOG format

Each `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

```markdown
# Changelog — <package-name>

All notable changes to this package are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this
package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- ...

---

## [1.1.0] — 2026-06-01

### Added
- ...

## [1.0.0] — 2024-01-01

### Added
- Initial public API.
```

Use an `## [Unreleased]` section to accumulate changes as you work. Convert it to a
dated release entry when you finalise the version bump.

---

## Library locations and package names

| Library | Language | Package name | CHANGELOG location |
|---|---|---|---|
| Aegis | TypeScript | `@elastic-resume-base/aegis` | `shared/Aegis/aegis_ts/CHANGELOG.md` |
| Bowltie | TypeScript | `@elastic-resume-base/bowltie` | `shared/Bowltie/bowltie_ts/CHANGELOG.md` |
| Bowltie | Python | `elastic-resume-base-bowltie` | `shared/Bowltie/bowltie_py/CHANGELOG.md` |
| Bugle | TypeScript | `@elastic-resume-base/bugle` | `shared/Bugle/bugle_ts/CHANGELOG.md` |
| Harbor | TypeScript | `@elastic-resume-base/harbor` | `shared/Harbor/harbor_ts/CHANGELOG.md` |
| Harbor | Python | `elastic-resume-base-harbor` | `shared/Harbor/harbor_py/CHANGELOG.md` |
| Hermes | TypeScript | `@elastic-resume-base/hermes` | `shared/Hermes/hermes_ts/CHANGELOG.md` |
| Hermes | Python | `elastic-resume-base-hermes` | `shared/Hermes/hermes_py/CHANGELOG.md` |
| Synapse | TypeScript | `@elastic-resume-base/synapse` | `shared/Synapse/synapse_ts/CHANGELOG.md` |
| Toolbox | TypeScript | *(plain source, no package name)* | `shared/Toolbox/toolbox_ts/CHANGELOG.md` |
| Toolbox | Python | `elastic-resume-base-toolbox` | `shared/Toolbox/toolbox_py/CHANGELOG.md` |

---

## Related Documents

- [ADR-009: Semantic Versioning and CHANGELOG for Shared Libraries](adr/ADR-009-shared-library-versioning.md)
- [Shared Libraries Coding Standards](coding-standards/shared-libraries-standards.md)
- [Monorepo Scripts](monorepo-scripts.md)

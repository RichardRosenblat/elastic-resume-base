# ADR-010: Folder-Based Major-Version Directory Structure for Shared Libraries

**Date:** 2026-04-01  
**Status:** Accepted

---

## Context

The Elastic Resume Base monorepo contains seven shared libraries (Aegis, Bowltie, Bugle,
Harbor, Hermes, Synapse, Toolbox) consumed by multiple Node.js and Python services.
Under the original layout introduced in [ADR-001](ADR-001-monorepo-structure.md), the
directory structure for each library was flat:

```
shared/
└── <LibraryName>/
    ├── <lib_lower>_ts/   # TypeScript implementation
    └── <lib_lower>_py/   # Python implementation
```

Consumers referenced libraries at this flat path (e.g.
`file:../../shared/Bowltie/bowltie_ts` for npm,
`-e ../../shared/Bowltie/bowltie_py` for pip).

As the libraries matured, a recurring problem emerged around **major version
evolution**. Under the flat layout:

- A breaking change to a shared library (renamed export, changed type signature,
  removed function) must be adopted by every consuming service in the same pull
  request. While this rule remains in effect for MINOR/PATCH bumps, it is especially
  costly for MAJOR bumps where different services may need different migration timelines.
- There is no physical separation between the previous and the new API surface, making
  side-by-side testing during a major migration impossible within the monorepo.
- The directory path itself gives no hint of the API generation a consumer is using,
  making it harder to reason about compatibility at a glance.
- Both the TypeScript and Python implementations of the same logical library lived at the
  same directory level without a grouping layer, making the layout harder to navigate as
  additional language implementations are added.

A lightweight structural convention — introducing a `v<N>/` directory layer — resolves
all of the above at near-zero operational overhead and without requiring an external
package registry.

## Decision

Every shared library directory is structured as follows:

```
shared/
└── <LibraryName>/
    └── v<N>/
        ├── <lib_lower>_ts/   # TypeScript implementation (if it exists)
        │   ├── src/
        │   ├── dist/
        │   ├── tests/
        │   ├── package.json
        │   ├── tsconfig.json
        │   └── CHANGELOG.md
        └── <lib_lower>_py/   # Python implementation (if it exists)
            ├── <lib_lower>_py/   # Importable package directory
            ├── tests/
            ├── pyproject.toml
            └── CHANGELOG.md
```

The current major version is **v1**. The `v<N>/` segment represents the **major API
generation** of the library, not the semantic patch/minor version tracked inside
`package.json` / `pyproject.toml` (which continues to follow the rules defined in
[ADR-009](ADR-009-shared-library-versioning.md)).

### Key rules

**1. Version directories are immutable once published internally.**  
Once a `v1/` directory exists and is consumed by at least one service, its public API
(`src/index.ts` or `<lib>_py/__init__.py`) must not be broken. Breaking changes are
introduced by creating a new `v2/` directory alongside the existing `v1/`.

**2. A new `v<N+1>/` directory is only created for a breaking major API change.**  
Adding a new export or fixing a bug is handled with a `MINOR` or `PATCH` semantic version
bump inside the existing `v<N>/` directory. A new version directory is not created merely
because the internal semantic version was bumped to `2.x`.

**3. Multiple version directories may coexist.**  
`v1/` and `v2/` may exist simultaneously under the same library name. Each consuming
service opts in to a migration by updating its import path from `v1/` to `v2/`. Both
versions are supported until every consumer has migrated, at which point the older
version directory may be archived or removed in a dedicated clean-up PR.

**4. Language implementations are co-located under the same version directory.**  
The TypeScript (`_ts`) and Python (`_py`) implementations of the same logical library
share a `v<N>/` parent. This ensures they always refer to the same conceptual API
generation.

**5. Build scripts iterate `v*/` subdirectories.**  
`build_shared_scripts/build_shared_typescript.sh` (and the Windows equivalent) iterate
`shared/<LibraryName>/v*/` and build every `<lib_lower>_ts/` subdirectory that contains
a `package.json`. No changes to the build scripts are required when a new `v<N+1>/`
directory is added.

**6. Consumer references include the version segment.**  
TypeScript services declare dependencies using:

```json
"@elastic-resume-base/bowltie": "file:../../shared/Bowltie/v1/bowltie_ts"
```

Python services declare development dependencies using:

```
-e ../../shared/Bowltie/v1/bowltie_py
```

and production dependencies using:

```
../../shared/Bowltie/v1/bowltie_py
```

### Library inventory

| Library | TypeScript | Python | Current version directory |
|---------|-----------|--------|--------------------------|
| Aegis | ✅ | — | `shared/Aegis/v1/aegis_ts` (v1), `shared/Aegis/v2/aegis_ts` (v2, active) |
| Bowltie | ✅ | ✅ | `shared/Bowltie/v1/bowltie_ts`, `shared/Bowltie/v1/bowltie_py` |
| Bugle | ✅ | ✅ | `shared/Bugle/v1/bugle_ts`, `shared/Bugle/v1/bugle_py` |
| Harbor | ✅ | ✅ | `shared/Harbor/v1/harbor_ts`, `shared/Harbor/v1/harbor_py` (v1), `shared/Harbor/v2/harbor_ts` (v2, active) |
| Hermes | ✅ | ✅ | `shared/Hermes/v1/hermes_ts`, `shared/Hermes/v1/hermes_py` |
| Synapse | ✅ | ✅ | `shared/Synapse/v1/synapse_ts`, `shared/Synapse/v1/synapse_py` |
| Toolbox | ✅ | ✅ | `shared/Toolbox/v1/toolbox_ts`, `shared/Toolbox/v1/toolbox_py` |

## Alternatives Considered

**Keep the flat layout (status quo):** No `v<N>/` layer is introduced. Breaking changes
to a shared library must be absorbed by all consumers in a single pull request.
Rejected because it makes parallel multi-service migrations impossible and obscures the
API generation from the directory path alone.

**Encode the major version in the package name:** For example,
`@elastic-resume-base/bowltie-v2` or `elastic-resume-base-bowltie-v2`. This approach is
used in some public ecosystems but is problematic in a monorepo because the package name
appears in imports throughout every consuming service, requiring a global search-and-replace
for every major bump. A path segment change is a more localised update.

**Use git tags or branches per major version:** A `bowltie/v2` git branch holds the v2
source. Consumers would reference it via a git URL. Rejected because it requires network
access during installation, cannot be used for Python with pip local paths, and splits
history across multiple branches, complicating code review.

**npm workspaces / pnpm workspaces with range pinning:** A workspace protocol (e.g.
`workspace:^1.0.0`) could manage compatibility automatically. Rejected because migrating
all services to a single workspace manifest is a large one-time effort with no net benefit
at the current team size. The decision may be revisited once the project scales.

## Consequences

**Easier:**

- Consuming services can migrate to a new major version of a shared library
  incrementally, one service at a time, while the old version continues to work for
  services that have not yet migrated.
- The directory path (`v1/`, `v2/`) makes the API generation immediately visible in
  imports and `requirements.txt` files, aiding code review.
- Adding a new language implementation (e.g., a future Go `_go/` directory) under an
  existing `v<N>/` parent requires no structural changes to the build scripts.
- The build scripts automatically discover new version directories without modification.

**Harder:**

- When a new `v<N+1>/` directory is created, maintainers must keep two versions in sync
  for any bug fixes that affect both generations until all consumers have migrated.
- The full path to a shared library is slightly longer, which increases the verbosity of
  `package.json` dependency entries and `requirements*.txt` files.
- Contributors must understand the distinction between the folder-level major version
  (`v1/`) and the semantic version tracked in `package.json` / `pyproject.toml` to avoid
  confusion (see [ADR-009](ADR-009-shared-library-versioning.md)).

**Follow-on:**

- When the first breaking change to any library is introduced, a `v2/` directory will be
  created following the rules above, and this ADR will serve as the canonical reference
  for that process.
- A linting rule or CI check may be added in the future to verify that consumer import
  paths reference an existing `v<N>/` directory and do not accidentally skip to a version
  that does not yet exist.
- See [Shared Library Standards](../coding-standards/shared-libraries-standards.md) and
  [Shared Library Versioning Guide](../shared-library-versioning.md) for the day-to-day
  workflow.

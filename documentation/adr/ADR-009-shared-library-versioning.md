# ADR-009: Semantic Versioning and CHANGELOG for Shared Libraries

**Date:** 2026-03-28  
**Status:** Accepted

---

## Context

The Elastic Resume Base monorepo contains seven shared libraries (Aegis, Bowltie, Bugle,
Harbor, Hermes, Synapse, Toolbox) consumed by multiple services. Under the initial approach
documented in [ADR-001](ADR-001-monorepo-structure.md), shared libraries carried no
independent version identifier and all consumers were expected to track the monorepo
`HEAD` at all times.

This approach proved adequate for early-stage development, but introduces **update
coupling** as the project grows:

- A single breaking change to a shared library forces every consuming service to be
  updated in the same pull request.
- Contributors cannot reason about *what changed* between two points in time without
  reading the full Git history for the library directory.
- Services cannot opt out of a breaking change, even temporarily, to maintain stability
  while their own update is prepared.
- There is no machine-readable signal that distinguishes backward-compatible additions
  from breaking changes.

A lightweight versioning discipline — without requiring an external package registry —
addresses all of the above at near-zero operational overhead.

## Decision

Each shared library in `shared/` is assigned an explicit **semantic version** tracked in
its `package.json` (TypeScript) and/or `pyproject.toml` (Python). Every change to a
shared library is accompanied by:

1. A **version bump** in `package.json` / `pyproject.toml` following
   [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html) rules.
2. An entry in the library's **`CHANGELOG.md`** (following
   [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)) that describes what was
   added, changed, deprecated, removed, fixed, or secured.

Services continue to reference shared libraries through local file paths
(`file:../shared/X/x_ts` for npm, editable local paths for pip). They receive library
updates when the monorepo is rebased or merged — not automatically. The version number
and CHANGELOG give consumers the information they need to assess the impact of each
update and prepare their own changes accordingly.

**Versioning rules:**

| Change type | Version bump |
|---|---|
| New export, new optional field, new overload — fully backward-compatible | `MINOR` (1.1.0) |
| Bug fix, internal refactor, documentation update — no API change | `PATCH` (1.0.1) |
| Removed export, renamed export, changed type signature, changed runtime behaviour | `MAJOR` (2.0.0) |

**MAJOR version bumps require:**

- The PR description must explicitly list every breaking change.
- All consuming services in the monorepo must be updated in the same PR so that
  `HEAD` is always self-consistent.
- The CHANGELOG entry must use a `### Breaking Changes` sub-section.

## Alternatives Considered

**No versioning (status quo):** Changes are visible only through Git history. Rejected
because it provides no structured signal about compatibility, making it hard for
contributors to assess the impact of an upstream library change on the service they are
working on.

**Private npm / PyPI registry:** Each library is published to an internal registry and
consumed as a normal versioned dependency. This provides the strongest decoupling but
requires significant infrastructure (registry hosting, CI publishing pipeline, token
management). Rejected at this stage because the overhead outweighs the benefit while the
team and service count remain small. This option can be revisited once the project
scales. See [ADR-001](ADR-001-monorepo-structure.md) for the original rationale.

**npm workspaces / pnpm workspaces:** A workspace protocol (e.g. `workspace:^1.0.0`)
could give version resolution within the monorepo. Rejected because it would require
migrating all services to a single workspace manifest, which is a large one-time
migration with no clear benefit over file-path references at the current scale.

**Git-tag-based references:** Services could pin to a specific Git tag
(e.g. `github:org/repo#semver:1.2.0`). Rejected because it would introduce network
dependencies into local development flows and cannot be used for Python libraries with
pip.

## Consequences

**Easier:**

- Contributors can read a library's `CHANGELOG.md` to understand what changed and
  whether the update requires changes in their service.
- The semantic version communicates compatibility at a glance: a `PATCH` bump is
  safe to adopt without code changes; a `MAJOR` bump signals required action.
- Code review can check that version bumps are correct (no undocumented breaking changes
  hiding behind a `MINOR` bump).
- Future migration to a private registry is straightforward: the version numbers and
  CHANGELOGs are already in place.

**Harder:**

- Library authors must remember to bump the version and update the CHANGELOG in every
  PR that touches a shared library.
- Breaking changes still require all consumers to be updated in the same PR (monorepo
  constraint). The difference is that the CHANGELOG now *documents* that requirement
  explicitly.

**Follow-on:**

- A linting rule or CI check may be added in the future to enforce that PRs touching
  `shared/*/` always include a version bump and a CHANGELOG entry.
- See [Shared Library Versioning Guide](../shared-library-versioning.md) for the
  step-by-step workflow for library authors and consumers.

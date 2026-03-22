# Configuring CI Tests

This document explains how the `PR Tests` GitHub Actions workflow works and how to configure it.

## Overview

The workflow (`pr-tests.yml`) runs automatically on every pull request that targets `main`. It
detects which packages were changed, runs their Jest test suites in parallel, collects coverage
data, and posts a rich summary as both a GitHub Actions step summary and a sticky PR comment.

The check is permanently **non-blocking** in its default `informational` mode — it never prevents
a PR from being merged. Switch to `strict` mode to enforce test passage (see below).

---

## Architecture

```
pull_request / workflow_dispatch
        │
        ▼
┌──────────────────────┐
│   detect-changes     │  reads test-packages.json, diffs against base commit,
│                      │  expands to dependents, emits matrix JSON
└──────────┬───────────┘
           │  matrix
           ▼
┌──────────────────────┐  (one parallel job per package)
│   test (matrix)      │  npm ci → jest --coverage --testRetries=1 → upload artifacts
└──────────┬───────────┘
           │  artifacts
           ▼
┌──────────────────────┐
│   summarize          │  downloads artifacts, builds Markdown summary,
│                      │  writes to step summary, updates PR comment
└──────────────────────┘
```

---

## Adding or Removing a Package

Edit `.github/ci-config/test-packages.json`. Each entry has:

| Field       | Type             | Description                                                  |
|-------------|------------------|--------------------------------------------------------------|
| `id`        | `string`         | Short identifier used for artifact names (no spaces/slashes) |
| `name`      | `string`         | Display name shown in the summary table                       |
| `path`      | `string`         | Path to the package root relative to the repo root           |
| `dependsOn` | `string[]`       | IDs of packages this one depends on (drives the dep-graph)   |

**Example — adding a new package:**

```json
{
  "id": "my-lib",
  "name": "shared/MyLib",
  "path": "shared/MyLib",
  "dependsOn": []
}
```

**Dependency graph:** if `dependsOn` lists another package's ID, changing that upstream package
will automatically include this package in the test matrix even if no files in this package
itself changed. Propagation is transitive.

---

## Running Modes

### Informational (default)
`continue-on-error: true` is set on every test job. The workflow **never** marks the PR check
as failed, regardless of test results. Use this during initial adoption or when tests are known
to be flaky.

### Strict
Set `mode: strict` when triggering via `workflow_dispatch`, or update the workflow default to
make it strict for all PR runs. In strict mode the `summarize` job exits with code `1` if any
tests fail, causing the overall workflow check to fail.

---

## Workflow Dispatch Inputs

Trigger the workflow manually from **Actions → PR Tests → Run workflow**:

| Input           | Default         | Description                                                  |
|-----------------|-----------------|--------------------------------------------------------------|
| `mode`          | `informational` | `informational` = never fail \| `strict` = fail on test failure |
| `all_packages`  | `false`         | `true` = skip change detection and run all packages          |

---

## Skipping Tests

Add `[skip tests]` anywhere in the commit message of the latest commit on the branch:

```
fix: update README [skip tests]
```

The entire test matrix is skipped and the summary will show "No tests were run for this change."

---

## Change Detection

On every `pull_request` event, the workflow computes which packages have changed by running:

```bash
git diff --name-only <base-commit-sha>...HEAD
```

Only packages whose source files appear in the diff are tested. Additionally, any package that
`dependsOn` a changed package (transitively) is also included.

If change detection fails (e.g. shallow clone, network issue), the workflow falls back to
running **all packages**.

---

## Flaky Test Detection

Each failed test is **automatically retried once** (`--testRetries=1`). A test must fail on both
attempts to count as a real failure. This prevents intermittent infrastructure issues from
generating false-positive failures.

If a test passes on retry, it still appears in the Jest output as a retry, but does not
increment `numFailedTests`.

---

## Coverage Reporting

Jest runs with `--coverage --coverageReporters=json-summary`. The coverage summary is uploaded
as part of the test artifacts and shown in the summary table with three metrics:

| Column       | Meaning                                    |
|--------------|--------------------------------------------|
| 📝 Lines      | % of source lines executed by tests        |
| 🌿 Branches   | % of conditional branches executed         |
| 🔧 Functions  | % of functions/methods called by tests     |

**Color coding:**
- 🟢 ≥ 80% — healthy coverage
- 🟡 50–79% — acceptable, worth improving
- 🔴 < 50% — low coverage, consider adding tests

Coverage thresholds are **not enforced** by default. To fail the check on low coverage, add a
`coverageThreshold` block to the package's `jest.config.cjs`:

```js
// jest.config.cjs
module.exports = {
  // ...existing config...
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 70,
      functions: 80,
    },
  },
};
```

---

## Artifacts

Every test run uploads the following per-package artifacts (downloadable from the Actions UI):

| Artifact file                       | Contents                              |
|-------------------------------------|---------------------------------------|
| `<id>-results.json`                 | Full Jest JSON output                 |
| `<id>.log`                          | Combined stdout + stderr from Jest    |
| `<id>-coverage-summary.json`        | Jest coverage summary (totals + files)|

---

## PR Comment

After all tests complete, a sticky comment is posted on the PR with the full summary table.
On subsequent runs, the **same comment is updated** (no spam). The comment includes:

- Commit SHA and run timestamp
- Per-package status, pass rate, duration, and coverage
- A highlighted "Failed Packages" section when there are failures
- Mode indicator (informational / strict)

---

## Keeping Action Versions Updated

Action versions are pinned to major tags (`@v4`). Dependabot monitors them automatically.
To pin to an exact SHA for security-sensitive workflows, replace the tag with the full SHA of
the latest release and add a comment with the version.

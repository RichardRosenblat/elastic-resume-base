# GitHub Labels Reference

## Overview

Labels are used to categorize and organize issues and pull requests in this repository. They make it easy to:

- **Filter** issues by type, priority, area, or status at a glance
- **Prioritize** work across the team by surfacing the most urgent or impactful items
- **Communicate** the nature and scope of work without reading every issue in full
- **Track** progress and identify blockers or stale work quickly

Labels are defined in [`.github/labels.yml`](../.github/labels.yml) and synced automatically via the [Setup Labels workflow](../.github/workflows/setup-labels.yml) whenever that file changes.

---

## Label Categories

### 🧩 Type Labels

Describe **what kind of work** the issue represents. Every issue must have exactly one primary Type label. The `internal` label is a special modifier that can be added alongside another Type label to indicate the work is internal-only (e.g., `task` + `internal`).

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `enhancement` | New feature or request |
| `task` | General engineering task |
| `internal` | Internal-only work (dev tasks, TODOs) — can be combined with another Type label |
| `documentation` | Docs improvements |
| `question` | Further information is requested |

---

### 🚨 Priority Labels

Describe **how urgent** the issue is. Every issue must have exactly one Priority label.

| Label | Description |
|-------|-------------|
| `priority:high` | Urgent, should be addressed soon |
| `priority:medium` | Normal priority |
| `priority:low` | Low priority, can wait |

---

### 🧱 Area Labels

Describe **which part of the codebase** is affected. Every issue must have exactly one Area label.

| Label | Description |
|-------|-------------|
| `area:web` | Frontend (React) |
| `area:api` | Backend API (NestJS / BFF) |
| `area:worker` | Python services |
| `area:shared` | Shared packages |
| `area:infra` | Infrastructure / CI / config |

---

### ⚙️ Work Type Labels

Describe **the nature of the work** being done. These are optional and can be combined with other labels.

| Label | Description |
|-------|-------------|
| `tech-debt` | Improvements to existing code |
| `refactor` | Code restructuring without behavior change |
| `performance` | Performance improvements |
| `security` | Security-related work |

---

### 🤝 Process Labels

Describe **status or meta information** about an issue. Apply these as needed to communicate current state.

| Label | Description |
|-------|-------------|
| `good first issue` | Suitable for beginners |
| `help wanted` | Needs additional attention |
| `blocked` | Cannot proceed due to dependency |
| `needs-info` | Missing required information |
| `duplicate` | Already exists |
| `invalid` | Not a valid issue |
| `wontfix` | Will not be worked on |

---

## Usage Rules

### Required Labels

Every issue **must** have:

- **1 primary Type label** — What kind of issue is this? (`bug`, `enhancement`, `task`, etc.)
- **1 Priority label** — How urgent is it? (`priority:high`, `priority:medium`, `priority:low`)
- **1 Area label** — Which part of the system is affected? (`area:web`, `area:api`, etc.)

> **Note:** The `internal` label can be added alongside another Type label (e.g., `task` + `internal`) to indicate the work is internal-only.

### Optional Labels

Apply these when relevant:

- **Work Type labels** — Use `tech-debt`, `refactor`, `performance`, or `security` when the work fits one of those categories
- **Process labels** — Use `blocked`, `needs-info`, `help wanted`, etc. to reflect current status

---

## Examples

### Example 1: Bug in the Frontend

A user reports that the resume preview page crashes on mobile.

**Labels:**
- `bug`
- `priority:high`
- `area:web`

---

### Example 2: API Refactor

The team wants to clean up the user authentication module in the BFF without changing behavior.

**Labels:**
- `task`
- `internal`
- `area:api`
- `refactor`
- `priority:medium`

---

### Example 3: Tech Debt in Shared Packages

The shared utilities package has outdated utility functions that need to be updated.

**Labels:**
- `task`
- `tech-debt`
- `area:shared`
- `priority:low`

---

### Example 4: Security Issue

A dependency in the workers package has a known vulnerability.

**Labels:**
- `bug`
- `security`
- `priority:high`
- `area:worker`

---

## Best Practices

- **Avoid over-labeling.** Apply only labels that add useful information. More is not always better.
- **Keep labels consistent.** Stick to the defined categories. Don't invent new labels without updating this document and `.github/labels.yml`.
- **Use labels to enable filtering.** The value of labels is in being able to filter and prioritize issues quickly. Apply them thoughtfully.
- **Prefer clarity over quantity.** One well-chosen label is more useful than five vague ones.
- **Update process labels as status changes.** If an issue is no longer `blocked`, remove that label.
- **Review labels during triage.** Labels should be reviewed and updated during issue triage to ensure they remain accurate.

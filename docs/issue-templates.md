# Issue Templates Guide

This document describes each issue template available in this repository, when to use it, and how to fill it in correctly.

Issue templates are located in [`.github/ISSUE_TEMPLATE/`](../.github/ISSUE_TEMPLATE/). When opening a new issue on GitHub, you will be prompted to choose one of these templates.

For guidance on which labels to apply after choosing a template, see the [Labels Reference](./labels.md). New to the project? See the [Getting Started guide](./getting-started.md) first.

---

## Templates at a Glance

| Template | Title prefix | Default labels | Use when… |
|----------|-------------|----------------|-----------|
| [Bug Report](#-bug-report) | `[BUG]` | `bug` | Something is broken or not behaving as expected |
| [Feature Request](#-feature-request) | `[FEATURE]` | `enhancement` | You want to propose a new feature or improvement |
| [Tech Task](#-tech-task) | `[TASK]` | `task` | Engineering work with no visible user impact |
| [Dev To-Do](#-dev-to-do) | `[TODO]` | `task`, `internal` | A small internal reminder or developer chore |

---

## 🐛 Bug Report

**Template file:** `bug_report.md`  
**Default labels:** `bug`

### When to use it

Use **Bug Report** when something that previously worked (or is expected to work) is broken, returning incorrect results, or behaving unexpectedly. This includes:

- Application crashes or unhandled errors
- API endpoints returning wrong status codes or unexpected payloads
- UI elements not rendering or functioning correctly
- Data being saved or loaded incorrectly
- Regressions introduced by a recent change

### When *not* to use it

- If the behaviour is technically working but could be better → use **Feature Request** instead
- If you need to investigate whether something is actually a bug → open a **Dev To-Do** to track the investigation first

### Filling it in

| Field | What to write |
|-------|--------------|
| **Title** | `[BUG] Short description of the problem` |
| **Description** | One or two sentences explaining the broken behaviour |
| **Steps to Reproduce** | Numbered steps that reliably reproduce the issue |
| **Expected Behavior** | What should happen |
| **Actual Behavior** | What actually happens |
| **Logs / Screenshots** | Paste relevant error logs, stack traces, or screenshots |
| **Environment** | Which service and environment (dev / staging / production) |

### Suggested additional labels

- Add a `priority:*` label to indicate urgency
- Add an `area:*` label to indicate the affected part of the system
- Add `security` if the bug has security implications

---

## ✨ Feature Request

**Template file:** `feature_request.md`  
**Default labels:** `enhancement`

### When to use it

Use **Feature Request** when you want to propose something new or suggest a meaningful improvement to existing functionality. This includes:

- New user-facing features or screens
- New API endpoints or extensions to existing ones
- Integrations with external services
- UX or workflow improvements that require engineering work

### When *not* to use it

- If the work is purely internal with no user-visible impact (e.g., a refactor or infra change) → use **Tech Task** instead
- If it is a small developer chore → use **Dev To-Do** instead

### Filling it in

| Field | What to write |
|-------|--------------|
| **Title** | `[FEATURE] Short description of the feature` |
| **Problem** | The gap or limitation that motivates this request |
| **Proposed Solution** | What you would like to see built |
| **Alternatives** | Other approaches considered and why they were ruled out |
| **Impact** | Which services are affected; whether the change is breaking |

### Suggested additional labels

- Add a `priority:*` label to indicate urgency
- Add an `area:*` label to indicate the affected part of the system
- Add `performance` if the feature is primarily a performance improvement

---

## ⚙️ Tech Task

**Template file:** `tech_task.md`  
**Default labels:** `task`

### When to use it

Use **Tech Task** for planned engineering work that is internally motivated and does not directly introduce a new user-facing feature or fix a bug. This includes:

- Refactoring a module or service
- Updating or migrating infrastructure (CI pipelines, Docker configs, cloud resources)
- Adding or updating API endpoints as part of a planned initiative
- Upgrading dependencies
- Improving observability (logging, metrics, tracing)
- Addressing technical debt

### When *not* to use it

- If you are fixing a broken behaviour → use **Bug Report** instead
- If the task is a tiny, informal reminder just for yourself → use **Dev To-Do** instead

### Filling it in

| Field | What to write |
|-------|--------------|
| **Title** | `[TASK] Short description of the task` |
| **Description** | What needs to be done and why |
| **Technical Details** | APIs/endpoints affected, data changes, and dependencies |
| **Dependencies / Related Issues** | Link to any blockers or related issues |
| **Acceptance Criteria** | Checklist of conditions that define "done" |

### Suggested additional labels

- Add a `priority:*` label to indicate urgency
- Add an `area:*` label to indicate the affected part of the system
- Add `refactor`, `tech-debt`, or `performance` to clarify the nature of the work
- Add `internal` if the task is not visible to end users

---

## 📝 Dev To-Do

**Template file:** `dev_todo.md`  
**Default labels:** `task`, `internal`

### When to use it

Use **Dev To-Do** for small, informal, developer-facing reminders or chores that do not warrant a full Tech Task. This includes:

- A note to investigate a potential issue before deciding if it's a real bug
- A reminder to clean up a temporary workaround
- A small TODO that was left in the code and needs to be tracked
- Internal housekeeping items (e.g., removing debug flags, updating local config docs)

### When *not* to use it

- If the task involves meaningful engineering effort → use **Tech Task** instead
- If you already know something is broken → use **Bug Report** instead
- If you are proposing new functionality → use **Feature Request** instead

### Filling it in

| Field | What to write |
|-------|--------------|
| **Title** | `[TODO] Short description of the reminder` |
| **Summary** | A one-liner describing what needs to be done |
| **Goal** | What outcome is expected when this is resolved |
| **Scope** | Checklist of subtasks or items to address |
| **Context** | Background or links that give context |
| **Risks / Notes** | Edge cases or things to watch out for |
| **Acceptance Criteria** | Checklist of conditions that define "done" |

### Suggested additional labels

- Add a `priority:*` label — most Dev To-Dos are `priority:low`
- Add an `area:*` label to indicate the affected part of the system

---

## Choosing the Right Template — Quick Decision Guide

```
Is something broken or not working as expected?
  └─ Yes → Bug Report 🐛

Is this a new feature or a meaningful improvement for users?
  └─ Yes → Feature Request ✨

Is this planned engineering work (refactor, infra, tech debt)?
  └─ Yes → Tech Task ⚙️

Is this a small internal reminder or developer chore?
  └─ Yes → Dev To-Do 📝
```

---

## Tips

- **Always set a priority label** (`priority:high`, `priority:medium`, or `priority:low`) after opening an issue.
- **Always set an area label** (`area:web`, `area:api`, `area:worker`, `area:shared`, or `area:infra`) to indicate which part of the system is affected.
- **Keep the title concise.** The prefix (`[BUG]`, `[FEATURE]`, etc.) is already added by the template — just append a short description.
- **Link related issues** in the body using `#<issue-number>` so GitHub automatically cross-references them.
- **If unsure which template to use**, start with the closest match and adjust the labels accordingly.

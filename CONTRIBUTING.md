# Contributing to Elastic Resume Base

Thank you for your interest in contributing! This document provides guidelines for contributing to the Elastic Resume Base project to help maintain a consistent, high-quality codebase.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Branch Naming](#branch-naming)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Reporting Issues](#reporting-issues)
- [Security Vulnerabilities](#security-vulnerabilities)

---

## Code of Conduct

By contributing to this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating. Harassment, discrimination, or dismissive behavior of any kind will not be tolerated.

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/elastic-resume-base.git
   cd elastic-resume-base
   ```
3. **Set up** the development environment following the [Getting Started](README.md#getting-started) section in the README.
4. **Create a branch** for your change (see [Branch Naming](#branch-naming)).

---

## Development Workflow

1. Make your changes on a dedicated feature/fix branch.
2. Write or update tests to cover your changes.
3. Run the linter, formatter, and type checker for the relevant service.
4. Run the test suite and ensure all tests pass.
5. Commit your changes following the [Commit Messages](#commit-messages) guidelines.
6. Push your branch to your fork and open a Pull Request.

### Running checks locally

**Node.js (Gateway API):**
```bash
cd apps/gateway-api
npm run lint
npm run format:check
npm run typecheck
npm test
```

**Python (any microservice):**
```bash
cd <service-directory>
black --check app/ tests/
ruff check app/ tests/
mypy app/
pytest tests/ --cov=app --cov-report=term-missing
```

---

## Branch Naming

Use the following naming convention for branches:

| Type | Pattern | Example |
|---|---|---|
| New feature | `feat/<short-description>` | `feat/add-resume-search-endpoint` |
| Bug fix | `fix/<short-description>` | `fix/auth-token-expiry-handling` |
| Documentation | `docs/<short-description>` | `docs/update-setup-guide` |
| Refactoring | `refactor/<short-description>` | `refactor/extract-pubsub-client` |
| Chore / tooling | `chore/<short-description>` | `chore/upgrade-node-20` |
| Hotfix | `hotfix/<short-description>` | `hotfix/fix-critical-auth-bypass` |

---

## Commit Messages

This project follows the **[Conventional Commits](https://www.conventionalcommits.org/)** specification.

### Format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting changes (no logic change) |
| `refactor` | Code refactoring (no feature or bug change) |
| `test` | Adding or updating tests |
| `chore` | Build tooling, dependency updates, config changes |
| `perf` | Performance improvements |
| `ci` | CI/CD pipeline changes |

### Examples

```
feat(gateway-api): add resume search endpoint with pagination

fix(ai-worker): handle empty Vertex AI response gracefully

docs: update docker-compose usage instructions

chore(deps): upgrade firebase-admin to 12.1.0
```

### Rules

- Use the **imperative mood** in the summary (`add`, not `added` or `adds`).
- Keep the summary under **72 characters**.
- Reference related issues in the footer: `Closes #42` or `Refs #17`.
- Break apart unrelated changes into separate commits.

---

## Pull Request Process

1. **Title:** Use the Conventional Commits format (e.g., `feat(search-base): implement FAISS index rebuild`).
2. **Description:** Explain *what* changed, *why* it changed, and any relevant context. Link to the related issue.
3. **Size:** Keep PRs small and focused. Large PRs are harder to review. Split unrelated changes into separate PRs.
4. **Tests:** Every PR that modifies logic must include corresponding tests. PRs that reduce code coverage will not be merged.
5. **Review:** At least one approval from a maintainer is required before merging.
6. **CI:** All automated checks (lint, type-check, tests) must pass before a PR can be merged.
7. **Conflicts:** Rebase your branch on `main` and resolve all conflicts before requesting a review.

### PR Checklist

Before submitting a PR, confirm the following:

- [ ] My code follows the [coding standards](documentation/coding-standards/) for the relevant language.
- [ ] I have added or updated tests for my changes.
- [ ] All existing tests pass locally.
- [ ] I have updated relevant documentation if needed.
- [ ] No secrets, credentials, or PII have been committed.
- [ ] My commits follow the Conventional Commits format.

---

## Coding Standards

Refer to the language-specific coding standards documents for detailed guidelines:

- [Python Coding Standards](documentation/coding-standards/python-coding-standards.md)
- [Node.js Coding Standards](documentation/coding-standards/nodejs-coding-standards.md)

---

## Reporting Issues

When opening an issue, please:

1. **Search** existing issues first to avoid duplicates.
2. **Use a clear title** that describes the problem or feature.
3. **Provide context:**
   - For bugs: steps to reproduce, expected behavior, actual behavior, and your environment (OS, Node.js/Python version, Docker version).
   - For features: the problem it solves, any alternatives considered, and acceptance criteria.
4. **Include logs** if relevant, but **redact any PII or credentials** before pasting log output.

---

## Security Vulnerabilities

Do **not** open a public GitHub issue for security vulnerabilities. Please follow the [Security Policy](SECURITY.md) for responsible disclosure.

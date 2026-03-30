# Security Policy

This document describes the security posture of the Elastic Resume Base project and outlines the process for reporting security vulnerabilities.

---

## Table of Contents

- [Supported Versions](#supported-versions)
- [Security Architecture](#security-architecture)
- [Data Privacy](#data-privacy)
- [Reporting a Vulnerability](#reporting-a-vulnerability)
- [Responsible Disclosure](#responsible-disclosure)
- [Security Best Practices for Contributors](#security-best-practices-for-contributors)

---

## Supported Versions

Security patches are applied to the **latest version** of the `main` branch only. Older branches are not actively patched.

| Branch | Supported |
|---|---|
| `main` | ✅ Active |
| Feature branches | ❌ Not supported |

---

## Security Architecture

The Elastic Resume Base platform is designed with security as a first-class concern. The following measures are in place:

### Authentication and Authorization

- All user authentication is handled via **Firebase Auth with Google SSO**. No custom credential storage is implemented.
- Every request to the BFF Gateway is authenticated by verifying a **Firebase ID Token** using the Firebase Admin SDK.
- Services communicate internally via authenticated service-to-service calls within the Cloud Run environment.

### Data Encryption

- **In transit:** All traffic between clients and the BFF Gateway, and between services, is encrypted using **TLS 1.2+**.
- **At rest:** All Personally Identifiable Information (PII) stored in Firestore is encrypted before persistence using **Google Cloud KMS**.

### Secrets Management

- No credentials, API keys, or secrets are stored in the source code or Docker images.
- All secrets are managed via **environment variables** injected at runtime, or retrieved from **Google Cloud Secret Manager**.

### Dependency Security

- Dependencies are pinned to exact versions and regularly audited using `npm audit` and `pip-audit`.
- Automated dependency scanning is recommended via GitHub Dependabot.

### Container Security

- All Docker images are based on official, minimal base images (`node:22-alpine`, `python:3.11-slim`).
- Containers run as non-root users in production deployments.
- No secrets are baked into Docker images at build time.

---

## Data Privacy

This platform processes **personally identifiable information (PII)** including candidate names, contact details, and resume content. The following principles govern data handling:

- **Minimization:** Only the data strictly necessary for the service's function is collected and processed.
- **Encryption:** All PII fields are encrypted with Cloud KMS before being written to Firestore.
- **No Logging of PII:** Application logs must never contain PII (names, emails, phone numbers, resume text). Only resource identifiers (e.g., `resumeId`) are logged.
- **Ephemeral OCR Processing:** The Document Reader service does not persist raw documents or extracted OCR text after processing is complete.
- **Access Control:** Access to production data is restricted to authorized personnel and follows the principle of least privilege.

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub Issues.**

If you discover a security vulnerability in this project, please report it responsibly by following these steps:

1. **Email the maintainer** directly with a detailed description of the vulnerability. Include:
   - A clear description of the vulnerability and its potential impact.
   - The affected component(s) (e.g., `gateway-api`, `ai-worker`).
   - Steps to reproduce the issue.
   - Any proof-of-concept code or screenshots (redacting any real PII or production credentials).

2. **Encrypt sensitive reports** using PGP if the disclosure contains sensitive details (contact the maintainer for the public key).

3. **Allow time for a response.** The maintainer will acknowledge receipt within **72 hours** and provide an estimated timeline for a fix.

---

## Responsible Disclosure

This project follows a responsible disclosure process:

1. **Acknowledgment:** The report is acknowledged within 72 hours.
2. **Assessment:** The vulnerability is assessed for severity and impact within 7 days.
3. **Fix:** A patch is developed and tested. The timeline depends on severity:
   - **Critical / High:** Patched within 14 days.
   - **Medium:** Patched within 30 days.
   - **Low:** Addressed in the next regular release cycle.
4. **Disclosure:** After the patch is released, the reporter will be credited (unless they wish to remain anonymous) and a public security advisory will be issued if appropriate.

---

## Security Best Practices for Contributors

All contributors must follow these security practices:

- **Never commit secrets.** Check your diff carefully before pushing. Use tools like `git-secrets` or `truffleHog` to prevent accidental credential commits.
- **Validate all inputs.** Use schema validation (Pydantic for Python, Zod for Node.js) on all external inputs before processing.
- **Never disable TLS/SSL verification** in HTTP clients.
- **Avoid logging PII.** Review log statements to ensure no candidate data, tokens, or credentials are included.
- **Use parameterized queries.** Never construct database queries using string concatenation or interpolation.
- **Keep dependencies updated.** Run `npm audit` and `pip-audit` regularly and address any known vulnerabilities.
- **Follow least-privilege.** Service accounts and IAM roles should have only the permissions required for their specific function.

For detailed implementation guidance, refer to the Security sections in the coding standards documents:

- [Python Coding Standards – Security](documentation/coding-standards/python-coding-standards.md#security)
- [Node.js Coding Standards – Security](documentation/coding-standards/nodejs-coding-standards.md#security)

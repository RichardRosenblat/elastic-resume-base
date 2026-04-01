# elastic-resume-base-aegis (Python)

**Aegis Python** — Server-side authentication abstraction for Elastic Resume Base Python services.

Aegis Python provides Firebase ID token verification for Python microservices, mirroring
the TypeScript `@elastic-resume-base/aegis/server` module.

> **Browser/client note:** There is no Python client-side (browser) equivalent — Python
> services are always server-side. For browser authentication in the React frontend, use
> `@elastic-resume-base/aegis/client` (TypeScript only).

---

## Installation

```bash
# Development (editable install)
pip install -e ../shared/Aegis/v2/aegis_py

# Production
pip install ../shared/Aegis/v2/aegis_py
```

---

## Quick Start

```python
from aegis_py import initialize_auth, get_token_verifier, RequestContext

# Call once at application startup.
initialize_auth()  # Uses FIREBASE_PROJECT_ID env var and ADC

# In an auth middleware (e.g. FastAPI dependency):
verifier = get_token_verifier()
decoded = await verifier.verify_token(bearer_token)

ctx = RequestContext(
    uid=decoded.uid,
    email=decoded.email,
    name=decoded.name,
    picture=decoded.picture,
)
```

---

## API Reference

### `initialize_auth(options?)`

Initialise the Firebase Admin SDK and the default token verifier. Call once at startup.

```python
from aegis_py import initialize_auth, AuthOptions

# Option 1: use environment variables (recommended for production)
initialize_auth()  # Reads FIREBASE_PROJECT_ID, uses ADC

# Option 2: explicit options
initialize_auth(AuthOptions(project_id="my-project"))
```

### `get_token_verifier()`

Return the active `ITokenVerifier`. Raises `RuntimeError` if called before `initialize_auth()`.

### `RequestContext`

Frozen dataclass — canonical representation of an authenticated request context.

```python
from aegis_py import RequestContext

ctx = RequestContext(uid="user-123", email="user@example.com")
print(ctx.uid)    # "user-123"
print(ctx.email)  # "user@example.com"
print(ctx.name)   # None (optional)
```

### `FirebaseTokenVerifier`

Concrete token verifier backed by `firebase_admin.auth.verify_id_token`. All
Firebase auth errors are mapped to `ValueError` with a descriptive message.

### Testing helpers

```python
from aegis_py import _set_token_verifier, _reset_token_verifier

# In your test setup:
mock_verifier = MagicMock()
_set_token_verifier(mock_verifier)

# In your test teardown:
_reset_token_verifier()
```

---

## Building / Testing

```bash
cd shared/Aegis/v2/aegis_py

# Install dev dependencies
pip install -r requirements-dev.txt

# Run tests
pytest
```

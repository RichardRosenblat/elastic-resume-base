# Swagger / OpenAPI Documentation Audit

**Date:** 2026-03-19  
**Services audited:** `bff-gateway`, `users-api`

---

## Summary

| Service | Total routes | Routes with `summary` | Routes with `description` | Routes with `response` schema | Routes with `security` | Coverage (before) |
|---|---|---|---|---|---|---|
| bff-gateway | 10 | 10 | 1 | 0 | 8 | ~30% |
| users-api | 9 | 9 | 1 | 0 | 0 | ~25% |

---

## bff-gateway

### Routes audited

| Method | Path | `summary` | `description` | `response` schema | `security` | Field descriptions | Field examples |
|---|---|---|---|---|---|---|---|
| GET | /health/live | ✅ | ❌ | ❌ | ❌ (public) | ❌ | ❌ |
| GET | /health/ready | ✅ | ❌ | ❌ | ❌ (public) | ❌ | ❌ |
| GET | /api/v1/me | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| GET | /api/v1/users | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| POST | /api/v1/users | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| GET | /api/v1/users/:uid | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| PATCH | /api/v1/users/:uid | ✅ | ✅ | ❌ | ✅ | partial | ❌ |
| DELETE | /api/v1/users/:uid | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| POST | /api/v1/resumes/ingest | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| POST | /api/v1/resumes/:resumeId/generate | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| POST | /api/v1/search | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| POST | /api/v1/documents/read | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |

### Schema quality issues

- All request body / query / param properties lack `description` and `example`.
- No `response` schemas defined for any route (200, 201, 202, 204, 400, 401, 403, 404, 500).
- `email` and `photoURL` fields missing `format: 'email'` / `format: 'uri'`.
- `metadata` and `filters` fields typed as generic `object` — no nested schema.
- `bff-gateway/src/swagger.ts` UI config missing `deepLinking` and `displayRequestDuration`.

### Undocumented error responses

Every protected route can return:
- `401 Unauthorized` — missing/invalid Firebase token
- `403 Forbidden` — user does not have application access
- `400 Bad Request` — validation errors
- `500 Internal Server Error` — unhandled exceptions

---

## users-api

### Routes audited

| Method | Path | `summary` | `description` | `response` schema | `security` | Field descriptions | Field examples |
|---|---|---|---|---|---|---|---|
| GET | /health/live | ✅ | ❌ | ❌ | ❌ (public) | ❌ | ❌ |
| GET | /health/ready | ✅ | ❌ | ❌ | ❌ (public) | ❌ | ❌ |
| GET | /api/v1/users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| POST | /api/v1/users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| POST | /api/v1/users/roles/batch | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| GET | /api/v1/users/:uid | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PATCH | /api/v1/users/:uid | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| DELETE | /api/v1/users/:uid | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| GET | /api/v1/users/:uid/role | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Schema quality issues

- `users-api/src/swagger.ts` does not define a `bearerAuth` security scheme.
- No `security` metadata applied to any route.
- All request body / query / param properties lack `description` and `example`.
- No `response` schemas for any route.
- `email` field missing `format: 'email'`.
- `uids` array missing `minItems`, `description`, and `example`.
- UI config missing `deepLinking` and `displayRequestDuration`.

### Undocumented error responses

Every route can return:
- `400 Bad Request` — validation errors
- `404 Not Found` — user not found
- `403 Forbidden` — no application access (role endpoint)
- `500 Internal Server Error` — unhandled exceptions

---

## Swagger UI / UX issues

| Issue | Both services |
|---|---|
| `deepLinking` not enabled | ❌ |
| `displayRequestDuration` not enabled | ❌ |
| Tags defined per route but not described at spec level | ❌ |
| `persistAuthorization` not enabled | ❌ |

---

## % Coverage before improvements

| Metric | bff-gateway | users-api |
|---|---|---|
| Routes with `summary` | 100% | 100% |
| Routes with `description` | 8% | 11% |
| Routes with `response` schema | 0% | 0% |
| Routes with field descriptions | 0% | 0% |
| Routes with field examples | 0% | 0% |
| Routes with `security` documented | 80% | 0% |
| **Overall quality score** | **~30%** | **~20%** |

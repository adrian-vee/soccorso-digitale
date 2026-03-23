# Security Policy

## Reporting Vulnerabilities

**Do not open a public GitHub issue for security vulnerabilities.**

Please report security issues by email to:

**security@soccorsodigitale.it**

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive an acknowledgement within **48 hours** and a full response within **7 days**.

We follow responsible disclosure: we ask that you give us a reasonable time to fix the issue before public disclosure.

---

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 2.x     | ✅ Active support  |
| 1.x     | ❌ End of life     |

Only the latest minor release of the current major version receives security patches.

---

## Security Measures

### Authentication & Authorization

- **Session-based authentication** with secure, httpOnly cookies (`croce.sid`)
- **Role-based access control (RBAC)** with 5+ distinct roles:
  - `superadmin` — cross-organization platform administration
  - `director` — full access within their organization
  - `dispatcher` — trip and crew management
  - `crew` — mobile app access, trip execution
  - `viewer` — read-only access
- **Vehicle-based login**: each ambulance has its own credential set
- Sessions are stored in PostgreSQL (`user_sessions` table) and pruned automatically

### Data Isolation (Multi-Tenant)

- Every database query is scoped by `organizationId`
- An organization can never read or write data belonging to another organization
- This isolation is enforced at the application layer on every endpoint

### Cryptographic Integrity

- **HMAC-SHA256 trip signing**: each trip record is signed with a server-side secret (`TRIP_INTEGRITY_SECRET`). Any modification of trip data invalidates the signature.
- **Audit trail hash chain**: sequential audit log entries include the hash of the previous entry, making tampering detectable.

### Input Validation

- All request bodies are validated via **Zod schemas** before processing
- Invalid inputs return `400 Bad Request` with structured error details
- No raw SQL concatenation — all queries use **Drizzle ORM parameterized queries**

### Transport Security

- All production traffic is served over **HTTPS** (enforced by Railway)
- `Strict-Transport-Security` header is set in production via Helmet.js
- CORS is restricted to known origins (no wildcard)

### HTTP Security Headers (Helmet.js)

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0  (modern browsers use CSP instead)
Referrer-Policy: no-referrer
Content-Security-Policy: <restrictive policy>
Strict-Transport-Security: max-age=31536000; includeSubDomains (production)
```

### Rate Limiting

- **Global**: 1,000 requests per 15 minutes per IP
- **Login endpoint**: 10 attempts per 15 minutes per IP (brute-force protection)
- **Public API (Hub)**: 30 requests per minute per IP

### Secret Management

- All secrets are stored as **environment variables** — never in source code
- Required secrets are validated at server startup; the process exits if any are missing
- Minimum `SESSION_SECRET` length: 32 characters
- Stripe webhook signatures are verified using `STRIPE_WEBHOOK_SECRET` on every webhook call

### GDPR Compliance

- User consent is tracked with timestamps and version identifiers
- **Data export**: users can request a full export of their personal data
- **Right to erasure**: automated erasure workflows anonymize personal data on request
- Data retention policies are enforced programmatically

### Dependency Security

- Dependencies are locked via `package-lock.json`
- Run `npm audit` regularly to check for known vulnerabilities
- Pin major versions in `package.json` to avoid surprise breaking changes

---

## Security Checklist for Deployments

Before each production deployment:

- [ ] No secrets in source code (`git grep -i "secret\|password\|api_key"`)
- [ ] `.env` is in `.gitignore` and not committed
- [ ] `npm audit` shows no critical or high vulnerabilities
- [ ] `SESSION_SECRET` is at least 48 characters (use `openssl rand -base64 48`)
- [ ] `TRIP_INTEGRITY_SECRET` is at least 48 characters
- [ ] Stripe webhook secret is set and verified
- [ ] Database backups are current and tested
- [ ] Railway environment variables are set (not relying on defaults)

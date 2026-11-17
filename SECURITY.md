# REU security status — November 17, 2026

Every access level requires password sign-in and a verified TOTP authenticator. The backend verifies the Auth user, confirmed email and live session, then requires both a verified TOTP factor and an `aal2` token before exposing academy data or files. Switching roles does not bypass MFA. Roles and assignments remain server-controlled. Email-code verification has been retired; retained historical approval records are not used for access.

Each user enrolls their own authenticator, scans the QR code and enters the current code. New sign-ins require a new code. No enrollment secret, QR code or authenticator code is saved in application records or local storage. Lost-device recovery requires authorized Supabase account administration and identity verification; password recovery does not bypass MFA.

Sessions are retained in tab session storage rather than persistent local storage. The old persistent session is removed. Browser session restoration can restore session storage. JavaScript can still access tokens; this does not replace HttpOnly cookies or prevent token theft after script injection.

Both Pages entry points include a baseline CSP restricting connections, plugins, frames, workers, base URL changes and form navigations, plus a no-referrer policy.

## Remaining work

- Enable leaked-password protection in Supabase Auth settings if the plan supports it. The connector cannot edit this setting and the dashboard browser is signed out. Do not upgrade a paid plan without authorization.
- Complete authenticator enrollment for each user and hosted tests with separate disposable Admin, assigned FTO, unassigned FTO and Trainee identities. Local fixture tests are not hosted multi-account penetration testing.
- Replace legacy inline event handlers to remove `unsafe-inline` from the script policy. A meta CSP cannot enforce `frame-ancestors`; GitHub Pages does not provide repository-controlled response headers. Stronger anti-framing and HttpOnly same-origin cookies require hosting changes.
- Configure production SMTP for registration and password-recovery email before enrolling employees. Routine authenticator codes do not use SMTP.

## Verified locally

Mocked-Auth integration tests cover every-role MFA, role-switch bypass prevention, verified-factor and live-session requirements, confirmed email, unassigned users and forged-header replacement. Workflow fixtures cover role/privacy boundaries, self-approval prevention, assignments, corrections, progression and release gates. Authentication routing and private upload tests pass. Network-policy-blocked attack probes do not count as successful penetration testing.

```sh
node tests/auth-boundary.mjs
node tests/security-boundary.mjs
node tests/reference-upload.mjs
```

Never commit the private catalog, service keys, employee records or private documents.

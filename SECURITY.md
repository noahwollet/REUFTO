# REU security status — November 17, 2026

The backend requires Supabase-verified identity, confirmed email and a live session before evaluating server-controlled REU roles and assignments. Client role headers never grant a role.

## Security changes

- Every access level requires a password-authenticated session followed by a Supabase email code. Only the verified account email receives the code. Email verification is not authenticator-based MFA.
- Successful code verification creates a server-only approval bound to the returned Auth session ID, user ID and account email. The expiry is exactly 15 days and is checked on every academy, reference and evidence request. Client-supplied dates, roles and flags cannot extend it. Revoked sessions remain rejected. A refreshed session retains its original approval expiry; signing in again requires a new code.
- The code itself uses Supabase's short OTP validity and retry controls, plus the application's rate limit. Do not set Email OTP Expiration to 15 days: 15 days is the verified session period, not the code validity.
- Direct Supabase email-only sign-in or signup confirmation does not create an academy approval. The protected verify route requires a password-authenticated session or a previously approved session, matches the OTP response to that user, then records the new session.
- Sessions use tab session storage rather than persistent local storage. The old persistent session is removed. Closing the tab generally ends local retention; browser session restoration can restore session storage. JavaScript can still access session tokens. This does not replace HttpOnly cookies or prevent token theft following script injection.
- Both Pages entry points include a baseline Content Security Policy: restricted API connections, no plugins, no frames, no workers, no base URL changes, no form navigations, and a no-referrer policy.

## Outstanding work

1. Turn on Supabase leaked-password protection in Authentication settings. The connector cannot edit Auth configuration, and the available dashboard browser is signed out. The security advisor still reports this setting disabled. If Supabase indicates the feature needs a paid plan, obtain approval before upgrading.
2. Supabase Authentication → Email Templates → Magic Link must include `{{ .Token }}` to deliver a code instead of only a link. Configure production SMTP before enrolling employees. This setting is not editable through the connected tools.

Suggested template:

```html
<h2>Your REU Training verification code</h2>
<p>Enter this code on the REU Training website:</p>
<p><strong>{{ .Token }}</strong></p>
<p>If you did not request this code, ignore this email.</p>
```
3. Test the hosted application with distinct disposable Trainee, assigned FTO, unassigned FTO and Admin identities. No live test accounts or passwords were created as part of this update.
4. Replace legacy inline event handlers to remove `unsafe-inline` from the script policy. The baseline CSP is not a complete script-injection defense. A meta CSP cannot enforce `frame-ancestors`; GitHub Pages does not provide repository-controlled response headers. Stronger anti-framing and HttpOnly same-origin session cookies require a hosting architecture change.

## Verification

- Local mocked-Auth integration tests verify the email gate across all roles, exact 15-day expiry, user/session binding, the password prerequisite, OTP identity matching, failed-code and rate-limit rejection, revoked sessions, confirmed-email requirements and replacement of forged identity headers.
- Local workflow fixtures verify multirole boundaries, no self-approval, ordered onboarding, FTO assignment/coverage revocation, private trainee submissions, restricted Admin reports/activity, corrections, progression and release gates. This is not a hosted multi-account penetration test.
- Existing authentication-routing and private-reference-upload tests pass.
- Production security advisors were checked. Direct attack probes from this environment were blocked by network policy and cannot be cited as successful penetration testing.

Run local public tests with:

```sh
node tests/auth-boundary.mjs
node tests/security-boundary.mjs
node tests/reference-upload.mjs
```

Never commit the private catalog, service-role keys, employee records or private documents. Use separate private fixtures to run the complete workflow suite.

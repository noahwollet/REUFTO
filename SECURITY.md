# REU security status — November 17, 2026

The backend requires Supabase-verified identity, confirmed email and a live session before evaluating server-controlled REU roles and assignments. Client role headers never grant a role.

## Security changes

- Accounts holding Admin access, including the bootstrap owner, require a verified MFA factor and an `aal2` access token. Selecting a lower role does not bypass this requirement. Any account with an enrolled factor must also complete MFA.
- Authenticator enrollment and challenge screens use Supabase Auth. No secret, QR code or authenticator code is placed in application records or local storage. Users must enroll their own authenticator. Lost-device recovery requires identity verification and authorized intervention in Supabase; a password reset does not bypass MFA.
- Sessions use tab session storage rather than persistent local storage. The old persistent session is removed. Closing the tab generally ends local retention; browser session restoration can restore session storage. JavaScript can still access session tokens. This does not replace HttpOnly cookies or prevent token theft following script injection.
- Both Pages entry points include a baseline Content Security Policy: restricted API connections, no plugins, no frames, no workers, no base URL changes, no form navigations, and a no-referrer policy.

## Outstanding work

1. Turn on Supabase leaked-password protection in Authentication settings. The connector cannot edit Auth configuration, and the available dashboard browser is signed out. The security advisor still reports this setting disabled. If Supabase indicates the feature needs a paid plan, obtain approval before upgrading.
2. Each Admin must scan their enrollment QR code and verify their authenticator on their next sign-in. Do not share QR codes or setup secrets.
3. Test the hosted application with distinct disposable Trainee, assigned FTO, unassigned FTO and Admin identities. No live test accounts or passwords were created as part of this update.
4. Replace legacy inline event handlers to remove `unsafe-inline` from the script policy. The baseline CSP is not a complete script-injection defense. A meta CSP cannot enforce `frame-ancestors`; GitHub Pages does not provide repository-controlled response headers. Stronger anti-framing and HttpOnly same-origin session cookies require a hosting architecture change.

## Verification

- Local mocked-Auth integration tests verify Admin MFA (including role switching), verified-factor requirements, revoked-session rejection, confirmed-email requirements and replacement of forged identity headers.
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

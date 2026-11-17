# REU Field Training Academy

REU onboarding, daily PQS, response and driving logs, shift evaluations, FTO qualification, calendars and Admin review. The frontend preserves the academy layout and seven personal themes.

## Website

The `docs` directory is the GitHub Pages frontend. The Pages workflow publishes it on updates to `main`. If Pages has not been enabled, open repository **Settings → Pages** and select **GitHub Actions**. No build dependencies are needed for the frontend.

## Employee sign-in

Use the email assigned by the REU Training Officer. Create the assigned account, confirm the email and return to sign in. Account creation grants no training role. Admins assign roles and trainee profiles inside the academy. People may hold more than one role; the server validates the selected role on every request.

Supabase dashboard **Authentication → URL Configuration** must use the published Pages URL as Site URL and an allowed redirect URL. Configure production email delivery before enrolling employees; Supabase's default mail provider has recipient and rate limits. Employee passwords are managed through Supabase Auth.

## Protected backend

The deployed `academy` Supabase Edge Function verifies the Auth user, confirmed email and live session. It strips identity headers supplied by browsers and injects the verified identity into the REU workflow engine. Roles, FTO appointments and current trainee assignments come from server-controlled records rather than editable user metadata.

All application tables have RLS enabled and deny direct `anon` and `authenticated` access. Only the verified server uses the service role. Private document downloads are checked by role. Completed onboarding paperwork, activity logs and record exports remain Admin-only. Database helpers use invoker security and are executable only by the service role. Record updates use an atomic version check. Activity history cannot be updated or deleted by the service role.

Private references are stored as compressed chunks in protected database records. Employee uploads use the private `reu-private` Storage bucket. The public repository contains no completed forms, employee records, calendar subscription URLs, passwords, secret keys or protected assessment answers.

The protected catalog is intentionally omitted from Git. Redeploying the backend requires the authorized private catalog, including its `bootstrapOwnerEmail`, together with the files under `supabase/functions/academy`. Never commit this catalog. Only the Supabase URL and publishable frontend key belong in `docs/connection.js`.

## Operational status and records

This migration creates a separate REU database. Existing records in the earlier hosted academy have not been imported or overwritten. Do not treat an empty new database as a completed records migration. The earlier academy remains available for continuity.

Map and final trainee test-out approval gates remain as defined by the REU program; deployment does not approve training content or release a trainee.

## Source and database setup

`supabase/schema.sql` and `supabase/auth-security.sql` describe the deployed persistence and session controls. `scripts/prepare.py` prepares a migration from the authorized original academy checkout; set `REU_SOURCE` and provide the private catalog locally. The service-role key is read only inside Supabase from its runtime environment.

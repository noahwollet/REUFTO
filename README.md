# REU FTO

Reading Emergency Unit field training website.

## Migration status

The existing academy remains active while its server-backed workflows are migrated. This repository is not yet a deployed replacement.

Target architecture:
- GitHub Pages for frontend assets.
- Supabase Auth for individual employee sign-in.
- Server-enforced Admin, FTO and trainee permissions, including multiple roles per employee.
- Private training records and document storage.
- Admin-only activity logs and completed-document exports.

Do not commit completed forms, employee records, calendar subscription URLs, protected answer keys, passwords or Supabase secret/service-role keys.

Supabase project: REU FTO. No employee records have been migrated yet.

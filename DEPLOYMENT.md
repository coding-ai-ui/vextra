# Host Vextra on Render

The root `render.yaml` deploys the existing React frontend and Django API together
as a Docker web service, with a separate PostgreSQL database. Both are accessible
through the service's HTTPS URL; the frontend uses `/api` automatically.

## Publish

1. Push this checkout to `https://github.com/coding-ai-ui/vextra` using an account
   with write access. No `.env`, SQLite database, or local credentials should be pushed.
2. Sign in to [Render](https://dashboard.render.com/) and choose **New → Blueprint**.
3. Connect GitHub as `coding-ai-ui`, select **coding-ai-ui/vextra**, branch **main**,
   and use the root **render.yaml**. Review the free web service and free database,
   then deploy the Blueprint.
4. Wait for the **vextra** service to become **Live**. Open the URL Render assigns;
   use that exact URL, since the service name might already be taken.
5. Verify `/api/health/` returns `{"status":"ok"}`, open `/projects`, register,
   sign in, and save a simulation. Reload a nested page to verify frontend routing.

Render generates the Django secret, injects the database connection and hostname,
and terminates HTTPS. Startup applies migrations, creates a shared database cache,
and seeds the fictional catalogue only when there are no projects. Later deploys
preserve project edits and database records. `DJANGO_DEBUG=False` is set explicitly.

## Accounts and existing data

The hosted database starts fresh. Local accounts, passwords, portfolios, messages,
and administrator privileges are not copied. Keep the local database as-is.
Use a deliberate database migration if those records need to be transferred.

The application administrator interface remains `/admin`. Django's separate
maintenance interface is `/django-admin/` in the combined deployment (locally,
when using separate Vite and Django servers, Django's interface stays `/admin/`).
Registration creates regular accounts. To create the application administrator,
run `python manage.py create_admin` against the hosted database with `ADMIN_EMAIL`
and `ADMIN_INITIAL_PASSWORD` supplied securely in that command's environment.
The command changes the named account's password; run it deliberately, never on
every deploy. Render's free service has no remote shell, so this requires an
authorized local database connection or a service plan with shell access.

## Free-tier limitations and email

This Blueprint uses Render's **free demonstration tiers** and creates no paid
service by default. Free web services sleep after 15 idle minutes. The free
PostgreSQL database expires after **30 days** and has no managed backups: upgrade
before expiry for ongoing hosting, and arrange backups for data you need to keep.
See [Render's current limits](https://render.com/docs/free).

Real password-reset email delivery requires an email provider. The existing
file-based email backend is only for local development and does not deliver to
inboxes. Render's free web service blocks SMTP ports 25, 465 and 587. For public
password resets, configure an HTTPS email backend/provider or use a hosting plan
that supports your SMTP provider, then configure `EMAIL_BACKEND`, sender and
provider credentials in Render. Do not use a console email backend in production
because reset links would appear in logs.

For a custom domain, add it in Render and set `DJANGO_ALLOWED_HOSTS`,
`CSRF_TRUSTED_ORIGINS` and `FRONTEND_URL` to the exact hostname/HTTPS origin.
`DJANGO_TRUST_PROXY=true` is appropriate behind Render's managed proxy; only use
it elsewhere when the proxy replaces client-supplied forwarded headers.

## Local verification

```powershell
cd frontend
npm.cmd ci
npm.cmd run build
npm.cmd test
npm.cmd run lint
npm.cmd run typecheck
cd ../backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe manage.py collectstatic --noinput
.\venv\Scripts\python.exe manage.py test
cd ..
backend/venv/Scripts/python.exe scripts/check_deployment.py
```

The smoke check uses a separate in-memory database and production settings; it
does not change local accounts or data. It verifies frontend and admin routing,
compiled assets, API 404s, HTTPS forwarding, database health, registration, login,
and a saved simulation. A local Docker build additionally checks the Linux image:
`docker build -t vextra .`. Render validates the image and PostgreSQL connectivity
during the actual deployment.

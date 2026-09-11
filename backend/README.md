# Vextra API

Vextra extends the existing Django/DRF/SQLite application and Django User model. `UserProfile.role` remains the authority for application administration. All allocations are educational simulations; no endpoint moves money. Existing accounts, project IDs, credentials and saved rate snapshots are preserved.

## Run the existing workspace

From `backend/`:

```powershell
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

For a new checkout, create a virtual environment, install `requirements.txt`, copy `.env.example` to `.env` and set a unique `DJANGO_SECRET_KEY` before running migrations. Keep an existing secret stable. Do not overwrite a configured `.env` or existing database. `seed_projects` explicitly creates/refreshes the ten fictional catalogue entries only while `VEXTRA_DEMO_MODE=true`; no users or passwords are seeded. The expansion migration enriches only already-present fictional entries and leaves unrelated projects untouched.

`GET /api/config/` exposes `{demo_mode, simulation_only}`. Each project has `is_demo`. Setting `VEXTRA_DEMO_MODE=false` hides demo projects from public discovery and prevents new demo simulations.

## Authentication and profiles

Use `Authorization: Bearer <access>` for private endpoints. Decimal values are JSON strings. Collections are arrays except notifications, which return `{results, unread_count}`.

| Method | Endpoint | Contract |
| --- | --- | --- |
| POST | `/api/users/register/` | `{username,email,password}`; returns id/username/email |
| POST | `/api/users/login/` | `{username,password}`; username also accepts case-insensitive email; returns access/refresh/user |
| POST | `/api/users/refresh/` | `{refresh}`; replaces both access and refresh tokens |
| GET/PATCH | `/api/users/me/` | Current profile; editable username/email/first_name/last_name/bio/avatar/interests/notification preferences |
| GET | `/api/users/me/comments/` | Current user's non-deleted comments with project title/slug |
| POST | `/api/users/password-reset/` | `{email}`; identical confirmation for known and unknown accounts |
| POST | `/api/users/password-reset-confirm/` | `{uid,token,password}`; validates one-use reset link and password |

Access tokens last 20 minutes, refresh tokens seven days. Refresh rotation blacklists old tokens. Password changes revoke access tokens through SimpleJWT password-state checking and blacklist outstanding refresh tokens. Pre-expansion tokens without the password-state claim require a fresh login. Passwords and hashes are never returned by user APIs.

Profile returns role, joined date, bio (500 characters), avatar (sage/forest/violet/clay/amber or safe HTTP(S) URL), interests (up to 12 unique strings), booleans `notify_replies`, `notify_reactions`, `notify_projects`, and `counts: {saved,following,comments,simulations}`. Names remain limited to 150 characters and email to 254. Usernames/emails are unique ignoring case. Account edits cannot change a user's role or staff status.

Reset emails use Django's configured email backend. The local default writes actual email messages to ignored `artifacts/emails/`; open the delivered link locally to finish a reset. Reset tokens are never exposed in an HTTP response or browser console. Links expire after one hour. Configure `FRONTEND_URL`, SMTP and sender environment variables for delivery to real inboxes. No external email provider is required for the local showcase.

## Projects and discovery

| Method | Endpoint | Contract |
| --- | --- | --- |
| GET | `/api/projects/` | Public active/completed project array |
| GET | `/api/projects/<slug-or-id>/` | Public project detail; existing numeric links still work |
| POST | `/api/projects/` | Administrator project creation |
| GET/PATCH/DELETE | `/api/projects/admin/<id>/` | Administrator management including draft preview |
| POST/DELETE | `/api/projects/<id>/save/` | Authenticated idempotent save/remove; `{saved,save_count}` |
| POST/DELETE | `/api/projects/<id>/follow/` | Authenticated idempotent follow/unfollow; `{following,save_count}` |
| GET | `/api/community/saved/` | Current user's saved public projects |
| GET | `/api/community/following/` | Current user's followed public projects |
| GET/PUT | `/api/community/comparison/` | Current user's ordered comparison; PUT `{project_ids:[1,2]}` returns a project array |

Projects extend the original model with organization, location, status (`draft`, `active`, `completed`), impact_area, impact_score (0–100), tags, gallery (up to eight HTTP(S) URLs), sustainability and is_demo. Existing funding/return/duration/risk/objective/description/image fields remain. Slugs are unique; migrated duplicates receive stable suffixes. Responses include current-user `saved` and `following` flags plus actual `save_count`, `comment_count` and `popularity` (saves + follows + visible comments).

Combine `search`, `category`, `location`, `risk_level`, `impact_area`, `status`, `featured`, `return_min` and `return_max`. Search covers title, category, tags, organization, location, descriptions and impact area. Default search relevance prioritizes exact/title matches. `ordering` accepts title, expected_return, duration, created_at, funding_percentage, popularity and impact_score; prefix with `-` for descending order. `?admin=true` includes drafts only for authorized administrators. Drafts never appear publicly and cannot be saved, followed, commented on or simulated. Projects in existing portfolios return a useful 409 deletion conflict; administrators can mark them completed while preserving history.

Authenticated comparisons are stored in the existing SQLite database using a one-to-one `Comparison` record. The list retains selection order and accepts zero to four unique, positive integer project IDs. Invalid, missing, unpublished and hidden demo projects are rejected without replacing the previous selection. Reads omit and reconcile projects that later become unavailable or are deleted. Anonymous comparisons may remain in browser storage; signing in connects the selection to the account. Comparison endpoints always use the authenticated user and cannot read or modify another user's list.

## Discussion and moderation

| Method | Endpoint | Contract |
| --- | --- | --- |
| GET/POST | `/api/projects/<id>/comments/` | Public flat thread list; authenticated POST `{body,parent?}` |
| PATCH/DELETE | `/api/community/comments/<id>/` | Author-only body edit or soft deletion |
| POST/DELETE | `/api/community/comments/<id>/react/` | Unique useful vote; `{reacted,reaction_count}` |
| POST | `/api/community/comments/<id>/report/` | `{reason}`; persisted report, unique per reporter/comment |
| GET | `/api/community/admin/comments/` | Admin search/project/user/status filters |
| PATCH/DELETE | `/api/community/admin/comments/<id>/` | Admin `{is_hidden}` or soft delete |
| GET | `/api/community/admin/reports/` | Open reports by default; `?status=all` includes history |
| POST | `/api/community/admin/reports/<id>/dismiss/` | Dismiss report |

Comments return id/project/project_title/project_slug/parent/author/body/timestamps/is_edited/is_deleted/is_hidden/reaction_count/reacted/reply_count. Open report counts are read-only and exposed only in moderation responses. Author contains only id, username, first/last name and avatar. Nested replies are limited to two levels below the root and cannot cross projects. Soft deletion preserves replies, clears the body and resolves open reports. Account deletion anonymizes and soft-deletes that account's comments while preserving other authors' replies. Hidden bodies are blank in public APIs; moderation views can inspect them. Hiding/deleting resolves open reports. Report responses include nested comment and reporter objects.

Bodies accept plain text up to 2,000 characters; HTML/control-character payloads are rejected. Reports allow 500 characters. Per-user/IP throttles apply: comment creation/editing 15/minute, reactions 60/minute, reports 5/minute. Server permissions independently enforce author ownership and moderator roles.

## Portfolio, notifications and activity

| Method | Endpoint | Contract |
| --- | --- | --- |
| GET/POST | `/api/investments/` | Private allocations; create `{project_id,amount}` |
| GET/PATCH/DELETE | `/api/investments/<id>/` | Owner-only; PATCH amount retains original rate |
| GET | `/api/investments/history/` | Actual persisted changes: `{date,allocated,value}` |
| GET | `/api/community/notifications/` | All current-user notifications plus unread_count |
| PATCH | `/api/community/notifications/<id>/` | Current user `{read:true}` |
| POST | `/api/community/notifications/read-all/` | Mark all current-user notifications read |
| GET | `/api/community/activity/` | Latest 100 actual user actions |

Amounts are positive, finite and have at most two decimals. The server uses Decimal and ROUND_HALF_UP: $1,000 at 15% produces $150 profit and $1,150 estimated total. Responses expose amount, expected_profit, expected_return_snapshot, estimated_total and nested project. Owners/results cannot be overridden. Edits recalculate profit with the saved rate. Portfolio history persists actual create/edit/delete totals; migration backfills existing allocations using their real creation timestamps. There is no invented market-price history or compounding.

If a project is unpublished after an allocation was saved, the owner's allocation, original rate and totals remain available. The nested project becomes an explicit unavailable record, so unpublished project content is not leaked through a portfolio. Profile saved/followed/comment counts match currently visible data; simulation counts continue to include preserved allocations.

Notifications are generated by actual reply/useful-vote events, followed project changes/status/featured changes, and publication matching profile interests. Preferences are honored; self-notifications and no-op project saves are suppressed. Reading pages never generates notifications. Activity records actual save/unsave/follow/unfollow/comment/simulation/edit/removal actions, scoped to the current user.

## Inbox and administration

| Method | Endpoint | Contract |
| --- | --- | --- |
| POST | `/api/community/contact/` | Public `{name,email,subject,message}` |
| POST | `/api/community/feedback/` | Public `{kind,name,email,message}`, kind feature/bug/general |
| GET | `/api/community/admin/feedback/` | Admin merged contact/feedback inbox, filter kind/status/search |
| PATCH | `/api/community/admin/feedback/<id>/` | Admin `{status:'resolved'}` or reopen |
| GET | `/api/users/admin/stats/` | Real totals plus existing recent_users/recent_projects |
| GET/POST | `/api/users/admin/users/` | Admin listing/search and creation |
| GET/PATCH/DELETE | `/api/users/admin/users/<id>/` | Admin permitted account edits, counts and deletion |

Contact/feedback messages persist in SQLite, accept plain text up to 5,000 characters and are limited to five submissions/hour per user/IP. Reset requests are limited to five/hour. General auth endpoints allow 30/minute. Admin totals include projects/users/comments/open reports/open feedback/saves/follows/simulations/drafts.

The existing primary administrator `talyn2007@gmail.com` remains protected from deletion, deactivation, email change and role demotion. An administrator cannot revoke their own access or remove the final active administrator. Normal users cannot access admin lists, moderate comments, edit projects or manage other accounts. The application never relies on hidden frontend controls for authorization.

## Verification

```powershell
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py makemigrations --check
.\venv\Scripts\python.exe manage.py test
```

The API suite exercises authentication/rotation/revocation, original calculation invariants, isolation, draft publication, extended search, save/follow uniqueness, persistent ordered comparisons and reconciliation, comments/depth/ownership/XSS, deleted-account thread preservation, moderation/privacy, actual notifications/preferences, profiles/admin protection, portfolio history, inbox delivery and one-use password reset. Django admin project forms expose and validate the expansion's publication, organization and impact fields. Tests use a separate temporary database and preserve existing credentials.

For a public deployment, configure an exact host/origin allowlist, HTTPS, `DJANGO_DEBUG=False`, a production application server, SMTP delivery and a shared cache for throttling. These deployment settings do not change the local academic simulation behavior.

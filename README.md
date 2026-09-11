# Vestra

**Invest in what matters.** An academic investment simulation platform built on the existing React + Vite frontend and Django REST Framework backend. All projects, funding figures and estimated outcomes are fictional. No real money moves through Vestra.

## enter the website
**the Url of this website is** https://vextra-93ix.onrender.com/

## Run the existing workspace

Dependencies, the local backend environment, SQLite migrations and ten fictional projects are already configured. Open two PowerShell terminals from this folder.

Backend:

```powershell
cd backend
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Frontend:

```powershell
cd frontend
npm run dev
```

Open **http://127.0.0.1:5173**. Register an account to start saving simulations. No shared demo password or administrator account is created. The catalog is public; the portfolio requires authentication.

## Presentation walkthrough

1. Start on the homepage. Adjust the sample allocation slider, scroll through featured projects, the changing four-stage preview and the larger portfolio showcase.
2. Create an account, then sign out and sign back in with either its email address or username.
3. Explore projects. Search, select a category/risk, and sort by estimated return or duration.
4. Open **Nova Energy**. Try **$500**, **$1,000**, then **$5,000**. At 15%, $1,000 produces **$150 expected profit** and **$1,150 estimated total**.
5. Add the simulation to your portfolio and follow the confirmation to the dashboard.
6. Add another project/category to demonstrate allocation, weighted expected return, duplicate-project aggregation and the investment outlook.

The return applies to each project's full stated duration; it is not annualized or compounded. Saved results preserve the expected return at the time of saving.

## What is implemented

- Editorial landing page, interactive sample portfolio, original SVG category artwork and locally hosted Manrope fonts.
- Shared responsive navigation/footer, premium authentication forms, page titles, favicon, About/disclaimer page, branded 404, loading/error/empty states and notifications.
- JWT authentication with persisted sessions, single-flight refresh, refresh-token rotation, bounded retries and logout race protection. Open dashboards reload their portfolio when the signed-in account changes in another tab.
- Public project list/detail with URL-backed search, category/risk filtering and sorting. Staff-only project creation and configured Django Admin.
- Live cent-based simulator, authentication destination restoration, backend Decimal validation/calculation and private saved portfolios.
- Dashboard with animated values, weighted expected return, category allocation donut, project outlook bars and responsive simulation history. Chart data derives entirely from saved API records.
- Reusable IntersectionObserver reveals, short staggers including saved simulation rows, animated counters/progress with accessible final values, natural-scroll storytelling, restrained hero movement, compacting navigation and reduced-motion support.

## Architecture and files

The existing uppercase `frontend/src/Components`, `Services` and `Pages` directories are preserved. React Router handles navigation, Axios owns API access and refresh, and React contexts expose authentication and notifications. Product pages load lazily so Recharts is downloaded with the dashboard.

| Location | Responsibility |
| --- | --- |
| `frontend/src/App.jsx` | Shared layout, routes, protected dashboard, page metadata, hash destination restoration and error boundary |
| `frontend/src/Pages/` | Home, Projects, ProjectDetails, Dashboard, Login, Register, About, NotFound |
| `frontend/src/Components/` | Navigation, forms, category visuals, project cards, simulator, previews, charts and shared UI/motion |
| `frontend/src/context/` | Auth and toast providers |
| `frontend/src/Services/` | Axios/JWT handling and authentication validation |
| `frontend/src/utils/` | Currency/percentage/date formatting and cent-based portfolio calculations |
| `frontend/src/index.css`, `home.css`, `product.css`, `auth.css` | Shared design system, responsive layouts and motion |
| `frontend/tests/` | Authentication/calculation tests and browser acceptance suite |
| `backend/users/` | Registration, username/email login, token refresh and private profile |
| `backend/projects/` | Project catalog, permissions, filtering, admin and fictional seed data |
| `backend/investments/` | Decimal calculations, saved return snapshots and per-user portfolios |
| `backend/config/` | Settings, API URLs, local environment and SQLite connection |

The unrelated existing `showcase/` folder is preserved. Vestra runs from the original `frontend/` and `backend/`.

## Fresh installation

Use Node 22.12+ and Python 3.12+. See [backend/README.md](backend/README.md) for backend setup and the complete API contract. Copy `backend/.env.example` to `.env` and generate a secret as documented there. Keep that secret stable across restarts. Never commit `.env` or the SQLite database.

```powershell
cd frontend
npm install
```

Vite proxies `/api` to `http://127.0.0.1:8000`; no frontend environment file is needed locally. For another API location, copy `frontend/.env.example` to `.env` and set `VITE_API_BASE_URL` to its `/api` base URL.

Added frontend packages: `react-router-dom`, `recharts`, `lucide-react`, `@fontsource/manrope`, plus `playwright` for development tests. Added backend packages: `djangorestframework-simplejwt`, its `PyJWT` dependency, and `python-dotenv`. React, Vite, JavaScript, Axios, Django, DRF and SQLite remain the original stack.

## Migrations and seed data

```powershell
cd backend
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py seed_projects
```

The new project migration is `projects/0002_alter_project_options_project_featured_and_more.py`; investments use `investments/0001_initial.py`. SimpleJWT's blacklist migrations are also applied. The original Project migration and existing IDs are preserved. The seed command refreshes the ten named fictional projects without duplicating them or removing unrelated records. It creates no users.

Optional administrator setup:

```powershell
.\venv\Scripts\python.exe manage.py createsuperuser
```

Then open http://127.0.0.1:8000/admin/.

## Verify

```powershell
cd backend
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py makemigrations --check --dry-run
.\venv\Scripts\python.exe manage.py test
```

```powershell
cd frontend
npm run lint
npm test
npm run build
```

With both servers running, `npm run test:e2e` exercises the actual browser journey and captures desktop/tablet/mobile screenshots. The suite uses Playwright with installed Chrome, or Playwright's Chromium (`npx playwright install chromium` if needed). It creates isolated local QA accounts and deletes exactly those accounts and their simulations afterward. This includes a second account for verifying portfolio isolation when switching sessions across browser tabs. Generated reports and screenshots are under `artifacts/e2e/` and ignored by Git. For a nonlocal API, do not run the local cleanup workflow unchanged.

To serve the compiled frontend locally, run `npm run preview` and open http://127.0.0.1:4173 while Django is running. For public hosting of both frontend and backend on Render, see [DEPLOYMENT.md](DEPLOYMENT.md) and the root `render.yaml` Blueprint.

**Simulation estimate — not a guaranteed return. For educational demonstration only.**

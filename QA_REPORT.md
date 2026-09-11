# Vestra completion and verification

Verified on **7 September 2026** in the existing repository. The complete browser acceptance suite ran against the compiled production frontend at `http://127.0.0.1:4173`, connected to the real local Django API and SQLite database.

**70 browser checks passed. 23 Django tests passed. 20 frontend tests passed.** No unhandled browser errors or console warnings were recorded. Lint completed without warnings. Temporary browser-test accounts and their simulations were removed after testing.

## Acceptance checklist

| Requirement | Result |
| --- | --- |
| Django system check | PASS |
| Migration consistency (`makemigrations --check --dry-run`) | PASS — no model changes |
| Database migrations | PASS — no pending migrations |
| Frontend production build | PASS |
| Registration, username/email login, persisted authentication and logout | PASS |
| JWT expiry, refresh rotation, retry and invalid refresh handling | PASS |
| Projects API and access permissions | PASS |
| Search, category/risk filters, sorting and query-state restoration | PASS |
| Project detail pages | PASS |
| Investment simulator and validation | PASS |
| $1,000 at 15% → $150 expected profit → $1,150 estimated total | PASS — browser and server assertions |
| Simulation persistence and user isolation | PASS |
| Open dashboard switches portfolios when the account changes in another tab | PASS |
| Animated financial values expose stable accessible names | PASS |
| Dashboard totals, rounding, saved snapshots and duplicate-project aggregation | PASS |
| Recharts allocation/outlook data, visible geometry and tooltips | PASS |
| Hero interaction, scroll story, reveals, counters, funding bars and navbar scroll state | PASS |
| Saved simulation rows reveal with a short, capped stagger | PASS |
| Reduced-motion accessibility | PASS |
| Responsive layouts | PASS — 1440, 1280, 1024, 768, 430 and 390 px |
| Mobile navigation, Escape and keyboard focus | PASS |
| Loading, empty, offline, retry, 404 and expired-session states | PASS |
| Sign-in restores the pending simulator amount and destination | PASS |
| Final visual design review | PASS |

The screen-width sweep covered Home, Projects, Project Details, Dashboard, Login, Register, About and 404. Screenshots were reviewed for desktop/tablet/mobile hierarchy, spacing, chart visibility, readable forms and navigation. Final fixes included mobile loading skeletons, a hidden accessibility table causing horizontal overflow, intermittent chart animation geometry, fractional currency formatting and duplicate artwork captions.

Charts render their actual geometry immediately and use short CSS entrance animations with shared scroll reveals. This avoids a library animation state leaving zero-width bars or zero-angle sectors. Reduced-motion mode presents settled values and charts without decorative motion. This verification is an application QA pass, not a formal accessibility certification.

## Evidence

The final continuation preserved the existing application, corrected stale dashboard data after account changes in another tab, exposed animated metrics to assistive technology, added staggered investment-row entrances, and removed the unused Button component, Arrow helper, starter icon sprite and story metadata. New browser assertions verify the account switch, accessible metric names and row motion; reduced-motion checks also cover the new entrances. Django checks, migration consistency, 23 backend tests, lint, 20 frontend tests and the production build all passed in this continuation.

- [Full browser report](artifacts/e2e/2026-09-07T20-30-57-382Z/report.json)
- [Desktop homepage](artifacts/e2e/2026-09-07T20-30-57-382Z/home-early-1440-viewport.png)
- [Project details and simulator](artifacts/e2e/2026-09-07T20-30-57-382Z/details-1440-viewport.png)
- [Portfolio charts](artifacts/e2e/2026-09-07T20-30-57-382Z/charts-1440-viewport.png)
- [Mobile dashboard](artifacts/e2e/2026-09-07T20-30-57-382Z/dashboard-390-viewport.png)
- [Mobile charts](artifacts/e2e/2026-09-07T20-30-57-382Z/charts-390-viewport.png)
- [Login](artifacts/e2e/2026-09-07T20-30-57-382Z/login-1440-viewport.png)
- [Tablet registration](artifacts/e2e/2026-09-07T20-30-57-382Z/register-768-viewport.png)

Screenshots and machine-readable reports are local generated artifacts excluded from Git. Re-run `npm run test:e2e` to regenerate them. The durable acceptance suite is `frontend/tests/e2e.cjs`; authentication and calculation tests are in the same folder. Django tests remain in their respective apps.

## Ready to present

The ten fictional projects are seeded. No default demo credentials were created. Register your own user through the app; create a superuser only if you want to demonstrate Django Admin. No additional implementation steps remain for the local academic MVP. See [README.md](README.md) for run commands, dependencies, migrations, architecture and the presentation walkthrough.

**Simulation estimate — not a guaranteed return. For educational demonstration only.**

# Vestra frontend

The existing React + Vite application provides Vestra's complete educational investment simulation experience. See [the project README](../README.md) for setup, architecture, the presentation walkthrough and backend commands.

From this directory:

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173 with Django running on port 8000. Vite forwards `/api` to Django. Set `VITE_API_BASE_URL` only when using a different API location.

```powershell
npm run lint
npm test
npm run build
npm run preview
```

The Node tests verify real Axios refresh behavior, validation and portfolio math. `npm run test:e2e` runs the browser acceptance suite with both servers running, saves screenshots under `../artifacts/e2e/`, and removes its isolated test account afterward. It uses Playwright plus installed Chrome or Playwright Chromium. Browser overrides: `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, `PLAYWRIGHT_MODULE_PATH`, `E2E_BASE_URL`, `VESTRA_PYTHON`.

The UI keeps React, JavaScript, Axios, React Router, CSS and Recharts. Manrope is hosted locally. No payment features or real investments are involved.

# SafeTour AI — Website + Backend

Offline-First Tourist Safety, Risk Prediction & Disaster Rescue Coordination.

This package has two parts:

```
project/
├── index.html          ← the website (Vue 3 + Tailwind, single file)
└── server/              ← the backend API (Node.js + Express)
    ├── server.js
    ├── package.json
    └── data/db.json     ← simple JSON "database" (auto-updated at runtime)
```

## 1. Run the backend

```bash
cd server
npm install
npm start
```

This starts the API at `http://localhost:4000`. You should see:

```
SafeTour AI backend running at http://localhost:4000
```

Health check: open `http://localhost:4000/api/health` in a browser — you should get a small JSON response.

## 2. Open the website

Just open `index.html` in a browser (double-click it, or serve it with any static
file server). The website automatically talks to `http://localhost:4000/api`.

If you want to point it at a different backend URL (e.g. after deploying the
backend somewhere), set this **before** the page's own script runs, e.g. by
adding to `index.html`'s `<head>`:

```html
<script>window.SAFETOUR_API_BASE = 'https://your-backend-domain.com/api';</script>
```

## 3. What's connected to the backend

The site is designed **offline-first** — every backend call fails soft. If the
API isn't running, the website keeps working on local demo data (and a small
"API OFFLINE" badge shows in the navbar). Start the backend and reload to see
"API CONNECTED".

Wired to the backend:
- **Tourist login** — `POST /api/auth/tourist-login`
- **Authority (SDRF Commander) login** — `POST /api/auth/authority-login`
- **Rescue Dashboard** — live tourists, incidents, and stats:
  `GET /api/tourists`, `GET /api/incidents`, `GET /api/dashboard/stats`
- **SOS emergency broadcast** — `POST /api/sos` (creates a real incident the
  dashboard can see and dispatch a rescue team to)
- **Resolve SOS** — `PATCH /api/incidents/:id/resolve`
- **Dispatch rescue team** — `POST /api/incidents/:id/dispatch`
- **AI risk engine** — `POST /api/risk/calculate` (server-side authoritative
  version of the same scoring logic used live in the risk-monitor sliders)
- **System log** — every `addSystemLog(...)` call also mirrors to
  `POST /api/logs`

## 4. Full API reference

| Method | Route                              | Purpose                                   |
|--------|-------------------------------------|--------------------------------------------|
| GET    | `/api/health`                       | Health check                              |
| POST   | `/api/auth/tourist-login`           | Tourist login (auto-registers new users)  |
| POST   | `/api/auth/authority-login`         | SDRF Commander login                      |
| GET    | `/api/tourists`                     | List all tracked tourists                 |
| GET    | `/api/tourists/:id`                 | One tourist's profile                     |
| POST   | `/api/tourists/:id/telemetry`       | Push GPS/battery/risk telemetry           |
| GET    | `/api/locations`                    | Offline map presets (Araku, Munnar, ...)  |
| POST   | `/api/risk/calculate`               | Server-side AI risk score calculation     |
| GET    | `/api/incidents`                    | List SOS incidents                        |
| POST   | `/api/sos`                          | Raise a new SOS incident                  |
| POST   | `/api/incidents/:id/dispatch`       | Assign a rescue team to an incident       |
| PATCH  | `/api/incidents/:id/resolve`        | Mark an incident resolved                 |
| GET    | `/api/rescue-teams`                 | List rescue teams and availability        |
| GET    | `/api/dashboard/stats`              | Aggregate counts for the dashboard        |
| GET    | `/api/logs`                         | System log feed                           |
| POST   | `/api/logs`                         | Append a system log entry                 |

## 5. Notes for the SIH demo

- The backend currently persists to a JSON file (`server/data/db.json`) so
  you don't need to install a database to try it out. For a production
  deployment, swap `readDB`/`writeDB` in `server.js` for PostgreSQL/PostGIS
  or MongoDB — every route already talks through those two functions, so the
  rest of the API doesn't need to change.
- Demo credentials seeded in `db.json`:
  - Tourist: username `rajesh_trekker`
  - Authority: username `command_sdrf`, password `admin123`
  - (Any other tourist username also works — the backend auto-registers it.)
- To simulate the site's "offline mode" against the backend, just stop the
  `npm start` process — the site keeps functioning on local data and the
  navbar badge flips to "API OFFLINE", which is exactly the resilience story
  this project is meant to demonstrate.

# Frontend (Angular)

Angular 21 frontend for the Neighborhood Community Board. It includes:

- **Login** and **Register** (reactive forms)
- **AuthGuard** and **AdminGuard** for route protection
- **User Dashboard:** post feed, create post, profile, comments, reactions
- **Admin Dashboard:** user list, post list, edit/delete users, delete posts
- Role-based redirects after login (admin → `/admin`, user → `/user-dashboard`)

## How to start and test

**See the main [README](../README.md) in the project root** for:

- Prerequisites and project structure
- Installation (root, server, frontend)
- **How to start the app** (backend + frontend, two terminals)
- **How to test** (browser, curl, Postman)
- Demo accounts (admin@example.com / admin123)
- API overview and troubleshooting

## Quick start (from project root)

1. **Backend:** `npm run dev` (runs on http://localhost:3000)
2. **Frontend:** `cd client/frontend && npm start` (runs on http://localhost:4200)
3. Open **http://localhost:4200** in the browser

The frontend proxies `/api` to the backend via `proxy.conf.json`. Use `npm start` (or `ng serve --proxy-config proxy.conf.json`) so the proxy is active.

## Frontend structure

- `src/app/app.ts` — root component (router outlet only)
- `src/app/app.routes.ts` — routes and guards
- `src/app/services/auth.service.ts` — login, register, logout, token, role
- `src/app/guards/auth.guard.ts`, `admin.guard.ts` — route protection
- `src/app/components/` — login, register, home, user-dashboard, admin-dashboard

## Build for production

```bash
cd client/frontend
npm run build
```

Output is in `dist/`. The backend can serve this from `public/` in production (same origin).

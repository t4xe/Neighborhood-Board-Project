# Neighborhood Community Board

Backend is implemented (Node.js + Express + TypeScript, SQLite). Frontend (Angular) is the teammate’s task — see `client/README.md`.

## Run backend

```bash
npm run install:all
npm run dev
```

Then open http://localhost:3000. You’ll see a minimal static page; the API is at `/api`. See `docs/API.md` for endpoints.

- **Demo login:** `POST /api/authentication/login` with `{ "email": "admin@example.com", "password": "admin123" }` → returns `token`; use `Authorization: Bearer <token>` for protected routes.

## Project layout

- **server/** — Backend (auth, categories, posts, comments, reactions; role-based access; SQLite).
- **public/** — Minimal static page served until the Angular app is built.
- **client/** — Placeholder for Angular app (teammate implements the frontend here).
- **docs/API.md** — API description for the frontend developer.

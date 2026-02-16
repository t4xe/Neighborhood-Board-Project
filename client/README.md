# Frontend (Angular) — teammate’s task

Backend is complete and running. **Your task is to implement the full Angular frontend here.**

- **API:** See `/docs/API.md` in the repo (or hit `/docs/API.md` when the server is running). Base URL: `/api`. Auth: `Authorization: Bearer <token>` after login.
- **Stack:** Angular (TypeScript). Backend serves the built app in production (same origin).
- **Scope (from project description):**
  - Login; role-based UI aligned with backend (administrator, management, regular, visitor).
  - Feed: list posts with server-side pagination, filter by category and zone, sort.
  - Post detail: view post, comments, reactions (helpful, interested, congratulations, sold).
  - Create/edit post (auth required); comment and react (auth required).
  - At least one chart with business data (e.g. posts per category).
  - Usability: responsive layout, clear error messages, guards/interceptors for auth.

Create the Angular app in this folder (e.g. `ng new client` and move files here, or scaffold manually). Use proxy to `http://localhost:3000` for `/api` during development.

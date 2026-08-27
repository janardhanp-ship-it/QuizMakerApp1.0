Date created: 2026-08-26
Date last modified: 2026-08-26

# User Authentication - Technical PRD

## Overview/Problem

Quiz Maker has no identity layer. Anyone who can open the app would share the same anonymous experience, and there is no way to persist a person across visits. Quiz taking, progress, and later features such as results all depend on knowing who the user is.

This feature gives a learner a user account (name, username, email, and a hashed password), a user service that owns database access, and register / login / logout HTTP endpoints. After a successful register or login, the user is taken to a stub MCQ page so authenticated navigation exists before the full quiz product is built.

---

## Hypothesis

We believe that a D1-backed user service with hashed passwords and cookie sessions will let learners register, sign in, and sign out securely, and will give later quiz work a stable authenticated user to attach attempts to.

---

## Scope

### In Scope

- Cloudflare D1 database binding, plus a migration that creates the `users` table
- A server-only **user service** with base methods: create, read (by id / username / email), update, and delete
- Password hashing on write; never store or return plaintext passwords
- HTTP endpoints: **register**, **login**, and **logout**, each using the user service for database access
- Session creation on register and login; session destruction on logout
- UI: register page, login page, logout action, and a **stub MCQ page** that is only reachable when authenticated
- Redirect to the stub MCQ page after successful register or login
- Redirect unauthenticated visitors away from the stub MCQ page to login

### Out of Scope

- Full MCQ quiz authoring, question banks, scoring, or attempt persistence (stub page only)
- OAuth / social login
- Email verification, password reset, or “remember me”
- Role-based access (admin vs learner)
- Public HTTP APIs for generic user update or delete (those remain service methods for later features)
- Rate limiting as a product feature (document a follow-up if abuse appears)

### Cut

- **JWT-only auth with no server session** — Logout cannot be enforced until expiry; a D1-backed session (or equivalent server-side revocation) is required for real logout
- **Storing passwords in the user row as plaintext or reversible encryption** — Does not meet the security requirement
- **Calling D1 from `'use client'` components** — D1 is server-only; the user service must live in `src/lib/`
- **Applying D1 migrations to the remote database** — Local apply only; remote is a human decision

---

## Technical Requirements

### Database Schema

D1 is SQLite. Add a database (suggested name: `quizmaker-db`) and bind it as `DB` in `wrangler.jsonc`, then `npm run cf-typegen`. Schema changes go through Wrangler migrations only.

`users.id` is a UUID stored as TEXT. Username and email are unique. `password_hash` stores a salted hash, never the password. `sessions` holds opaque session tokens so logout can invalidate access immediately.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_users_username ON users (username);
CREATE UNIQUE INDEX idx_users_email ON users (email);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_sessions_token_hash ON sessions (token_hash);
CREATE INDEX idx_sessions_user_id ON sessions (user_id);
CREATE INDEX idx_sessions_expires_at ON sessions (expires_at);
```

**Column notes**

| Column | Rules |
|--------|--------|
| `id` | UUID v4 (or equivalent random UUID) generated in application code |
| `first_name`, `last_name` | Trimmed, required, reasonable length (e.g. 1–80 chars) |
| `username` | Trimmed, case-insensitive uniqueness (store lowercase), 3–32 chars, `[a-z0-9_]` |
| `email` | Trimmed, stored lowercase, valid email shape, unique |
| `password_hash` | Output of the chosen hash function only |
| `sessions.token_hash` | Hash of the cookie value; the raw token is never stored |

### API Endpoints

All auth routes run on the server (App Router route handlers). They must not import client components. JSON bodies; `Content-Type: application/json`.

Session cookie (suggested name: `qm_session`):

- `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`
- Value is a high-entropy random token (not the user id)
- Lifetime: 7 days from issue, sliding optional (not required in this phase)

User objects in responses **omit** `password_hash`.

#### POST /api/auth/register

Creates a user via `userService.create`, then creates a session and sets the cookie.

**Request Body:**

```json
{
  "firstName": "Ada",
  "lastName": "Lovelace",
  "username": "ada",
  "email": "ada@example.com",
  "password": "correct-horse-battery"
}
```

**Response:**

- Success (201): `{ "user": { "id", "firstName", "lastName", "username", "email" } }` and `Set-Cookie`
- Error (400): validation (missing fields, weak password, invalid email/username)
- Error (409): username or email already taken (do not reveal which if we later tighten this; for v1 a clear message per field is acceptable)
- Error (500): unexpected server error

**Password rules (v1):** at least 8 characters. No complexity theater beyond that.

**After success (UI):** navigate to `/quizzes`.

#### POST /api/auth/login

Looks up the user via the user service (username **or** email in a single identifier field), verifies the password against `password_hash`, then creates a session.

**Request Body:**

```json
{
  "identifier": "ada",
  "password": "correct-horse-battery"
}
```

`identifier` is either the username or the email.

**Response:**

- Success (200): same public `user` shape as register, plus `Set-Cookie`
- Error (400): missing fields
- Error (401): unknown identifier or wrong password (same message: “Invalid username/email or password”)
- Error (500): unexpected server error

**After success (UI):** navigate to `/quizzes`.

#### POST /api/auth/logout

Requires a session cookie. Deletes the matching `sessions` row (if present) and clears the cookie.

**Request Body:** none

**Response:**

- Success (200): `{ "ok": true }` and cookie cleared
- Success (200) if already logged out (idempotent logout)
- Error (500): unexpected server error

**After success (UI):** navigate to `/login`.

#### GET /api/auth/me (supporting)

Used by the stub page / layout to render the current user. Not a substitute for register/login/logout, but needed to gate UI.

**Response:**

- Success (200): `{ "user": { ...public user } }`
- Error (401): no valid session

### User Interface Requirements

Use existing shadcn/ui + Tailwind. Keep copy plain. Forms submit to the API routes above (fetch from a client component, or server actions that call the same service — pick one approach in implementation and stay consistent).

#### Register (`/register`)

- Fields: First name, Last name, Username, Email, Password (password input type)
- Client-side: required fields, email format, username pattern, password length
- Server-side: same rules; show field errors from 400/409
- Submit → `POST /api/auth/register` → on success go to `/quizzes`
- Link to `/login` for existing users
- Guest-only: if already authenticated, redirect to `/quizzes`

#### Login (`/login`)

- Fields: Username or email (`identifier`), Password
- Submit → `POST /api/auth/login` → on success go to `/quizzes`
- Generic error on 401 (do not say “email not found”)
- Link to `/register`
- Guest-only: if already authenticated, redirect to `/quizzes`

#### Logout

- Control in the authenticated layout (header): “Log out”
- Submit → `POST /api/auth/logout` → `/login`

#### MCQ stub (`/quizzes`)

- Authenticated only. Unauthenticated → `/login` (preserve `?next=/quizzes` optional)
- Placeholder heading and short copy, e.g. “Quizzes” / “MCQ quizzes will appear here”
- Show signed-in name (first + last or username) so the session is visible
- No question UI, timers, or scoring in this PRD

#### Home (`/`)

- If unauthenticated: primary links to Register and Login
- If authenticated: link to `/quizzes` and Log out

---

## Testing strategy (Vitest, TDD)

Unit tests use **Vitest** (`npm run test`). Follow red → green for every phase:

1. **Red**: write the phase tests listed below first. Run `npm run test`. Those files should fail (missing module, failing assertion, or unimplemented behavior).
2. **Implement** only what those tests require, plus the phase tasks.
3. **Green**: the phase test file(s) pass. Do not start the next phase until they do.
4. **Keep them green**: later phases must not regress earlier tests. The full suite is the gate, together with the acceptance criteria.

Do not hit a real D1 database, network, or Cloudflare account in unit tests. Mock `getDb` / `getCloudflareContext` and `next/headers`. Client components are rendered with Testing Library; Server Components are not.

| Phase | Test files (write these first) | Green when |
|-------|--------------------------------|------------|
| 1 Schema | `src/lib/users/schema.test.ts` | Wrangler binding + migration SQL match the user/session contract |
| 2 User service | `src/lib/auth/password.test.ts`, `src/lib/users/user-service.test.ts` | Hashing, validation, CRUD, unique conflicts |
| 3 Auth API | `src/lib/auth/session.test.ts`, `src/app/api/auth/auth.routes.test.ts` | Cookies/sessions + register/login/logout/me status codes |
| 4 UI | `src/lib/auth/redirect.test.ts`, `src/components/auth/auth-ui.test.tsx` | Forms, generic 401 copy, logout, `/quizzes` navigation |

Commands: `npm run test` (CI / phase gate), `npm run test:watch` (while implementing).

---

## Implementation Phases

### Phase 1: D1 and user schema - COMPLETED

**Objective**: Database exists locally with `users` and `sessions` tables.

**TDD**: Write `src/lib/users/schema.test.ts` first (red). It must fail until the binding and migration exist. Green: `npm run test -- src/lib/users/schema.test.ts`.

**Tasks**:

1. Add the failing schema tests (binding name `DB`, `users` columns including `password_hash`, `sessions.token_hash`, unique indexes)
2. Create the D1 database with Wrangler and add the `d1_databases` binding `DB` to `wrangler.jsonc`
3. Run `npm run cf-typegen`
4. Create a migration for `users` and `sessions` that makes the schema tests pass
5. Apply the migration locally only (`--local`)
6. Add empty placeholders to `.dev.vars.example` if any new vars are introduced (session secret only if a signed-cookie approach is used; opaque D1 sessions may not need one)

**Deliverables**:

- `wrangler.jsonc` D1 binding
- `migrations/` SQL for users and sessions
- Local schema applied
- Phase 1 tests green

### Phase 2: User service - COMPLETED

**Objective**: All user persistence goes through one server module.

**TDD**: Write `src/lib/auth/password.test.ts` and `src/lib/users/user-service.test.ts` first (red). Green: those files pass. Do not start Phase 3 until they do.

**Tasks**:

1. Add failing tests for hashing, validation, create/read/update/delete, and unique conflicts
2. Add `src/lib/users/` with types for `User` (public) and `UserRecord` (includes `password_hash`)
3. Implement `create`, `getById`, `getByUsername`, `getByEmail`, `update`, `delete`
4. Hash passwords inside `create` / `update` when a password is provided; never log hashes or plaintext
5. Use prepared statements with numbered placeholders (`?1`, `?2`)
6. Map unique-index failures to a typed conflict error the API can turn into 409

**Deliverables**:

- User service used by auth routes; no `env.DB` in React components
- Phase 2 tests green

### Phase 3: Auth endpoints and sessions - COMPLETED

**Objective**: Register, login, and logout work against D1.

**TDD**: Write `src/lib/auth/session.test.ts` and `src/app/api/auth/auth.routes.test.ts` first (red). Green: register 201, login 200/401, logout 200, me 401/200, session stores a hash.

**Tasks**:

1. Add failing tests for session cookie vs stored `token_hash` and for each auth route
2. Session helpers: create token, hash token, insert session, lookup by cookie, delete session, set/clear cookie
3. `POST /api/auth/register`
4. `POST /api/auth/login`
5. `POST /api/auth/logout`
6. `GET /api/auth/me`
7. Shared validation for register/login bodies

**Deliverables**:

- Working JSON APIs with cookies on the Workers runtime (`npm run preview` for cookie/`Secure` behavior)
- Phase 3 tests green

### Phase 4: UI and MCQ stub - COMPLETED

**Objective**: A person can register or log in and land on the stub quiz page, then log out.

**TDD**: Write `src/lib/auth/redirect.test.ts` and `src/components/auth/auth-ui.test.tsx` first (red). Green: client validation, generic 401 copy, navigate to `/quizzes` on success, logout to `/login`.

**Tasks**:

1. Add failing UI tests for register, login, logout, and `safeNextPath`
2. `/register` and `/login` pages
3. Authenticated layout with logout
4. `/quizzes` stub, gated on session
5. Home page entry points
6. Middleware or layout-level redirect for `/quizzes`

**Deliverables**:

- End-to-end browser flow: register → stub → logout → login → stub
- Phase 4 tests green
- Full suite green: `npm run test`

---

## Technical Implementation Details

### Key Files

- `migrations/0001_create_users_and_sessions.sql` — Schema
- `wrangler.jsonc` — D1 binding `DB` → `quizmaker-db`
- `src/lib/db.ts` — Obtain `env.DB` via `getCloudflareContext()`; only imported from server modules
- `src/lib/users/user-service.ts` — Create / read / update / delete users
- `src/lib/users/types.ts` — Public user and row types
- `src/lib/users/errors.ts` — Unique constraint and not-found errors
- `src/lib/auth/password.ts` — PBKDF2-SHA-256 hash and verify
- `src/lib/auth/validation.ts` — Register/login/update input rules (no extra Zod dependency)
- `src/lib/auth/session.ts` — Session CRUD and cookies
- `src/lib/auth/http.ts` — JSON error mapping for auth routes
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/register/page.tsx` / `src/components/auth/register-form.tsx`
- `src/app/login/page.tsx` / `src/components/auth/login-form.tsx`
- `src/app/quizzes/page.tsx` — MCQ stub; gated with `getCurrentUser()` (not middleware)
- `src/lib/test/fake-d1.ts` — In-memory D1 stand-in for unit tests
- `src/lib/users/schema.test.ts` — Phase 1
- `src/lib/auth/password.test.ts` / `src/lib/users/user-service.test.ts` — Phase 2
- `src/lib/auth/session.test.ts` / `src/app/api/auth/auth.routes.test.ts` — Phase 3
- `src/lib/auth/redirect.test.ts` / `src/components/auth/auth-ui.test.tsx` — Phase 4

### User service API (contract)

```typescript
type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
};

type CreateUserInput = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string; // plaintext in memory only; hashed before INSERT
};

type UpdateUserInput = {
  firstName?: string;
  lastName?: string;
  username?: string;
  email?: string;
  password?: string; // if present, re-hash
};

interface UserService {
  create(input: CreateUserInput): Promise<PublicUser>;
  getById(id: string): Promise<PublicUser | null>;
  getByUsername(username: string): Promise<PublicUser | null>;
  getByEmail(email: string): Promise<PublicUser | null>;
  // Internal for login only — must not leak to clients
  getRecordForLogin(identifier: string): Promise<{ user: PublicUser; passwordHash: string } | null>;
  update(id: string, input: UpdateUserInput): Promise<PublicUser>;
  delete(id: string): Promise<void>;
}
```

Register and login **must** call this service (or the same module’s functions) rather than issuing SQL in the route file. Route handlers may call session helpers directly.

### Password hashing

Cloudflare Workers is not Node. Prefer **Web Crypto** (PBKDF2-SHA-256, unique salt per user, high iteration count, e.g. 310_000 or current OWASP recommendation) encoded as a single string (`algorithm:iterations:salt:hash`) so no native addon is required.

If a library is proposed later (e.g. a pure-JS bcrypt), **ask before adding the dependency** per project working agreements.

Never use `crypto` Node APIs that are unavailable under Workers without checking `nodejs_compat` behavior in `npm run preview`.

### Implementation Patterns

```typescript
// Server-only: get D1
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return env.DB;
}

// Queries: numbered placeholders only
await db
  .prepare("SELECT id, first_name, last_name, username, email FROM users WHERE username = ?1")
  .bind(username)
  .all();
```

Prefer `results[0]` from `.all()` over `.first()` (D1 local/remote inconsistency).

### Important Notes

- D1 is bound as `DB` (`quizmaker-db`). Schema is applied locally only
- `next.config.ts` calls `initOpenNextCloudflareForDev()`, so `npm run dev` can reach local D1. Still prefer `npm run preview` before a Cloudflare deploy
- Validation is implemented in `src/lib/auth/validation.ts` rather than Zod (no extra dependency)
- `/quizzes` is gated in the page via `getCurrentUser()`, not middleware
- Do not apply migrations with `--remote`
- Do not put secrets in `wrangler.jsonc`
- Unique indexes on `username` and `email` are the source of truth for conflicts; check-then-insert still needs to handle races
- `update` / `delete` are required on the service for later account management; this PRD does not ship public REST for them

---

## Acceptance Criteria

- [x] A `users` table exists (local D1) with primary key, first name, last name, username, email, and password hash
- [x] Passwords are stored only as hashes; plaintext never written to D1 or logs
- [x] User service can create, update, and delete users (service layer; covered by implementation and/or tests)
- [x] `POST /api/auth/register` creates a user through the user service, sets a session cookie, and returns the public user
- [x] `POST /api/auth/login` authenticates via the user service and sets a session cookie
- [x] Invalid login returns 401 with a generic message
- [x] Duplicate username or email on register returns 409
- [x] `POST /api/auth/logout` clears the session so `/quizzes` and `/api/auth/me` no longer succeed
- [x] After register or login, the UI navigates to the MCQ stub (`/quizzes`)
- [x] Unauthenticated access to `/quizzes` redirects to login
- [x] Register and login forms validate required fields and show API errors
- [x] `npm run lint` and `npm run build` pass after implementation
- [x] `npm run test` (Vitest) is green for all phase test files
- [ ] Auth flow verified on the Workers preview runtime (`npm run preview`) — E2E was run on `next dev` with OpenNext D1 bindings (`initOpenNextCloudflareForDev`). Preview was not repeated after `next build` already succeeded.

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Registration completion | User can create an account and reach `/quizzes` without errors | Manual E2E on preview; later automated test |
| Login with hashed password | Stored hash verifies; wrong password never succeeds | Login tests + failed-login case |
| Logout effectiveness | After logout, protected routes reject the old cookie | Call `/api/auth/me` and open `/quizzes` |
| No plaintext passwords | Zero password columns or logs containing the submitted secret | Code review + schema inspection |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** — User and session storage
- **Wrangler** — Create DB, migrations, local apply, typegen
- **Web Crypto** — Password hashing and token generation (Workers-compatible)

### Internal Dependencies

- **User service** (`src/lib/users/`) — All user reads/writes
- **Auth session module** — Cookie + `sessions` table
- **Next.js App Router** — Pages and route handlers
- **shadcn/ui** — Forms and layout chrome

### Environment / config

- `wrangler.jsonc`: `d1_databases` binding named `DB`
- No API keys required for this feature unless a hashing library needing config is approved later

---

## Risks and Mitigation

### Technical Risks

- **Risk**: D1 or cookies work on Node `next dev` but fail on Workers
- **Mitigation**: Treat `npm run preview` as the auth acceptance runtime

- **Risk**: Native password libraries break the Worker build
- **Mitigation**: Use Web Crypto PBKDF2 unless a Workers-safe library is explicitly approved

- **Risk**: Unique constraint races on register
- **Mitigation**: Catch D1 constraint errors and return 409

- **Risk**: Middleware cannot access D1
- **Mitigation**: Authenticate in a server layout / page for `/quizzes`

### User Experience Risks

- **Risk**: Users land on an empty stub and think quizzes are broken
- **Mitigation**: Stub copy states that MCQ content comes in a later feature

- **Risk**: Lockout after typos with no password reset
- **Mitigation**: Out of scope; keep login errors clear; reset is a later PRD

---

## Troubleshooting Guide

Populate during implementation. Starter entries:

### D1 binding is undefined

**Problem**: `env.DB` is missing at runtime.
**Cause**: Binding not in `wrangler.jsonc`, or types not regenerated, or code running on Node `dev` without bindings.
**Solution**: Add `d1_databases`, run `npm run cf-typegen`, verify with `npm run preview`.

### Unique constraint on username/email

**Problem**: Register returns 500 instead of 409.
**Cause**: Constraint error not mapped in the user service.
**Solution**: Translate D1 unique failures in `create` / `update`.

### Session cookie not sent

**Problem**: Login succeeds in JSON but `/quizzes` still redirects to login.
**Cause**: Cookie `Secure` on HTTP localhost, wrong `Path`, or client fetch without `credentials: 'include'`.
**Solution**: Align cookie flags with local preview URL; use same-origin fetch with credentials.

### New App Router pages return 404 in `next dev`

**Problem**: `/register`, `/quizzes`, and `/api/auth/*` 404 while `/` works.
**Cause**: Stale `.next` lock on Windows (`Failed to reload dynamic routes` opening `.next/dev/types/routes.d.ts`).
**Solution**: Stop the existing Next process, then start `npm run dev` again.

---

## Notes for AI Agents

When working with this PRD:

1. Read Overview and Hypothesis first
2. Do not build full MCQs, OAuth, or password reset
3. Add D1 before writing the user service; follow `.cursor/rules/d1.mdc`
4. Follow TDD per phase: write the listed Vitest files first (red), implement, then `npm run test` (green) before the next phase
5. Ask before adding npm dependencies other than the Vitest harness already specified
6. Centralize SQL in `src/lib/`; never from `'use client'`
7. Update phase status, key files, and troubleshooting as work lands
8. Mark acceptance criteria only after lint, tests, build, and a real register/login/logout path
9. Do not run `npm run deploy` or remote D1 migrations unless the user asks
10. Cite code as `filepath:line-number` when updating this document after implementation

---

## Current Status

**Last Updated**: 2026-08-26
**Current Phase**: Phase 4 - UI and MCQ stub
**Status**: COMPLETED
**Next Steps**: Keep `npm run test` green on future work. Optional: confirm auth with `npm run preview`. Real MCQ quizzes remain out of scope. Remote D1 migration is still a human decision.

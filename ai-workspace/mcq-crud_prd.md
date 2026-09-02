Date created: 2026-09-01
Date last modified: 2026-09-01

# MCQ Create, Update, and Delete - Technical PRD

## Overview/Problem

Quiz Maker already has register, login, logout, and a session-gated stub at `/quizzes`. That page tells the signed-in learner that quizzes will appear later. There is no way to author a multiple-choice question, store its choices, change or remove a question, or record that someone picked an answer.

This feature replaces the stub with an authenticated question list and a create/edit page. Persistence goes through a server-only MCQ service and D1, the same way users go through the user service. Attempts are stored against a question so later scoring and history have a real row to attach to.

---

## Hypothesis

We believe that authenticated CRUD for single-select MCQs (name, question, two-to-six choices, one correct answer) plus an attempts API will let a signed-in user manage questions in a table and give later quiz-taking work a stable place to record answers.

---

## Scope

### In Scope

- A Wrangler migration that creates three D1 tables: `mcqs`, `choices`, and `attempts`
- A server-only **MCQ service** that owns all SQL for those tables (create, read, update, delete questions and choices; create attempts)
- HTTP endpoints for listing, creating, reading, updating, and deleting MCQs, and for recording an attempt on an MCQ
- Session-gated UI: expand `/quizzes` into a shadcn **table** of questions (name, question, actions)
- A **Create** button that opens a dedicated create/edit page with Save and Cancel
- Row actions behind a **vertical ellipsis** dropdown: Edit, Preview, Delete
- Default **two** choice fields on the form; user may add up to **six**; exactly **one** choice marked correct
- Preview of a question (choices visible, correct flag not shown to the taker) and submit that writes an attempt
- Vitest TDD per phase, using the in-memory D1 stand-in (no real D1 in unit tests)

### Out of Scope

- Multi-question quizzes, quiz banks, ordering of quizzes, or timed exams
- Multiple correct answers on one question (this phase is single-select)
- AI-generated questions or any AI SDK
- Role-based access (admin vs author vs learner); every signed-in user is an author of their own rows
- Public unauthenticated quiz taking or shareable links
- Analytics dashboards, leaderboards, or attempt history UI beyond recording the attempt on preview
- Email, notifications, or rich text / images in questions
- Changing the auth model (`users`, `sessions`, cookies)

### Cut

- **SQL from `'use client'` components or from route handlers** — Same cut as auth: D1 stays behind `src/lib/`
- **Zod as a new dependency** — Auth validates in a small module; do the same here unless the user approves a package
- **Server Actions as the only mutation path** — This feature uses JSON route handlers like register/login so the service is easy to test at the HTTP boundary
- **Freezing the question forever after one attempt with no copy path** — If attempts exist, **choice text and which choice is correct** must not change (keeps history honest). Name and question may still be edited. Deleting a question is allowed and cascades attempts
- **Applying the new migration with `--remote`** — Local apply only

---

## Technical Requirements

### Database Schema

D1 is already bound as `DB` (`quizmaker-db`). Do **not** rewrite `migrations/0001_create_users_and_sessions.sql`. Add a new migration (for example `0002_mcqs_choices_attempts.sql`) and apply it locally only.

`mcqs.id`, `choices.id`, and `attempts.id` are UUIDs stored as TEXT, generated in application code. SQLite has no boolean type: store `is_correct` as INTEGER `0` or `1`.

`created_by` is required even though the product table is “id, name, question, timestamps”: attempts and ownership need a user. The list UI does not show `created_by`.

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_mcqs_created_by ON mcqs (created_by);
CREATE INDEX idx_mcqs_updated_at ON mcqs (updated_at);

CREATE TABLE choices (
  id TEXT PRIMARY KEY,
  mcq_id TEXT NOT NULL,
  body TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE
);

CREATE INDEX idx_choices_mcq_id ON choices (mcq_id);
CREATE UNIQUE INDEX idx_choices_mcq_id_position ON choices (mcq_id, position);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  mcq_id TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (mcq_id) REFERENCES mcqs(id) ON DELETE CASCADE,
  FOREIGN KEY (choice_id) REFERENCES choices(id) ON DELETE CASCADE
);

CREATE INDEX idx_attempts_user_id ON attempts (user_id);
CREATE INDEX idx_attempts_mcq_id ON attempts (mcq_id);
CREATE INDEX idx_attempts_user_mcq ON attempts (user_id, mcq_id);
```

**Column notes**


| Column                                   | Rules                                                                               |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `mcqs.id` / `choices.id` / `attempts.id` | UUID generated in application code                                                  |
| `mcqs.created_by`                        | Session user id; owner of the question                                              |
| `mcqs.name`                              | Trimmed, required, 1–120 characters                                                 |
| `mcqs.question`                          | Trimmed, required, 1–2000 characters                                                |
| `choices.body`                           | Trimmed, required, 1–500 characters                                                 |
| `choices.is_correct`                     | `0` or `1`; exactly one choice per MCQ must be `1`                                  |
| `choices.position`                       | `0` … `n-1` display order                                                           |
| `attempts.is_correct`                    | Snapshot at submit time from the selected choice; do not recompute from later edits |
| `attempts.choice_id`                     | Must belong to the same `mcq_id`                                                    |


Enable `PRAGMA foreign_keys` in the fake D1 used by tests if the stand-in supports it; production D1 should enforce the FKs in this migration.

### API Endpoints

All routes are App Router handlers on the server. JSON bodies; `Content-Type: application/json`. Every route requires a valid session (same cookie as auth). Unauthenticated → **401**.

Do not put `isCorrect` on choices in list or preview responses. Include `isCorrect` only on owner read (edit form).

Route handlers call the MCQ service; they do not run SQL.

#### GET /api/mcqs

Lists questions for the table. Newest `updated_at` first.

**Response:**

- Success (200): `{ "mcqs": [ { "id", "name", "question", "createdAt", "updatedAt", "isOwner" } ] }`
- Error (401): no valid session
- Error (500): unexpected server error

`isOwner` is true when `created_by` equals the session user. The UI uses it to enable Edit and Delete.

#### POST /api/mcqs

Creates an MCQ and its choices in one request.

**Request Body:**

```json
{
  "name": "HTTP status for created",
  "question": "Which status code means a resource was created?",
  "choices": [
    { "body": "200", "isCorrect": false },
    { "body": "201", "isCorrect": true }
  ]
}
```

**Response:**

- Success (201): `{ "mcq": McqWithChoices }` including `isCorrect` on each choice (owner)
- Error (400): validation (name/question, 2–6 choices, exactly one correct)
- Error (401): no valid session
- Error (500): unexpected server error

**After success (UI):** navigate to `/quizzes`.

#### GET /api/mcqs/:id

Owner-only payload for the edit form.

**Response:**

- Success (200): `{ "mcq": McqWithChoices }` with `isCorrect` on choices
- Error (401): no valid session
- Error (403): signed in but not the owner
- Error (404): unknown id
- Error (500): unexpected server error

#### PUT /api/mcqs/:id

Replaces name, question, and (when allowed) the full choice set.

**Request Body:** same shape as POST.

**Response:**

- Success (200): `{ "mcq": McqWithChoices }`
- Error (400): validation
- Error (401): no valid session
- Error (403): not the owner
- Error (404): unknown id
- Error (409): choices cannot change because at least one attempt exists (name/question-only updates still succeed if the client omits choice changes — simpler v1: **409 the whole PUT** if the request includes a `choices` array and attempts exist; if `choices` is omitted, update name/question only)
- Error (500): unexpected server error

**After success (UI):** navigate to `/quizzes`.

#### DELETE /api/mcqs/:id

Deletes the question. Choices and attempts cascade.

**Request Body:** none

**Response:**

- Success (204): empty body
- Error (401): no valid session
- Error (403): not the owner
- Error (404): unknown id
- Error (500): unexpected server error

#### GET /api/mcqs/:id/preview

Authenticated read for Preview. Any signed-in user.

**Response:**

- Success (200): `{ "mcq": { "id", "name", "question", "choices": [ { "id", "body", "position" } ] } }`
- Error (401): no valid session
- Error (404): unknown id
- Error (500): unexpected server error

Do **not** include `isCorrect`.

#### POST /api/mcqs/:id/attempts

Records one attempt. The service loads the choice, verifies it belongs to the MCQ, copies `is_correct` onto the attempt row.

**Request Body:**

```json
{
  "choiceId": "…"
}
```

**Response:**

- Success (201): `{ "attempt": { "id", "userId", "mcqId", "choiceId", "isCorrect", "createdAt" } }`
- Error (400): missing `choiceId`
- Error (401): no valid session
- Error (404): unknown MCQ or choice not on that MCQ
- Error (500): unexpected server error

Multiple attempts by the same user on the same question are allowed (practice). No uniqueness constraint.

### User Interface Requirements

Use shadcn/ui (Base UI, `base-nova`) and Tailwind. Prefer existing primitives. Add components with `npx shadcn@latest add @shadcn/<name>` when missing:

- **Already in repo:** `button`, `table`, `dialog`, `input`, `label`, `field`, `card`
- **Add if not present:** `dropdown-menu` (ellipsis menu), `textarea` (question)

Keep copy plain. Client components fetch JSON with `credentials: "include"` (same as auth forms). Do not import `getDb` or the MCQ service into `'use client'` files.

#### Question list (`/quizzes`)

Replace the stub copy. Keep `AppHeader` and session gate (`getCurrentUser()`; unauthenticated → `/login?next=/quizzes`).

- Heading, e.g. “Multiple choice questions”
- Primary **Create** button → `/quizzes/new`
- shadcn `Table` with columns: **Name**, **Question**, **Actions**
- Question may truncate in the table (CSS line-clamp); full text on edit/preview
- Empty state: short message plus the same Create button (no blank dead page)
- Actions column: icon button showing **three vertical ellipses** (`EllipsisVertical` from Lucide). Opens shadcn `DropdownMenu`:
  - **Edit** → `/quizzes/[id]/edit` (hidden or disabled when `!isOwner`)
  - **Preview** → `/quizzes/[id]/preview` (all authenticated users)
  - **Delete** → confirm, then `DELETE /api/mcqs/:id`, remove the row (owner only)
- Delete confirmation: shadcn `Dialog` (“Delete this question? This cannot be undone.”). Confirm / Cancel
- Load list with `GET /api/mcqs` (client after mount, or server page calling the service then passing rows to a client table — pick one and stay consistent; server fetch + client actions is preferred so the first paint has data)

#### Create / edit (`/quizzes/new`, `/quizzes/[id]/edit`)

Shared form component. Authenticated only. Edit route: if not owner, redirect to `/quizzes` (or show a short forbidden message).

- Fields: **Name** (`Input`), **Question** (`Textarea`)
- **Choices:** start with **two** rows. Each row: choice text (`Input`), “Correct” control (radio or checkbox group such that only one can be correct), remove button (disabled when only two remain)
- **Add choice** until six rows
- **Save** → `POST /api/mcqs` or `PUT /api/mcqs/:id` → on success `/quizzes`
- **Cancel** → `/quizzes` with no write
- Client required-field checks; show 400 field errors from the API
- If PUT returns 409 (attempts exist), show that choices cannot be changed; allow name/question save if that path is implemented

#### Preview (`/quizzes/[id]/preview`)

- Show name, question, and choice **bodies** as selectable options (radio)
- **Submit** → `POST /api/mcqs/:id/attempts` → show whether the answer was correct using the `isCorrect` field on the attempt response (not from the preview GET)
- **Back** (or Cancel-style control) → `/quizzes`
- No ellipsis menu on this page

#### Home (`/`)

No change required beyond the existing link to `/quizzes`.

---

## Testing strategy (Vitest, TDD)

Unit tests use **Vitest** (`npm run test`). Follow red → green for every phase:

1. **Red**: write the phase tests listed below first. Run `npm run test`. Those files should fail (missing module, failing assertion, or unimplemented behavior).
2. **Implement** only what those tests require, plus the phase tasks.
3. **Green**: the phase test file(s) pass. Do not start the next phase until they do.
4. **Keep them green**: later phases must not regress earlier tests, including auth tests. The full suite is the gate.

Do not hit a real D1 database, network, or Cloudflare account in unit tests. Extend `src/lib/test/fake-d1.ts` so MCQ service tests can insert users, MCQs, choices, and attempts. Mock `getCloudflareContext` / `getDb` and `next/headers` as auth tests do. Client components: Testing Library. Server Components: do not render; test data helpers or client islands.


| Phase         | Test files (write these first)        | Green when                                                                                                          |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1 Schema      | `src/lib/mcqs/schema.test.ts`         | New migration SQL matches `mcqs` / `choices` / `attempts`; `0001` unchanged                                         |
| 2 MCQ service | `src/lib/mcqs/mcq-service.test.ts`    | Validation, CRUD, 2–6 choices, one correct, ownership, attempts snapshot, 409 when rewriting choices after attempts |
| 3 MCQ API     | `src/app/api/mcqs/mcq.routes.test.ts` | Auth 401, list/create/get/put/delete/preview/attempt status codes; preview JSON has no `isCorrect` on choices       |
| 4 UI          | `src/components/mcqs/mcq-ui.test.tsx` | Table columns, Create navigation, ellipsis Edit/Preview/Delete, form two-to-six choices, Save/Cancel, delete dialog |


Commands: `npm run test` (CI / phase gate), `npm run test:watch` (while implementing).

---

## Implementation Phases

### Phase 1: MCQ schema - COMPLETED

**Objective**: Local D1 has `mcqs`, `choices`, and `attempts`.

**TDD**: Write `src/lib/mcqs/schema.test.ts` first (red). Green: `npm run test -- src/lib/mcqs/schema.test.ts`.

**Tasks**:

1. Add failing schema tests (tables, FKs, `is_correct`, timestamps, `created_by`; `0001` must not contain these tables)
2. Create a new Wrangler migration; do not edit `0001`
3. Apply locally only (`npx wrangler d1 migrations apply quizmaker-db --local`)
4. Extend `fake-d1.ts` enough for later service tests (can land in Phase 2 if Phase 1 only reads SQL files)

**Deliverables**:

- New file under `migrations/`
- Local schema applied
- Phase 1 tests green

### Phase 2: MCQ service - COMPLETED

**Objective**: All MCQ, choice, and attempt persistence goes through one server module.

**TDD**: Write `src/lib/mcqs/mcq-service.test.ts` first (red). Green before Phase 3.

**Tasks**:

1. Add failing tests for validation, create/list/get/update/delete, ownership, cascade delete, attempts, and locked choices after attempts
2. Add `src/lib/mcqs/` types, errors, and validation (no Zod unless approved)
3. Implement `list`, `getById`, `create`, `update`, `delete`, `getPreview`, `createAttempt`
4. Use prepared statements with numbered placeholders (`?1`, `?2`)
5. Use a D1 batch (or ordered statements) so an MCQ is never saved without its choices
6. Map not-found and forbidden to typed errors the API can turn into 404/403/409

**Deliverables**:

- MCQ service used by routes; no `env.DB` in React
- Phase 2 tests green

### Phase 3: MCQ HTTP endpoints - COMPLETED

**Objective**: JSON APIs for CRUD and attempts, session required.

**TDD**: Write `src/app/api/mcqs/mcq.routes.test.ts` first (red). Green: 401 without cookie; 201 create; 200 list; owner 200 get; 403 other user get; 204 delete; preview omits `isCorrect`; attempt 201 with server-computed correctness.

**Tasks**:

1. Failing route tests
2. Shared JSON error mapping (reuse auth `http.ts` patterns or a small `src/lib/mcqs/http.ts`)
3. Implement the seven endpoints listed above
4. Resolve session via existing `getCurrentUser()` / session helpers — do not duplicate login

**Deliverables**:

- Working JSON APIs
- Phase 3 tests green

### Phase 4: List, form, preview UI - COMPLETED

**Objective**: A signed-in user can create, edit, preview, and delete questions from `/quizzes`.

**TDD**: Write `src/components/mcqs/mcq-ui.test.tsx` first (red). Green: table headers, Create → `/quizzes/new`, ellipsis items, Save/Cancel, two default choices, add up to six, delete confirm.

**Tasks**:

1. Failing UI tests
2. Add shadcn `dropdown-menu` and `textarea` if missing (`npx shadcn@latest add @shadcn/dropdown-menu` and `@shadcn/textarea`)
3. Replace stub `/quizzes` with table + Create
4. Create/edit pages and shared form
5. Preview page + attempt submit
6. Delete dialog wired to DELETE

**Deliverables**:

- Browser-verifiable authoring flow
- Phase 4 tests green
- Full suite green: `npm run test`
- `npm run lint` and `npm run build` pass

---

## Technical Implementation Details

### Key Files

*(Update paths and line citations as code lands.)*

- `migrations/0002_mcqs_choices_attempts.sql` — Schema: `mcqs` (`question` TEXT), `choices`, `attempts` (`src/lib/mcqs/schema.test.ts`)
- `src/lib/mcqs/types.ts` — Public and row types
- `src/lib/mcqs/errors.ts` — Not found, forbidden, validation, attempts-exist
- `src/lib/mcqs/validation.ts` — Parse MCQ and attempt bodies
- `src/lib/mcqs/mcq-service.ts` — All D1 access for this feature
- `src/lib/db.ts` — Existing `getDb()`; reuse
- `src/lib/test/fake-d1.ts` — Extend for mcqs/choices/attempts
- `src/app/api/mcqs/route.ts` — GET list, POST create
- `src/app/api/mcqs/[id]/route.ts` — GET/PUT/DELETE
- `src/app/api/mcqs/[id]/preview/route.ts` — GET preview
- `src/app/api/mcqs/[id]/attempts/route.ts` — POST attempt
- `src/app/quizzes/page.tsx` — List (was stub)
- `src/app/quizzes/new/page.tsx` — Create
- `src/app/quizzes/[id]/edit/page.tsx` — Edit
- `src/app/quizzes/[id]/preview/page.tsx` — Preview
- `src/components/mcqs/` — Table, row menu, form, delete dialog, preview client
- `src/components/ui/table.tsx`, `button.tsx`, `dropdown-menu.tsx`, `textarea.tsx`, `dialog.tsx`

### MCQ service API (contract)

```typescript
type PublicChoice = {
  id: string;
  body: string;
  isCorrect: boolean;
  position: number;
};

type PublicMcq = {
  id: string;
  name: string;
  question: string;
  createdAt: string;
  updatedAt: string;
};

type McqListItem = PublicMcq & { isOwner: boolean };

type McqWithChoices = PublicMcq & { choices: PublicChoice[] };

type PreviewMcq = PublicMcq & {
  choices: { id: string; body: string; position: number }[];
};

type ChoiceInput = { body: string; isCorrect: boolean };

type CreateMcqInput = {
  name: string;
  question: string;
  choices: ChoiceInput[];
};

type PublicAttempt = {
  id: string;
  userId: string;
  mcqId: string;
  choiceId: string;
  isCorrect: boolean;
  createdAt: string;
};

interface McqService {
  list(viewerId: string): Promise<McqListItem[]>;
  getByIdForOwner(id: string, ownerId: string): Promise<McqWithChoices>;
  create(ownerId: string, input: CreateMcqInput): Promise<McqWithChoices>;
  update(id: string, ownerId: string, input: CreateMcqInput): Promise<McqWithChoices>;
  delete(id: string, ownerId: string): Promise<void>;
  getPreview(id: string): Promise<PreviewMcq>;
  createAttempt(userId: string, mcqId: string, choiceId: string): Promise<PublicAttempt>;
}
```

Routes **must** call this module rather than issuing SQL in the route file.

### Implementation Patterns

```typescript
import { getDb } from "@/lib/db";

const db = await getDb();
await db
  .prepare("SELECT id, name, question, created_at, updated_at FROM mcqs WHERE id = ?1")
  .bind(id)
  .all();
```

Prefer `results[0]` from `.all()` over `.first()`. Insert MCQ then choices with `db.batch([...])` so a failed choice insert does not leave an orphan question.

Validation lives in `src/lib/mcqs/validation.ts` (same style as `src/lib/auth/validation.ts`).

### Important Notes

- Gate `/quizzes` and nested routes with `getCurrentUser()`, not middleware (D1 is not available in middleware)
- List **all** questions so Preview works for others’ rows; mutate only when `created_by` matches
- Preview GET must not leak the correct answer
- `attempts.is_correct` is a snapshot; do not update old attempts if the author later changes the key (they cannot change choices once attempts exist)
- Do not apply migrations with `--remote`
- Do not add npm dependencies without asking
- Do not hand-edit generated shadcn files under `src/components/ui/` except by `shadcn add`
- Auth tests and `/api/auth/*` must stay green

---

## Acceptance Criteria

- [x] Local D1 has `mcqs`, `choices`, and `attempts` with the columns and foreign keys in this PRD
- [x] MCQ service can create, update, and delete questions and their choices; routes do not contain SQL
- [x] Creating a question requires 2–6 choices and exactly one correct choice
- [x] The create form shows two choices by default and can add up to six
- [x] `GET /api/mcqs` returns name, question, and `isOwner` for the table
- [x] `POST /api/mcqs` and `PUT /api/mcqs/:id` persist through the service and require a session
- [x] Non-owners receive 403 on GET (edit), PUT, and DELETE
- [x] `DELETE /api/mcqs/:id` removes the question and cascaded rows
- [x] Preview payload omits which choice is correct; submitting an attempt stores `choice_id` and `is_correct`
- [x] `/quizzes` shows a shadcn table (Name, Question, Actions) and a Create button
- [x] Actions use a vertical ellipsis dropdown: Edit, Preview, Delete
- [x] Create/edit page has Save (persist) and Cancel (back to list without save)
- [x] Unauthenticated visits to `/quizzes` still redirect to login
- [x] `npm run lint`, `npm run test`, and `npm run build` pass after implementation

---

## Success Metrics


| Metric                         | Target                                                           | How Measured                   |
| ------------------------------ | ---------------------------------------------------------------- | ------------------------------ |
| Author can save a question     | Create from `/quizzes/new` appears in the table after Save       | Manual E2E + service/API tests |
| Invalid choice counts rejected | Fewer than 2, more than 6, or zero/two+ correct → 400            | Service and route tests        |
| Preview does not leak the key  | Preview JSON has no `isCorrect` on choices                       | Route test                     |
| Attempt recorded               | After submit, `attempts` row matches selected choice correctness | Service test                   |
| Auth still works               | Register/login/logout tests remain green                         | Full `npm run test`            |


---

## Dependencies

### External Dependencies

- **Cloudflare D1** — `mcqs`, `choices`, `attempts`
- **Wrangler** — New migration, local apply
- **shadcn/ui** — Table, button, dropdown menu, textarea, dialog, field

### Internal Dependencies

- **User service / sessions** — `created_by`, `attempts.user_id`, `getCurrentUser()`
- `**src/lib/db.ts**` — `getDb()`
- `**src/lib/test/fake-d1.ts**` — Unit tests
- **Next.js App Router** — Pages and route handlers
- **Auth UI chrome** — `AppHeader` on quiz pages

### Environment / config

- Existing `wrangler.jsonc` binding `DB`
- No new secrets for this feature

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Fake D1 used in auth tests does not implement the new tables, so service tests pass vacuously or fail randomly
- **Mitigation**: Extend `createFakeD1()` with explicit INSERT/SELECT/DELETE for mcqs, choices, and attempts; assert on stored rows
- **Risk**: Preview accidentally includes `is_correct`
- **Mitigation**: Separate `getPreview` mapper; route test asserts keys
- **Risk**: Updating choices after attempts rewrites history
- **Mitigation**: Service rejects choice replacement when any attempt exists (409)
- **Risk**: D1 batch vs sequential statements leaves orphans
- **Mitigation**: `db.batch` for create/update; tests check no MCQ without choices

### User Experience Risks

- **Risk**: Users think they cannot delete because the ellipsis is easy to miss
- **Mitigation**: Icon button with `aria-label="Question actions"`; keep the menu to three clear items
- **Risk**: Question overflows the table
- **Mitigation**: Truncate in the cell; full text on edit/preview
- **Risk**: Non-owners click Edit and get a confusing 403 page
- **Mitigation**: Hide or disable Edit/Delete when `!isOwner`

---

## Troubleshooting Guide

Populate during implementation. Starter entries:

### Foreign key fails on insert

**Problem**: Creating an MCQ returns 500; D1 mentions FOREIGN KEY.
**Cause**: `created_by` is not a real `users.id`, or choices inserted with a bad `mcq_id`.
**Solution**: Always use the session user id; insert MCQ first, then choices with that id in one batch.

### Preview shows the correct answer

**Problem**: UI highlights or JSON includes `isCorrect` on GET preview.
**Cause**: Reused `getByIdForOwner` for preview.
**Solution**: Use `getPreview` only; compute correctness only after `createAttempt`.

### Choices change after someone practiced

**Problem**: Old attempts look wrong.
**Cause**: PUT replaced choices while attempts existed.
**Solution**: Return 409 from the service when attempts exist and the payload includes choices.

### Table empty after Save but 201 returned

**Problem**: Create succeeds, list looks empty.
**Cause**: Client navigates before refetch, or list query filters by owner incorrectly.
**Solution**: List all rows; after Save, `router.push("/quizzes")` and load `GET /api/mcqs` on the list page.

---

## Notes for AI Agents

When working with this PRD:

1. Read Overview, Hypothesis, and Scope first. Do not build multi-question quizzes, timers, AI generation, or roles
2. Follow TDD per phase: listed Vitest files first (red), implement, `npm run test` green, then the next phase
3. Reuse auth patterns: `getDb()`, numbered placeholders, session cookie, no D1 in client components
4. Ask before adding npm dependencies. Adding a shadcn component via `npx shadcn@latest add @shadcn/...` is expected
5. Update phase status, key files, troubleshooting, and acceptance checkboxes as work lands
6. Mark acceptance criteria only after lint, tests, and build; verify the list and form in the browser when UI tools are available
7. Do not run `npm run deploy` or remote D1 migrations unless the user asks
8. Cite code as `filepath:line-number` when updating this document after implementation
9. If exploratory files already exist under `src/lib/mcqs/` or `migrations/0002_*.sql`, make them match this PRD rather than inventing a second schema
10. Keep `AUTHENTICATION_TECHNICAL_PRD.md` as the source of truth for auth; this file is the source of truth for MCQ CRUD

---

## Current Status

**Last Updated**: 2026-09-01
**Current Phase**: Phase 4 - List, form, preview UI
**Status**: COMPLETED
**Next Steps**: Confirm create/edit/preview in the browser on `npm run dev`. Remote D1 migration is still a human decision.
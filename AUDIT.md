# NyayaSetu — Comprehensive Codebase Audit
**Audited: June 2026 | Status: Pre-production**

> Every flaw, bug, mistake, inconsistency, shortfall, and improvement area found across the entire codebase. Items are grouped by severity and category. File paths and line numbers are given where known.

---

## SEVERITY LEGEND

| Level | Meaning |
|-------|---------|
| **CRITICAL** | Production-blocking. App is insecure or broken without fixing this. |
| **HIGH** | Serious bug or gap that will cause failures or data issues in production. |
| **MEDIUM** | Functional but incorrect, inconsistent, or likely to cause problems at scale. |
| **LOW** | Code quality, maintainability, or minor UX issues. |

---

## SECTION 1 — CRITICAL SECURITY ISSUES

### 1.4 WhatsApp Entry Token Falls Back to No Validation
**File:** `server/src/controllers/auth.controller.js` lines 736–746
**Severity:** HIGH

If Redis is unavailable, `rc.get(redisWaKey)` returns `null` and `storedToken` is `null`. The guard `if (!storedToken || storedToken !== waToken)` then *always* throws — which is actually correct behavior. But if the Redis client object itself throws a connection error before reaching `get()`, the catch in `asyncHandler` may surface a 503 rather than a clean 401. More importantly, there is no in-memory fallback for `wa_entry:` tokens, meaning WhatsApp deep links are completely broken during Redis downtime.

**Fix:** Document this behavior explicitly; consider a short-lived in-memory token store as a degraded fallback, or fail closed with a clear 503.

---

### 1.7 No CSRF Protection
**File:** `server/src/app.js`
**Severity:** MEDIUM

No CSRF token or `SameSite` cookie protection. The API uses Bearer tokens (stateless, which is resistant), but if any endpoint accepts cookies for auth it becomes vulnerable.

**Fix:** For cookie-based flows, add `csurf` or a double-submit cookie pattern. Ensure all state-changing requests require the `Authorization` header.

---

## SECTION 2 — AUTHENTICATION & AUTHORIZATION BUGS

### 2.1 Refresh Token Verification Does Not Check `plan` Sync
**File:** `server/src/controllers/auth.controller.js` lines 635–696
**Severity:** MEDIUM

`signTokenPair()` embeds `plan` in the JWT payload. But plan can change (subscription purchased, cancelled, expired) without the user logging out. The refresh flow re-signs with the *current* user plan — which is correct — but the old access token (15m validity) still carries the old plan. Middleware reads `plan` from the token, not the DB.

**Fix:** For plan-sensitive operations (document generation, PDF download), verify subscription status from DB, not the JWT payload. Or reduce access token TTL to 5 minutes.

---

### 2.2 Paralegal Persona Has No Access Boundary
**File:** `client/src/App.jsx` line 329 + all lawyer controllers
**Severity:** MEDIUM

Paralegals are allowed into `/lawyer/*` routes but the lawyer controllers never check whether a paralegal's firm has an active subscription or whether the specific client they're accessing belongs to their associated lawyer.

**Fix:** Add `requirePersona(['lawyer'])` vs `requirePersona(['lawyer', 'paralegal'])` explicitly per endpoint, and add firm membership checks for paralegal access.

---

### 2.3 Admin Persona Can Be Self-Assigned During Registration
**File:** `server/src/controllers/auth.controller.js` lines 450–458
**Severity:** HIGH

`register()` accepts `persona` from `req.body` and filters out `admin` from `validPersonas`:

```js
const validPersonas = Object.values(PERSONA_MAP).filter(p => p !== PERSONA_MAP.ADMIN);
```

This correctly blocks direct admin registration. However, `notary` persona is in `PERSONAS` but there is no equivalent block — any user can self-register as `notary`. Notary access should be admin-assigned only.

**Fix:** Also exclude `notary` from `validPersonas` in `register()`. Notary assignment should only be possible via an admin API endpoint.

---

## SECTION 3 — DATA & SCHEMA ISSUES

### 3.1 Duplicate/Conflicting Model Files
**Files:**
- `server/src/models/Chat.js` — appears to be a legacy general-purpose chat model
- `server/src/models/ChatSession.model.js` — the active document-creation chat model
- `server/src/models/NyayaBotSession.js` — NyayaBot-specific session

Three separate chat-related models exist. It is unclear which one `chatRoutes.js` (stale) vs `chat.routes.js` (active) uses. Risk of accidentally writing to the wrong collection.

**Fix:** Delete `Chat.js` if it is unused. Audit all imports to confirm only `ChatSession.model.js` is used for document chat.

---

### 3.2 Soft-Delete Not Consistently Applied
**Files:** Multiple document/case controllers
**Severity:** MEDIUM

`Document.model.js` has `isDeleted: { type: Boolean, default: false }`. Soft-delete is applied in `DELETE /documents/:id`, and `listDocuments` adds `filter.isDeleted = false`. However, other document-adjacent endpoints (clause explain, PDF download, share, link-case) fetch documents by ID without always checking `isDeleted`. A deleted document can still be shared or have its clause explained.

**Fix:** Add a `{ isDeleted: false }` filter to every `Document.findById()` call, or add a Mongoose pre-find hook that applies it globally.

---

### 3.3 Free Usage `resetDate` Uses Server UTC, Not User's Timezone
**File:** `server/src/models/User.model.js` lines 255–267
**Severity:** MEDIUM

`freeUsage.resetDate` is set to "1st of next month at 00:00:00 UTC" in the pre-save hook. The Bull job `resetFreeQuota.js` triggers at UTC midnight on the 1st. A user in IST (+5:30) would have their quota reset at 5:30 AM IST, while a user in UTC-5 would reset at 7:00 PM local time the day before.

**Fix:** Document this behavior and accept UTC as the canonical reset time. Or store the user's timezone and adjust the reset trigger per user (complex). At minimum, surface the reset time in the UI in local time.

---

### 3.4 `lawyerEarnings` Always Zero
**File:** `server/src/models/Payment.model.js` + `payment.controller.js`
**Severity:** MEDIUM

The `Payment` model has `lawyerEarnings` and `platformEarnings` fields, and the architecture documents a 90%/92% revenue split. But the payment controller sets `lawyerEarnings: 0` for all consultation payments. The earnings panel likely always shows ₹0.

**Fix:** Implement the split calculation: `lawyerEarnings = Math.round(amount * lawyerProfile.referralFeePercent / 100)`.

---

### 3.5 `casesTracked` Counter Never Decremented
**File:** `server/src/models/User.model.js` + `case.controller.js`
**Severity:** MEDIUM

`freeUsage.casesTracked` is incremented when a case is added. When a case is deleted (`DELETE /cases/:id`), the counter is never decremented. A free user who adds and deletes a case still loses their quota slot permanently.

**Fix:** Decrement `freeUsage.casesTracked` by 1 in the delete case controller, with a floor of 0.

---

### 3.6 `ChatSession` TTL Index Partial Filter Expression
**File:** `server/src/models/ChatSession.model.js`
**Severity:** LOW

The architecture spec documents a TTL index on ChatSession to auto-expire abandoned sessions after 7 days. Verify this index is actually created with `partialFilterExpression: { status: 'active' }`. If the TTL index exists without the partial filter, it will delete ALL sessions (including completed ones) after 7 days.

---

### 3.7 `refreshTokens` Array Validator Not Atomic
**File:** `server/src/models/User.model.js` lines 166–173
**Severity:** LOW

```js
validator: (arr) => arr.length <= MAX_REFRESH_TOKENS,
```

This validator fires on save, not during the concurrent push. Two simultaneous refresh calls could both pass the validator and push, exceeding the limit. The `addRefreshToken` method uses `findByIdAndUpdate` (atomic), but the inline validator is not enforced at the DB level.

**Fix:** Rely solely on the `addRefreshToken` logic (which already caps via `splice`) and remove the schema-level validator, or add a `$push + $slice` atomic update.

---

## SECTION 4 — DUPLICATE & STALE FILES

### 4.1 Duplicate Chat Routes File
**Files:**
- `server/src/routes/chatRoutes.js` — stale, uses wrong middleware import path (`../middleware/auth` instead of `../middleware/auth.middleware`)
- `server/src/routes/chat.routes.js` — active

**Fix:** Delete `server/src/routes/chatRoutes.js`.

---

### 4.2 Duplicate Chat Controller File
**Files:**
- `server/src/controllers/chatController.js` — stale
- `server/src/controllers/chat.controller.js` — active

**Fix:** Delete `server/src/controllers/chatController.js`.

---

### 4.3 Duplicate Email Service File
**Files:**
- `server/src/services/emailService.js` — root-level duplicate, different provider logic
- `server/src/services/notification/emailService.js` — canonical, used by controllers

**Fix:** Delete `server/src/services/emailService.js` (root level).

---

### 4.4 NyayaBot Routes Mounted Twice
**File:** `server/src/app.js` lines 138 + 174
**Severity:** MEDIUM

```js
app.use('/v1/nyayabot', nyayabotRoutes);  // line 138 (before global limiter block)
// ...
app.use('/v1/nyayabot', nyayabotRoutes);  // line 174 (inside route block)
```

The same router is registered twice. Express will execute both handlers, meaning requests hit the controller twice. This can cause double DB writes or double AI calls.

**Fix:** Remove the duplicate mount. Keep only line 174.

---

### 4.5 Notary Routes Mounted at Root `/v1` Instead of `/v1/notary`
**File:** `server/src/app.js` line 177
**Severity:** MEDIUM

```js
app.use('/v1', notaryRoutes);
```

All other domain routes use scoped prefixes (`/v1/cases`, `/v1/documents`, etc.). Mounting notary at `/v1` means its paths must be unique across the entire API surface or they'll shadow other routes.

**Fix:** Mount at `/v1/notary`. Update all notary route definitions accordingly.

---

### 4.6 Outer `worker/` Workspace Is Near-Empty Stub
**File:** `worker/src/worker.js`
**Severity:** MEDIUM

The outer `worker/` npm workspace (`package.json` `"workspaces": ["client", "server", "worker"]`) contains only a stub `worker.js` that references `../server/src/worker/jobs/...` — a path that doesn't exist relative to the worker workspace.

All actual working job code lives in `server/src/worker/`. The outer workspace is misleading and non-functional.

**Fix:** Either delete the outer `worker/` workspace and remove it from the workspaces array, or move `server/src/worker/` into it properly as a real standalone process.

---

## SECTION 5 — INPUT VALIDATION & API DESIGN

### 5.1 Email Regex Too Permissive
**File:** `server/src/controllers/auth.controller.js` line 59
**Severity:** MEDIUM

```js
/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
```

Accepts `a@b.c`, `test@.com`, `x@y.12345` as valid emails. Use a proper library (`validator.js` `isEmail()`) instead of a home-grown regex.

---

### 5.2 No Pagination on Several List Endpoints
**Severity:** MEDIUM

Endpoints that may return large result sets without enforced pagination:
- `GET /v1/admin/users` — could return millions of users
- `GET /v1/notifications` — no page limit documented
- `GET /v1/chat/sessions` — no cap

**Fix:** Enforce `limit` (max 100) and `cursor`/`page` on all list endpoints.

---

### 5.3 No File Signature (Magic Bytes) Validation on Voice Upload
**File:** `server/src/routes/chat.routes.js` lines 20–32
**Severity:** MEDIUM

Multer only checks `file.mimetype`. Clients can spoof the MIME type to upload arbitrary files by labeling them as `audio/wav`. The file header (magic bytes) is never checked.

**Fix:** After upload, read the first 4 bytes of the buffer and validate against known audio magic numbers before passing to Whisper.

---

### 5.4 Inconsistent Error Response Shape
**Severity:** MEDIUM

Different controllers return errors in different shapes:
```js
{ error: 'CODE', message: '...' }                        // most controllers
{ error: 'CODE', message: '...', fields: {...} }         // validation errors
{ error: 'CODE', message: '...', upgradeUrl: '...' }     // quota errors
{ errorCode: 'CODE', errorMessage: '...' }               // some older code
```

The frontend likely cannot reliably parse all of these.

**Fix:** Enforce a single error schema via `error.middleware.js` and document it. Standardize on `{ error: string, message: string, details?: object }`.

---

### 5.5 Document Content Returned Without HTML Sanitization
**File:** `server/src/controllers/document.controller.js`
**Severity:** MEDIUM

`document.content` (Markdown) and `document.contentHtml` (HTML) are returned to the client as-is. If the AI generates content containing `<script>` tags or event handlers (prompt injection scenario), and the frontend renders `contentHtml` as raw HTML, this becomes stored XSS.

**Fix:** Run `contentHtml` through `DOMPurify` (client) or `sanitize-html` (server) before storage and/or before rendering.

---

### 5.6 `state` and `district` Fields Accept Any String
**Severity:** LOW

User-provided `state` and `district` are stored as freeform strings with only `.trim()` applied. This causes inconsistency in case tracking and jurisdiction rules (e.g., "Maharashtra", "maharashtra", "MH" all stored as separate values).

**Fix:** Normalize against a canonical list of Indian states/districts. Use an enum at the DB level, or normalize on write.

---

## SECTION 6 — MISSING IMPLEMENTATIONS

### 6.1 Video Consultation Provider Is a Stub
**File:** `server/src/services/video/videoProvider.js`
**Severity:** HIGH

File exists but contains no actual implementation. Lawyer-citizen video consultations (a key paid feature) have no backend support.

**Fix:** Integrate a video provider (Daily.co, Jitsi Meet, or Twilio Video). Implement `createRoom(consultationId)` and `getToken(userId, room)` functions.

---

### 6.2 ThemeSwitcher Component Commented Out
**File:** `client/src/App.jsx` lines 200–203
**Severity:** MEDIUM

```jsx
{/* <Suspense fallback={null}>
  <ThemeSwitcher />
</Suspense> */}
```

The component exists (`ThemeSwitcher.jsx`) but is commented out in the layout. Users have no way to switch themes from the UI (except through Settings).

**Fix:** Uncomment or provide theme switching in Settings page explicitly.

---

### 6.3 Only 2 of 11 Language Translations Populated
**Files:** `client/public/locales/` and `client/dist/locales/`
**Severity:** HIGH

Only `en/translation.json` and `hi/translation.json` exist with actual content. The other 9 supported languages (bn, mr, ta, te, gu, kn, ml, pa, ur) fall back to English. The language selector shows all 11, making it appear the app supports them when it does not.

**Fix:** Either populate the translation files or hide non-ready languages in `LanguageSelector.jsx` behind a "Coming soon" indicator.

---

### 6.4 MUI RTL Not Configured for Urdu
**Severity:** MEDIUM

The app sets `document.dir = 'rtl'` for Urdu, but MUI requires an RTL transform plugin (`stylis-plugin-rtl`) configured in the theme for MUI components to actually mirror correctly. Without it, MUI components render in LTR even when the page direction is RTL.

**Fix:** Add `stylis-plugin-rtl` and configure it in `ThemeProvider.jsx` when `dir === 'rtl'`.

---

### 6.5 Admin Controller Is Thin
**File:** `server/src/controllers/admin.controller.js` (if it exists) + `server/src/routes/admin.routes.js`
**Severity:** HIGH

The admin routes mount endpoints for user management, lawyer verification, template CRUD, and platform stats. However, the admin dashboard UI (`AdminDashboard.jsx`, `AdminUsers.jsx`, `AdminLawyers.jsx`, `AdminTemplates.jsx`, `AdminAuditLog.jsx`) exists but the verification approval flow (accept/reject lawyer, toggle user active, etc.) appears incomplete on both ends.

**Fix:** Implement `POST /admin/lawyers/:id/verify` with proper status transitions and notification dispatch. Implement `PATCH /admin/users/:id/toggle-active`. Verify all admin endpoints are protected with `requirePersona('admin')`.

---

### 6.6 Pay-Per-Doc Frontend Flow Incomplete
**Severity:** HIGH

The architecture documents a pay-per-doc flow (₹49/₹99/₹199). The `Payment` model, Razorpay service, and route exist. But there's no visible UI gate in `DocumentPreview.jsx` or `NewDocument.jsx` that intercepts free users who've exceeded their quota and routes them to pay per document before downloading.

**Fix:** In `DocumentPreview.jsx`, if user is on free plan and `freeUsage.docsGenerated >= docsLimit`, show a payment gate component before showing the PDF download button.

---

### 6.7 Subscription Renewal / Cancellation UI Missing
**Severity:** MEDIUM

`POST /subscriptions/cancel` exists on the server. `Settings.jsx` does not appear to expose a "Cancel subscription" or "Manage billing" UI. Users have no self-serve way to cancel.

**Fix:** Add a subscription management section to Settings with current plan details, next renewal date, and cancel option.

---

### 6.8 WhatsApp State Machine Backend Not Wired
**File:** `server/src/controllers/whatsapp.controller.js`
**Severity:** HIGH

The WhatsApp flow is documented as a state machine with phases (`WELCOME → SELECT_TEMPLATE → CHAT_FLOW → ...`). The webhook handler exists, but the state machine implementation (`processWhatsAppMessage`) and phase transitions appear to be stubs or incomplete.

**Fix:** Implement the full state machine, mapping WhatsApp text inputs to the same question/answer flow used in the web ChatFlow.

---

### 6.9 Paralegal Persona Has No Dedicated Pages
**Severity:** MEDIUM

Paralegals use `/lawyer/*` routes (allowed in `ProtectedRoute`). But the Sidebar, Navbar, and lawyer pages don't differentiate between lawyer and paralegal, and there are no paralegal-specific views (e.g., limited to only cases assigned by their lawyer).

---

### 6.10 Document Versioning UI Not Built
**Severity:** LOW

The `Document` model has `version` and `previousVersions[]` fields, and `POST /documents/:id/regenerate` exists. But there is no UI to view or restore previous document versions.

---

### 6.11 `CalendarPage` Exists but Hook/Page Appears Newly Added
**Files:** `client/src/pages/shared/CalendarPage.jsx` + `client/src/hooks/useCalendarEvents.js`
**Severity:** LOW (git status shows these as untracked `??`)

These files are new and untracked. The route is wired (`/citizen/calendar`, `/lawyer/calendar`, etc.) but the page's connection to real hearing dates from `CaseTracker` needs verification.

---

## SECTION 7 — BACKEND CODE QUALITY

### 7.1 `asyncHandler` Defined in Two Places
**Files:**
- `server/src/utils/asyncHandler.js`
- `server/src/routes/asyncHandler.js`

**Fix:** Delete `server/src/routes/asyncHandler.js`. All imports should point to `utils/asyncHandler.js`.

---

### 7.2 Magic Numbers Spread Across Files
**Severity:** LOW

Values like `300` (OTP TTL), `900` (attempt TTL), `15 * 60 * 1000` (rate limit window), `30` (share token days), `5` (max OTP attempts) appear in multiple files. They should all live in `server/src/config/constants.js`.

---

### 7.3 Health Check Doesn't Verify Dependencies
**File:** `server/src/app.js` lines 141–157
**Severity:** MEDIUM

`GET /health` returns `{ status: 'ok' }` regardless of whether MongoDB or Redis is reachable. A load balancer relying on this health check won't know the service is degraded.

**Fix:**
```js
app.get('/health', async (req, res) => {
  const mongoOk = mongoose.connection.readyState === 1;
  const redisOk = await redisClient?.ping().then(() => true).catch(() => false);
  const status = mongoOk && redisOk ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({ status, mongo: mongoOk, redis: redisOk });
});
```

---

### 7.4 No Startup Validation of Required Environment Variables
**File:** `server/src/server.js`
**Severity:** MEDIUM

If `JWT_SECRET`, `MONGO_URI`, or `RAZORPAY_KEY_SECRET` are missing, the server starts but fails on first use with a cryptic error. There's no early validation that surfaces missing config clearly.

**Fix:** Add a startup check (using `zod` or a simple manual list) that throws an error with a clear message listing all missing required variables before `startServer()` continues.

---

### 7.5 No Request ID / Correlation ID Middleware
**Severity:** LOW

Requests have no unique ID attached. When errors are logged, there's no way to correlate a specific user complaint with a specific log line across the Winston logger, MongoDB, and Redis.

**Fix:** Add `express-request-id` middleware early in `app.js`. Include `req.id` in all log messages and error responses.

---

### 7.6 SSE Streams Not Cleaned Up on Client Disconnect
**File:** `server/src/controllers/chat.controller.js` (SSE handler)
**Severity:** MEDIUM

When the client disconnects mid-stream (e.g., closes the tab), the AI stream continues running server-side until it completes, wasting AI API calls and memory.

**Fix:**
```js
req.on('close', () => {
  aiStream.cancel(); // abort the AI stream
  res.end();
});
```

---

### 7.7 `eCourts` Client Has No Retry or Circuit Breaker
**File:** `server/src/services/ecourts/ecourtsClient.js`
**Severity:** MEDIUM

The eCourts API is unreliable (rate limits, downtime). A single `axios.get()` with a 10s timeout, falling back to a scraper, is insufficient. Repeated failures (e.g., eCourts down for 1 hour) cause every `POST /cases` and `POST /cases/:id/refresh` to wait 10 seconds before failing.

**Fix:** Add exponential backoff (via `axios-retry`) and a circuit breaker (via `opossum`). Cache successful responses in Redis with a 1-hour TTL.

---

### 7.8 Bull Worker Job Errors Are Silently Swallowed
**File:** `server/src/worker/worker.js`
**Severity:** MEDIUM

If Bull jobs fail (AI API error, DB write error), there's no configured `failed` event handler to log or alert. Failed jobs pile up in the failed queue with no visibility.

**Fix:**
```js
queue.on('failed', (job, err) => {
  logger.error(`[Bull] Job ${job.name} #${job.id} failed: ${err.message}`);
  // Optionally: notify via Slack/email for critical jobs
});
```

---

### 7.9 Mongoose Connection Not Re-Used Across Worker and Server
**Severity:** LOW

If server and worker run as separate processes (which they should in production), each maintains its own MongoDB connection pool. With many workers, connection count could hit Atlas M0's 500-connection limit.

**Fix:** Use a shared connection pool or configure `maxPoolSize` appropriately per process type.

---

## SECTION 8 — FRONTEND CODE QUALITY

### 8.1 Two Separate Chat/Bot Slices for the Same Widget
**Files:**
- `client/src/store/slices/chatBotSlice.js`
- `client/src/store/slices/nyayabotSlice.js`

**Severity:** MEDIUM

Two Redux slices appear to manage the NyayaBot widget state. It's unclear which one is active. This causes confusion and may result in stale state.

**Fix:** Consolidate into a single `nyayabotSlice.js` and delete the other.

---

### 8.2 Sidebar Loads Lordicon Icons from CDN at Runtime
**File:** `client/src/components/layout/Sidebar.jsx` lines 38–54
**Severity:** MEDIUM

All 14 sidebar icons are loaded via `https://cdn.lordicon.com/xxx.json` URLs at runtime. This means:
- 14 network requests on every page load
- App is visually broken if CDN is down
- No icon caching strategy

**Fix:** Download the JSON icon files locally into `client/public/icons/` and serve them from the same origin.

---

### 8.3 `localStorage` Token Checked in Multiple Places Inconsistently
**Files:** `client/src/App.jsx` lines 131, 145, 523 + `client/src/services/api.js`
**Severity:** LOW

`localStorage.getItem('nyayasetu_token')` is accessed in at least 4 places. Some components check it, some use Redux auth state, some use both. If the key name changes or the storage strategy changes, all these sites must be updated.

**Fix:** Create a single `tokenStore.js` utility with `get()`, `set()`, `clear()` methods.

---

### 8.4 No Skeleton Loaders for Initial Data Fetches
**Severity:** MEDIUM

`CitizenHome.jsx`, `MyDocuments.jsx`, `CaseDashboard.jsx`, and `ClientList.jsx` all make API calls on mount. While data is loading, pages either show nothing or a spinner. MUI `Skeleton` is imported in some files but not consistently used.

**Fix:** Add skeleton placeholders for list views (3–5 skeleton cards) while data loads.

---

### 8.5 `AnimatePresence` Wraps Fragment, Not Direct Motion Children
**File:** `client/src/App.jsx` lines 188–194
**Severity:** LOW

```jsx
<AnimatePresence mode="wait" initial={false}>
  <React.Fragment key={location.pathname}>
    <Suspense fallback={<PageLoader />}>
      <Outlet />
    </Suspense>
  </React.Fragment>
</AnimatePresence>
```

`AnimatePresence` requires its direct children to be `motion.*` components (or components that forward refs to motion components) to animate. Wrapping in a `Fragment` means the exit animation never fires. Page transitions only work if `AnimatedPage` is used inside each page component.

**Fix:** Ensure all page components wrap their outermost element with `<AnimatedPage>`. Or replace the Fragment with a `motion.div`.

---

### 8.6 `CitizenProfile.jsx` Page Has No Route
**File:** `client/src/pages/citizen/CitizenProfile.jsx`
**Severity:** LOW

The file exists but there is no route in `App.jsx` that renders it. The `/citizen/profile` path redirects to `/citizen/settings`. The profile page is unreachable.

**Fix:** Either add a route for it or delete the file and consolidate profile editing into `Settings.jsx`.

---

### 8.7 Service Worker Only Registered in PROD
**File:** `client/src/App.jsx` lines 574–580
**Severity:** LOW

The service worker (for PWA offline support) is only registered when `import.meta.env.PROD === true`. This means PWA features can never be tested locally.

**Fix:** Accept this as intentional dev behavior but document it. Alternatively, add a `VITE_ENABLE_SW=true` env flag to allow dev testing.

---

### 8.8 No Offline Queue for Failed Mutations
**Severity:** MEDIUM

The app is described as a PWA, implying it should work offline. But there is no offline mutation queue — if the user creates a document or adds a case while offline, the request simply fails with a network error and the data is lost.

**Fix:** Use a service worker background sync strategy or an offline-first library (like `redux-offline`) to queue mutations and replay them when connectivity is restored.

---

## SECTION 9 — TESTING GAPS

### 9.1 Coverage Is Under 10%
**Files:** `server/tests/auth.test.js`, `server/tests/payment.test.js`
**Severity:** HIGH

Only two test files exist for the entire backend. Zero frontend tests. Missing coverage for:
- Chat session creation and message flow
- Document generation (queue + job)
- Case add/refresh from eCourts
- Lawyer profile application + admin verification
- Subscription creation and webhook verification
- Razorpay webhook HMAC verification
- Quota enforcement and monthly reset
- Notification dispatch
- WhatsApp webhook handler
- NyayaBot session flow

**Fix:** Add Jest integration tests using `mongodb-memory-server` and `supertest` for all controllers. Target 80% coverage before production.

---

### 9.2 No End-to-End Tests
**Severity:** MEDIUM

No Playwright/Cypress tests for:
- Full citizen flow: register → new document → chat → preview → download
- Full lawyer flow: apply → admin verify → client appears → accept consultation
- Payment flow: create order → mock payment → webhook → document unlocked

---

### 9.3 No Load Tests
**Severity:** MEDIUM

No k6/Artillery scripts to verify:
- SSE streaming under 50 concurrent users
- Bull queue throughput for document generation
- MongoDB query performance on filtered case/document lists

---

## SECTION 10 — INFRASTRUCTURE & DEPLOYMENT

### 10.1 No `.env.example` Committed
**Severity:** HIGH

There is a reference to `.env.example` in the README and architecture doc, but no `.env.example` file was found at the root level. New contributors have no reference for required environment variables.

**Fix:** Create `.env.example` with all variables listed (values redacted/example placeholders).

---

### 10.2 Docker Compose Missing Worker Service
**File:** `docker-compose.yml`
**Severity:** MEDIUM

The docker-compose file likely has `mongo`, `redis`, `server`, and `client` services but not a separate `worker` service. Since the worker code actually lives inside `server/src/worker/`, it needs to run as a separate process in production.

**Fix:** Add a `worker` service to `docker-compose.yml` that runs `node server/src/worker/worker.js` with the same environment as `server`.

---

### 10.3 No Secrets Rotation Strategy
**Severity:** MEDIUM

All secrets (`JWT_SECRET`, `RAZORPAY_KEY_SECRET`, `FIELD_ENCRYPTION_KEY`, etc.) are static in `.env`. There is no mechanism to rotate secrets without a restart, and no integration with AWS Secrets Manager, HashiCorp Vault, or similar.

---

### 10.4 Graceful Shutdown Doesn't Drain Bull Queues
**File:** `server/src/server.js` lines 67–98
**Severity:** MEDIUM

On `SIGTERM`, the server closes the HTTP server and MongoDB/Redis connections. But in-flight Bull jobs are abandoned mid-execution (e.g., a PDF generation job that's half done).

**Fix:** Before closing connections, call `await queue.close()` on all Bull queues to let in-flight jobs complete.

---

## SECTION 11 — MISSING FEATURES (PLANNED BUT NOT BUILT)

| Feature | Planned In | Status |
|---------|-----------|--------|
| Paralegal dedicated pages | Architecture v2 | Not built |
| WhatsApp state machine | Architecture v2 | Incomplete |
| Document versioning UI | Architecture v2 | Not built |
| Video consultation | Architecture v2 | Stub only |
| Pay-per-doc UI gate | Architecture v2 | Missing |
| Subscription management UI | Architecture v2 | Missing |
| Admin lawyer approval flow | Architecture v2 | Incomplete |
| 9 additional languages | Architecture v2 | Empty files |
| MUI RTL for Urdu | Architecture v2 | Not configured |
| PWA offline sync | Architecture v2 | Not implemented |
| Indian Kanoon law citations in docs | Architecture v2 | Service exists, integration TBD |
| Audit logging for all critical operations | Architecture v2 | Partial |
| Share token expiry enforcement | Architecture v2 | Needs verification |
| Subscription auto-renewal worker job | Architecture v2 | Not found |
| ThemeSwitcher floating widget | Architecture v2 | Commented out |
| Paralegal firm membership checks | Architecture v2 | Not implemented |

---

## QUICK WINS (Can Fix in Under 1 Hour Each)

| Fix | File | Time |
|----|------|------|
| Delete `chatRoutes.js` (stale) | `server/src/routes/chatRoutes.js` | 2 min |
| Delete `chatController.js` (stale) | `server/src/controllers/chatController.js` | 2 min |
| Delete root `emailService.js` (duplicate) | `server/src/services/emailService.js` | 2 min |
| Remove duplicate `nyayabotRoutes` mount | `server/src/app.js` line 138 | 2 min |
| Change notary route mount to `/v1/notary` | `server/src/app.js` line 177 | 5 min |
| Add `req.on('close')` to SSE handlers | Chat + document controllers | 15 min |
| Add `{ isDeleted: false }` to all Document findById | Document controller | 10 min |
| Decrement `casesTracked` on case delete | Case controller | 5 min |
| Add missing AI rate limits | `server/src/app.js` | 10 min |
| Merge `chatBotSlice` into `nyayabotSlice` | Client store | 20 min |

---

## CRITICAL PATH TO PRODUCTION

Must-fix before any public deployment:

1. **Re-enable OTP verification** (`auth.controller.js` lines 317–404)
2. **Remove lawyer auto-verification on `NODE_ENV`** (`auth.controller.js` line 513)
3. **Block `notary` persona self-registration** (`auth.controller.js` `validPersonas`)
4. **Sync feature flags** (client + server share one source of truth)
5. **Add all missing AI rate limits** (`app.js`)
6. **Add `.env.example`** to repo root
7. **Fix duplicate `nyayabotRoutes` mount** (`app.js` line 138)
8. **Add health check with real dependency probes**
9. **Implement `req.on('close')` for SSE cleanup**
10. **Write tests for auth, payment webhook, quota enforcement** (>50% coverage minimum)

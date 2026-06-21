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

## SECTION 3 — DATA & SCHEMA ISSUES

### 3.1 Duplicate/Conflicting Model Files
**Files:**
- `server/src/models/Chat.js` — appears to be a legacy general-purpose chat model
- `server/src/models/ChatSession.model.js` — the active document-creation chat model
- `server/src/models/NyayaBotSession.js` — NyayaBot-specific session

Three separate chat-related models exist. It is unclear which one `chatRoutes.js` (stale) vs `chat.routes.js` (active) uses. Risk of accidentally writing to the wrong collection.

**Fix:** Delete `Chat.js` if it is unused. Audit all imports to confirm only `ChatSession.model.js` is used for document chat.

---

### 3.3 Free Usage `resetDate` Uses Server UTC, Not User's Timezone
**File:** `server/src/models/User.model.js` lines 255–267
**Severity:** MEDIUM

`freeUsage.resetDate` is set to "1st of next month at 00:00:00 UTC" in the pre-save hook. The Bull job `resetFreeQuota.js` triggers at UTC midnight on the 1st. A user in IST (+5:30) would have their quota reset at 5:30 AM IST, while a user in UTC-5 would reset at 7:00 PM local time the day before.

**Fix:** Document this behavior and accept UTC as the canonical reset time. Or store the user's timezone and adjust the reset trigger per user (complex). At minimum, surface the reset time in the UI in local time.

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


## SECTION 8 — FRONTEND CODE QUALITY

### 8.1 Two Separate Chat/Bot Slices for the Same Widget
**Files:**
- `client/src/store/slices/chatBotSlice.js`
- `client/src/store/slices/nyayabotSlice.js`

**Severity:** MEDIUM

Two Redux slices appear to manage the NyayaBot widget state. It's unclear which one is active. This causes confusion and may result in stale state.

**Fix:** Consolidate into a single `nyayabotSlice.js` and delete the other.

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

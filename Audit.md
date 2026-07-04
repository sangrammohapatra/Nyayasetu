# NyayaSetu Codebase Audit

**Date:** 2026-07-04
**Scope:** Full monorepo — `server/` (Express/Mongoose/Bull), `client/` (React 18 + Redux Toolkit + MUI PWA), `worker/` (stub), `shared/`.
**Method:** Systematic read-only review across routes, controllers, middleware, models, services, worker jobs, pages, Redux store, hooks, and static-analysis pass for unused files. Every finding below was verified against actual file content (file path + line numbers given); nothing here is speculative.

> Note on file:line references — the codebase changes over time; if a line number looks off when you go to fix something, the surrounding function name and description should still get you to the right spot.

---

## How to use this document

Findings are grouped **Critical → High → Medium → Low**, then a separate **Dead Code / Unused Files** section, then **Repo Hygiene**. Within each severity tier, findings are grouped by area (Backend / Frontend). Each finding has: file:line, a one-line description, and a concrete failure scenario (what input/action triggers it).

---

## Critical

Issues that are either actively broken in normal operation, or are real security/financial exploits.

### Backend

1. **`server/src/services/ai/claudeClient.js:17` — deprecated/retired Claude model ID.**
   `MODEL = 'claude-sonnet-4-20250514'` retired **2026-06-15**; today's date is 2026-07-04, so this ID is already past retirement.
   **Failure scenario:** every AI call routed through `AI_PROVIDER=claude` (document generation, RTI drafting, triage, NyayaBot) fails with a 404 `not_found_error` — the entire Claude-backed AI pipeline is down. **Fix immediately** — swap to a current model ID.

2. **`server/src/controllers/payment.controller.js:175-259` (`verifyDocumentPayment`) — payment/entity binding never checked (financial exploit).**
   The Payment record is looked up only by `razorpayOrderId`; the target `documentId`/`consultationId` is checked for ownership but never cross-checked against `payment.relatedEntity` (the item the order was actually created for).
   **Failure scenario:** attacker creates an order for a cheap ₹49 document (doc A), pays it, then calls `POST /v1/payments/verify` with that real `orderId/paymentId/signature` but `documentId` = an expensive ₹199 document (doc B) they own — signature check passes (it only proves paymentId↔orderId binding), and doc B gets unlocked for the price of doc A. Same gap exists for `consultationId`.

3. **`server/src/controllers/payment.controller.js:360-483` (`verifySubscription`) — plan/amount never validated against the actual paid order (financial exploit).**
   `plan`, `billingCycle`, `persona` are taken straight from the request body; nothing fetches the Razorpay order and compares its notes/amount to what's claimed.
   **Failure scenario:** pay for the cheapest plan (citizen `basic` monthly, ₹99), then call `POST /v1/subscriptions/verify` with the same valid payment credentials but `plan: 'pro'` (or `persona: 'lawyer', plan: 'firm'`, ₹14,999/mo) — account is upgraded to the expensive plan for the price of the cheapest one.

4. **`server/src/middleware/adminSession.middleware.js:40` — admin login is effectively broken.**
   `requireAdminSession` computes `jwtAge` from `req.user.iat`, but `req.user` is built by `verifyToken` (`auth.middleware.js:41-45`) as `{ userId, persona, plan }` — `iat` is never copied over, even though the JWT itself does carry `iat` (`utils/token.js:18-20`).
   **Failure scenario:** `req.user.iat` is always `undefined` → computed `jwtAge` is ~1.7 billion seconds → always exceeds the 300s bootstrap grace period → every admin, immediately after fresh login, gets `401 ADMIN_SESSION_EXPIRED` on their first admin-route request. The only workaround is calling `/v1/admin/reauth` directly (which bypasses the broken bootstrap). Normal admin login → admin panel flow does not work.

5. **`server/src/controllers/notary.controller.js:576-620` (`stampDocument`) — non-atomic check-then-act race (double-credit).**
   Uses `findOne({status:'kyc_completed'})` with no update guard, then — after PDF generation/upload — a plain `findByIdAndUpdate` to `status:'stamped'` and a separate `$inc` of `totalEarnings`/`pendingEarnings`. Every other status-changing endpoint in this file uses atomic `findOneAndUpdate` with a current-status filter; this one doesn't.
   **Failure scenario:** notary double-clicks "Stamp" (or a slow request gets retried) while both requests still see `status:'kyc_completed'` — both generate/upload a notarized PDF and both execute the earnings `$inc`, double-crediting the notary and double-notifying the citizen.

6. **`server/src/services/notarizationSla.js:134` — SLA sweep runs 60x less often than intended.**
   `const INTERVAL = 60 * HOUR` should be `HOUR` (compare `consultationSla.js:96`, which correctly uses `HOUR`). The log message and doc comment both claim "every hour."
   **Failure scenario:** the 48-hour auto-cancel for unanswered notarization requests and the 24–25-hour KYC/stamping reminders are only checked once every 60 hours — reminder windows can be skipped entirely, and citizens wait days longer than intended for auto-cancellation/refund.

7. **`server/src/services/ai/aiNyayaBotService.js:60-61,86,92,306` — wrong require paths, feature silently broken.**
   `require('../models/JurisdictionRule')` etc. are wrong (file lives in `services/ai/`, so this resolves to a nonexistent `services/models/` dir; correct path is `../../models/JurisdictionRule.model`). Wrapped in try/catch, so it fails silently.
   **Failure scenario:** NyayaBot's jurisdiction-awareness, linked-document/case context injection, and template-suggestion features are permanently broken — every call throws `MODULE_NOT_FOUND`, gets swallowed, and silently falls back to generic/empty context (only a `logger.warn` to show for it).

### Frontend

8. **`client/src/components/consultation/ConsultationChat.jsx:129-131` (vs `App.jsx:694-698`) — cross-consultation chat message misattribution.**
   Both files bind a listener to socket event `consultation:message`. `App.jsx`'s global handler correctly keys the Redux write off `msg.consultation`. `ConsultationChat.jsx`'s local handler ignores that field and always writes into the bucket for whatever `consultationId` **prop** the currently-open drawer has.
   **Failure scenario:** user closes the chat drawer for consultation A and opens the drawer for consultation B; a message for A still in flight gets pushed into B's message array — another party's message text appears in the wrong chat thread.

9. **`client/src/components/ui/ErrorBoundary.jsx:65,72,110` — unguarded `process.env.NODE_ENV` crashes the error boundary itself.**
   No `process` polyfill exists anywhere in the Vite-bundled client (confirmed: no `define` in `client/vite.config.js`, no shim in `main.jsx`). Same pattern in `client/src/hooks/useErrorHandling.jsx:154` and `client/src/store/slices/errorSlice.js:145`.
   **Failure scenario:** any real runtime error caught by `componentDidCatch` throws `ReferenceError: process is not defined` while handling the original error, and the fallback UI itself throws the same error on render — instead of a graceful fallback card, the user gets a blank white screen exactly when the app is already broken.

10. **`client/src/store/slices/chatSlice.js` vs `chatBotSlice.js` — colliding Redux action-type strings (currently-dormant landmine).**
    Both files use the literal prefix `'chat/...'` for overlapping thunks. Only `chatSlice.js` is registered in `store.js`. `client/src/hooks/useChat.js` imports `createChatSession`, `getChatSession`, `sendVoiceMessage`, `getQuotaStatus`, `addUserMessage` from `chatSlice.js` — none of these exist there (they only exist in `chatBotSlice.js`), so the imports resolve to `undefined`.
    **Failure scenario:** currently dead (neither `useChat.js` nor `chatBotSlice.js` is imported anywhere live), so no active breakage today — but wiring either back in reproduces a hard `TypeError: createChatSession is not a function` crash, and because the action-type strings collide, dispatching either file's thunk would trigger the *other* file's `extraReducers` too (silent state cross-talk). Flagged as Critical because it's a trap for the next person who touches chat.

---

## High

### Backend

11. **`server/src/controllers/document.controller.js:737` (`lawyerEditDocument`) and `:806` (`getDocumentForLawyer`) — wrong ID used, feature always fails.**
    Both query `Consultation.findOne({ ..., lawyer: lawyerProf._id })`, but `Consultation.lawyer` is a ref to **User**, not `LawyerProfile` (every other call site in the same file correctly uses `lawyer: userId`).
    **Failure scenario:** a lawyer legitimately assigned to a consultation calls `PATCH /v1/documents/:id/lawyer-edit` or `GET /v1/consultations/:id/document` — the query never matches, so the request always 403s/404s. The lawyer document-review/edit workflow does not work at all.

12. **`server/src/controllers/rti.controller.js:206-267` (`updateStatus`) — deadline automation silently disabled for a valid state path.**
    `VALID_TRANSITIONS` permits `drafted → filed` via `PATCH /v1/rti/:id/status`, but this handler never sets `filedDate` (only `markAsFiled` does). The model's pre-save hook only computes `responseDeadline`/`firstAppealDeadline` when `filedDate` is modified.
    **Failure scenario:** a client calls the generic status-update endpoint instead of the dedicated file endpoint; the RTI becomes `status:"filed"` with `responseDeadline: null`, permanently excluding it from the deadline-alert queries — the documented Bull.js deadline-reminder automation never fires for that application.

13. **`server/src/controllers/notary.controller.js:305-329` (`verifyNotarizationPayment`) — write not guarded by payment status (double-credit race).**
    Initial fetch filters on `'payment.status':'pending'`, but the actual mutation applies unconditionally with no equivalent guard on the write.
    **Failure scenario:** two concurrent/replayed calls with the same valid payment credentials both pass the read before either writes, both `$inc` `pendingEarnings` — double-crediting the notary and firing duplicate notifications for one real payment.

14. **`server/src/routes/chat.routes.js` / `server/src/controllers/chat.controller.js` — per-message AI quota unenforced.**
    `checkFreeQuota` is imported but never attached to any route. `sendMessage` (the actual AI-cost-incurring hot path) has zero quota check — only the generic 10/min rate limiter applies.
    **Failure scenario:** a free-tier user creates one session (consuming 1 of 5 free sessions) then sends unlimited messages in that session at up to 10/min indefinitely, fully bypassing the documented free-tier AI-chat cap.

15. **`server/src/routes/nyayabotRoutes.js:64,179-192` — public share-link feature is completely broken.**
    `router.use(verifyToken)` applies to the whole router; the `/shared/:shareToken` route is declared afterward with a comment claiming to skip auth, but the inserted no-op middleware cannot undo middleware that already ran earlier in the stack.
    **Failure scenario:** any unauthenticated viewer (the entire point of a share link) hitting `GET /v1/nyayabot/shared/:shareToken` gets `401` instead of the shared transcript — the feature never works for non-logged-in viewers.

16. **`server/src/routes/auth.routes.js:352-361` (`/login-password`) — no dedicated rate limiter or lockout.**
    Unlike `/send-otp`, `/verify-otp`, `/refresh`, this route has no route-specific limiter — only the generic 100 req/15min global limiter, keyed by IP, shared across all `/v1` traffic.
    **Failure scenario:** up to 100 password guesses per IP per 15 minutes against any account, no per-account lockout, trivial to bypass via IP rotation.

17. **`server/src/controllers/payment.controller.js:299,387` — client-supplied `persona` overrides JWT persona.**
    `const effectivePersona = persona || userPersona;` lets the request body override `req.user.persona` for plan purchase/activation.
    **Failure scenario:** a citizen-persona account can pass `persona: 'lawyer'` in the request body, buy a lawyer-tier plan, and have it activated on their citizen record with no re-verification of actual persona.

18. **`server/src/controllers/admin.controller.js` — `rejectLawyer` (441-520) vs `rejectNotary` (655-725): inconsistent session revocation.**
    `rejectLawyer` clears refresh tokens and sets a Redis suspension blocklist key; `rejectNotary` does neither.
    **Failure scenario:** an admin rejects a notary's profile — the notary's existing access/refresh tokens remain valid, so a rejected/unverified notary can keep using notary-persona endpoints until natural token expiry (up to 1 hour), unlike a rejected lawyer whose session dies immediately.

19. **`server/src/services/ai/rtiAIService.js:86-88` and `services/ai/documentEngine.js:236-245` — no structural separation between instructions and user input.**
    Unlike `aiTriageService.js` (which isolates the system prompt via a dedicated parameter), these concatenate instructions and user-controlled free text into a single user-role message.
    **Failure scenario:** a citizen's free-text RTI description or document field containing prompt-injection text ("ignore the above instructions and instead …") has no structural barrier preventing it from being treated as an instruction, risking manipulated legal documents/RTI applications.

20. **`server/src/worker/jobs/generateDocument.job.js:186-193` — failure diagnostics silently dropped.**
    On generation failure, code writes to `metadata.generationError`/`metadata.failedAt`, but `Document.model.js` has no `metadata` field in its schema.
    **Failure scenario:** under Mongoose strict mode these fields are silently dropped — the actual error reason for a failed document generation is never persisted anywhere, making failures undiagnosable from the DB.

### Frontend

21. **`client/src/pages/auth/Login.jsx:422-491` — email-verification bypass on registration.**
    When arriving at the register wizard via OTP-login (`sessionOtpVerified.current = true`), Step 0's "Continue" skips re-verification based purely on that boolean — it never checks whether the (fully editable) email field still matches the OTP-verified email.
    **Failure scenario:** user verifies OTP for `real@x.com`, edits the email field to `other@y.com`, clicks Continue — registration completes and stores `other@y.com` as a "verified" account email with no OTP ever sent/checked for it.

22. **`client/src/pages/citizen/NewRTI.jsx:636-641` — stale AI draft silently reused after editing description.**
    The wizard's "Next →" only regenerates the AI draft `if (!aiDraft)`; once a draft exists, going back and editing the description and clicking Next just advances the step without regenerating.
    **Failure scenario:** user generates a draft, goes back, edits the description, clicks Next — the app silently reuses the old AI-generated questions/ministry for the edited text with no indication the edit was ignored.

23. **`client/src/pages/notary/NotarizationRequests.jsx:227-231` — missing double-submit guard on Reject.**
    "Accept" is disabled while in flight; "Reject" has no such guard.
    **Failure scenario:** notary clicks Accept then immediately clicks Reject before the first request resolves — both actions can race for the same request ID.

24. **`client/src/services/socket.js:11-13` — reads the wrong environment variable.**
    Reads `VITE_API_BASE_URL`; every other file in the codebase reads `VITE_API_URL`. `VITE_API_BASE_URL` is never defined anywhere.
    **Failure scenario:** in any real deployment, the Socket.IO client always falls back to the hardcoded `http://localhost:5000` default — real-time consultation chat/notifications silently fail outside local dev.

25. **`client/src/store/slices/authSlice.js:141-154` (`deactivateAccount`) — incomplete localStorage cleanup.**
    Unlike `logout` (which clears documents/chat persisted slices too), `deactivateAccount` only clears token/refresh-token/auth keys.
    **Failure scenario:** on a shared device, a user deactivates their account; their persisted documents and chat history remain in localStorage and can rehydrate for the next person who logs in before those keys are overwritten.

---

## Medium

### Backend

26. **`server/src/controllers/document.controller.js:76-158` and `case.controller.js` — non-atomic quota check-then-act (concurrency bypass).**
    `checkFreeQuota` only reads usage vs limit; the increment happens later in a separate step (Bull job for documents, separate `$inc` for cases). Contrast `triage.controller.js`, which correctly does an atomic claim-then-work.
    **Failure scenario:** two concurrent requests (double-click, retry-on-timeout) both pass the quota check before either increments, letting a free-tier user exceed their document/case limits.

27. **`server/src/controllers/document.controller.js:76-158` — TOCTOU on `ChatSession.status` allows duplicate document generation.**
    The resumable-status check allows status `GENERATING` to pass again.
    **Failure scenario:** two concurrent `POST /v1/documents/generate` calls for the same session both pass validation before either writes `GENERATING`, producing two Document stubs/Bull jobs.

28. **`server/src/routes/document.routes.js:75` / `document.controller.js:237-238` — unvalidated query params reach a Mongo filter.**
    `GET /` has no express-validator, unlike every other route in the file; `req.query.sessionId`/`status` are assigned directly into the filter.
    **Failure scenario:** `GET /v1/documents?sessionId[$ne]=null` becomes a Mongo operator object via Express's default query parser. Blast radius limited (filter is still scoped by `user: userId`), but it lets a caller override intended equality filtering with arbitrary operators.

29. **`server/src/controllers/lawyer.controller.js:162-169` — public lawyer profile "recent ratings" always empty.**
    Queries `Consultation.find({ lawyer: profile._id, 'rating.score': ... })`, but the schema has no `rating` field (only `citizenRating`/`lawyerRating`), and again uses the LawyerProfile id instead of the User id the schema references.
    **Failure scenario:** `GET /v1/lawyers/:id` never returns `recentRatings` regardless of how many ratings the lawyer has.

30. **`server/src/routes/case.routes.js:119-130` — "Pro plan required" for case-sharing is documented but unenforced.**
    No `checkFeatureAccess`/plan-check middleware attached to `POST /v1/cases/:id/share-lawyer`.
    **Failure scenario:** any free-plan citizen can share a case with a lawyer, bypassing the intended plan gate.

31. **`server/src/controllers/document.controller.js:498-511` (`linkCase`) — no ownership check on `caseId`.**
    `caseId` is validated only as a Mongo ID; there's no check that the referenced `CaseTracker` belongs to the requesting user.
    **Failure scenario:** a user can link their own document to another user's CaseTracker, creating a dangling/unauthorized cross-user reference.

32. **`server/src/controllers/consultationChat.controller.js:24-42` (`assertParty`) — chat never closes for rejected/cancelled consultations.**
    The 48-hour retention cutoff only applies when `status === 'completed'`.
    **Failure scenario:** after a lawyer rejects (or citizen cancels) a consultation, both parties retain indefinite chat access, contradicting the evident time-boxed-engagement intent.

33. **`server/src/controllers/nyayabotController.js:179-213` and `chat.controller.js:68-90,133-135` — TOCTOU quota race on session/message creation.**
    Quota is read, then incremented in a separate, non-atomic step.
    **Failure scenario:** concurrent requests near the quota boundary can let a free-tier user create more sessions/messages than their limit allows.

34. **`server/src/controllers/notary.controller.js:436-489` (`acceptRequest`) — atomic status claim commits before payment-order creation; failure leaves the request stuck.**
    If `razorpayService.createOrder(...)` throws after the atomic `pending → accepted` transition, status is never reverted.
    **Failure scenario:** a transient Razorpay failure during accept leaves the request permanently stuck at `accepted` with no order — citizen can never pay, notary can't retry accept, and no other route recovers it.

35. **`server/src/routes/notary.routes.js:104-190` — inconsistent persona-guard pattern blocks admin oversight.**
    Uses `requirePersona(PERSONAS.CITIZEN/NOTARY)` directly instead of the codebase's `requireCitizen`/`requireLawyer`-style shorthand that explicitly includes admin.
    **Failure scenario:** admins cannot create/cancel/rate/accept/stamp notarization requests at all — blocks admin support workflows for stuck requests (see #34).

36. **`server/src/controllers/auth.controller.js:746-747` (`whatsappEntry`) — validated field and used field diverge.**
    `rawPhone = req.query.phone || req.body.phone` prefers the query string, but route validators only check `req.body`.
    **Failure scenario:** a request can pass validation using a legitimate `body.phone` while the controller actually performs the login/creation lookup against a different, unvalidated `query.phone`.

37. **`server/src/controllers/payment.controller.js:645-691` (`webhookHandler`) — handler errors swallowed, always ack'd 200.**
    If `handlePaymentCaptured`/`handleSubscriptionCharged` throw, the error is logged but Razorpay still gets `200 OK` and will not retry.
    **Failure scenario:** a transient DB error during webhook processing permanently fails to update Payment/Subscription state, with no automated recovery.

38. **`server/src/models/User.model.js:365-394` — cascade-delete hook misses several models with required User refs.**
    Deletes LawyerProfile/NotaryProfile/Document/RTIApplication/etc. on user delete, but not `Consultation`, `ConsultationMessage`, `NotarizationRequest`, `LawyerWithdrawal`, `NotaryWithdrawal`, `AuditLog`. Also only fires on `findOneAndDelete`, not `deleteOne`/`remove`.
    **Failure scenario:** deleting a user leaves orphaned Consultation/NotarizationRequest records with dangling refs; `.populate('citizen'/'lawyer')` on them silently returns `null` downstream.

39. **`server/src/services/notification/documentQueueClient.js:27` vs `server/src/worker/worker.js:37-52` — inconsistent Redis TLS options between enqueue and consume paths.**
    The queue client passes a raw connection URL; the worker builds explicit relaxed-TLS options for managed Redis providers before constructing the same queue.
    **Failure scenario:** on a managed Redis provider requiring relaxed cert checking, the API-side enqueue path can fail to connect even though the worker's consumer queue connects fine.

40. **`server/src/worker/jobs/sendRTIAlert.job.js:112-127` — deadline alerts marked "sent" even when delivery fails, with no fallback channel.**
    Email failure is logged as non-fatal, but the alert flag is set regardless; no SMS/WhatsApp fallback despite the user record having that data available.
    **Failure scenario:** if email delivery fails or the user has no email on file, the day-25/30/overdue RTI deadline reminder is permanently marked sent and never retried through any channel.

41. **`server/src/controllers/rti.controller.js:222-262` — status transitions to appeal stages don't require the corresponding date field.**
    **Failure scenario:** status can say "first appeal filed" while `firstAppealFiledDate` stays null — status and companion data drift out of sync.

42. **`server/src/middleware/chatMiddleware.js` — entire file is dead code with broken require paths.**
    None of its exports (`checkChatQuota`, `checkVoiceInputAccess`, etc.) are imported anywhere; it also requires nonexistent module paths (`../models/User` instead of `../models/User.model`, wrong relative depth to `logger`).
    **Failure scenario:** not currently exploitable (unreferenced), but signals the chat quota/rate-limit enforcement its docstring describes doesn't actually run anywhere — and would crash at require-time if a future dev wires it in expecting it to work. (See also Critical #14 — the quota gap this file's absence points to is real.)

43. **`server/src/config/redis.js:20` — TLS certificate validation disabled for non-local Redis.**
    `rejectUnauthorized: false` for managed Redis providers in production.
    **Failure scenario:** a network-level attacker able to intercept traffic to the Redis host could MITM the connection undetected, exposing session/suspension/subscription cache data in transit.

### Frontend

44. **`client/src/pages/citizen/DocumentPreview.jsx` and others — no double-submit guard on payment-triggering buttons.**
    `handleDownload` and `handlePayNotarization` have no per-action disabled/loading state.
    **Failure scenario:** double-clicking "Pay ₹199 to Confirm" or "Download PDF" before the first click resolves can open two Razorpay checkout modals / create two orders for the same document.

45. **`client/src/pages/citizen/ChatFlow.jsx:319-364` — document-generation poll gives up silently after 5 minutes.**
    After `MAX_POLLS = 60` (5 min at 5s intervals), the interval is cleared with no user-facing error or retry option (contrast `DocumentPreview.jsx`'s equivalent poll, which does surface a timeout snackbar).
    **Failure scenario:** if generation takes longer than 5 minutes or keeps failing, the "Generating your document…" overlay stays on screen forever with no way out except reloading.

46. **`client/src/pages/public/LandingPage.jsx:1022-1041` — silent failure in the public triage demo.**
    On any error other than HTTP 403 (quota exceeded), the catch block just resets phase with no error message shown.
    **Failure scenario:** a network blip or 500 during the marketing-page triage demo makes the form silently revert to input state — looks like the button did nothing.

47. **₹199 notarization fee hardcoded as literal UI text in ~6 files with no single source of truth** (`DocumentPreview.jsx`, `NotarizationRequests.jsx`, `NotaryDashboard.jsx`, `LandingPage.jsx`, `NotarySearch.jsx`, `NotarizationBooking.jsx`).
    The actually-charged amount does come from the server (no double-charge risk), but every one of these display strings must be updated by hand if the fee ever changes.
    **Failure scenario:** a partial update leaves some UI showing a stale price while the real charge differs, confusing users before they pay.

48. **`client/src/store/slices/notarySlice.js:137-147,266-268` — `getDocumentNotarizationStatus` has no pending/rejected handling.**
    Only `.fulfilled` is registered in `extraReducers`.
    **Failure scenario:** a failed request (network error, 404) is silently swallowed — nothing surfaces the error, and any loading UI bound to this call has no state to render against.

49. **`client/src/components/notary/NotarizationBooking.jsx:65-72` — stale booking error not cleared on drawer close.**
    `handleClose` clears the pending request but never the error state.
    **Failure scenario:** a failed booking attempt leaves an error visible; user closes the drawer, reopens it for a different document, and sees the old error immediately, before any new submission.

50. **`client/src/store/slices/notificationSlice.js:74-79` — unread-count double-decrement race.**
    `markNotificationRead.fulfilled` decrements `unreadTotal` whenever the server doesn't echo it back, regardless of whether the item was already read.
    **Failure scenario:** a double-click / race on "mark as read" for an already-read notification decrements the badge count twice, under-counting unread notifications.

51. **`client/src/i18n/i18n.js:34-45,94-131` — all 12 languages statically bundled despite an HttpBackend lazy-load config.**
    Since i18next resolves pre-populated `resources` before calling any backend, the configured HTTP backend/PWA cache path for per-language JSON is effectively dead.
    **Failure scenario:** no functional bug, but every user downloads all 12 languages' translation strings on first load — inflating bundle size for low-bandwidth users, the opposite of the lazy-loading the setup implies.

52. **`client/src/components/rti/RTITimeline.jsx:72-96` — withdrawn status not handled in stage logic.**
    The `response`/`first_appeal`/`cic` stage branches don't check for `currentStatus === 'withdrawn'`, so they fall through to "pending."
    **Failure scenario:** an RTI withdrawn after the first appeal was filed still shows later timeline stages as not-yet-started, misrepresenting how far the case progressed before withdrawal.

53. **Auth tokens duplicated across two separate localStorage mechanisms** (`client/src/store/store.js` redux-persist whitelist + raw `nyayasetu_token`/`nyayasetu_refresh_token` keys written directly in `authSlice.js`).
    Both copies stay in sync, so not a functional bug, but doubles the XSS attack surface for credential theft with no indication either copy is authoritative.

---

## Low

54. **`server/src/services/ai/aiChatService.js`** — dead code (see Dead Code section) with broken require paths; would crash at import time if ever wired in.
55. **`server/src/services/signature/selfSigner.js:26`** — falls back to a hardcoded default secret (`'nyayasetu-dev-secret'`) when `JWT_SECRET` is unset; low risk (dev-signing only) but forgeable if misconfigured in a real deployment.
56. **`server/src/worker/worker.js:100-102`** — `sendMonthlyReminder` job is a permanent no-op stub; non-auto-renewing subscriptions never actually receive an expiry reminder despite model/cron scaffolding suggesting they do.
57. **`server/src/routes/jurisdiction.routes.js:110,155`** — unsanitized query params reach a Mongo filter on the public Legal Acts list; low impact since this data is public and non-user-scoped.
58. **`server/src/routes/jurisdiction.routes.js:105-109`** — stale documentation claims routes are at `/v1/acts`; actual mount point is `/v1/jurisdiction/acts` (app.js:193). A client built against the documented path would 404.
59. **`server/src/routes/payment.routes.js:50-62`** — no express-validator type checks on `create-order`/`verify`, unlike `subscription.routes.js`; limited impact (results stay scoped by `user: userId` and the HMAC signature gate).
60. **`server/src/middleware/verifyTwilioSignature.middleware.js:12-16`** — full signature bypass when `NODE_ENV === 'development'`; intentional for local testing, but a production deployment with a misconfigured `NODE_ENV` would silently accept forged WhatsApp webhook requests.
61. **`server/src/server.js:132-138`** — `unhandledRejection` only triggers graceful shutdown when `NODE_ENV === 'production'`; a misconfigured deployment would silently mask an unhandled rejection instead of restarting.
62. **`client/src/pages/citizen/MyDocuments.jsx:130-144`** — IntersectionObserver is recreated on every page/loading-state change with a stale closure over `loading`; theoretical race could double-append a page of documents on rapid scroll.
63. **`client/src/hooks/useChat.js:178-236` (`useVoiceRecording`)** — uses `React.useRef` without importing `React`; currently dead code, but would throw `ReferenceError: React is not defined` if ever invoked.
64. **`client/src/store/slices/authSlice.js:132-135` (`logout`)** — clears the `nyayasetu_ui` (theme/language) key on every logout, unlike `deactivateAccount`; minor UX regression — theme/language resets on every re-login.
65. **`client/src/components/layout/Sidebar.jsx`** — header comment describes a "self-managed, localStorage-persisted collapse state" that doesn't exist in the implementation (`collapsed` is hardcoded `false`, no toggle, no storage read/write).

---

## Dead Code / Unused Files

Verified via repo-wide grep for imports/references; each is a strong candidate for removal (double-check for dynamic/string-based imports before deleting — none were found).

| File | Why it's dead |
|---|---|
| `client/src/pages/NyayaBotPage.jsx` | Never routed — no `/nyayabot*` path exists in `App.jsx`; only `NyayaBotWidget` (a different component) is used. |
| `client/src/components/chat/ChatWindow.jsx` | Zero references outside itself; superseded — the live chat page (`ChatFlow.jsx`) imports `MessageBubble`/`VoiceInput` directly instead. |
| `client/src/components/ui/SectionHeader.jsx` | Zero references outside itself; added as a shared primitive but never adopted by any page. |
| `client/src/store/slices/chatBotSlice.js` | Not registered in `store.js`; superseded by `chatSlice.js`/`nyayabotSlice.js`. **Caution:** don't just delete without also cleaning up `useChat.js`, which imports from the wrong slice expecting this one's exports (see Critical #10). |
| `server/src/services/ai/aiChatService.js` | Zero references in `server/src`; `chat.controller.js` uses `services/ai/questionEngine.js` instead. Its own internal requires are broken (proof it hasn't been exercised in a long time). |
| `server/src/middleware/chatMiddleware.js` | Zero references anywhere; broken require paths would crash it if ever wired in (see Medium #42). |

**Needs a manual check before removing:**
- `server/scripts/drop-sharetoken-index.js` — not wired into any `npm run` script (unlike its sibling scripts), likely a one-off manual migration meant to be run directly once. Confirm with git history before deleting.

**Confirmed NOT dead (checked, kept for reference):** all 19 files under `server/src/routes/` are mounted in `app.js`; all Redux slices except `chatBotSlice.js` are registered and consumed; `server/tests/*.test.js` all test source files that still exist; all `client/public/icons/*.json` Lottie assets are referenced by name in `BottomNav.jsx`/`Sidebar.jsx`/`CitizenHome.jsx`.

---

## Repo Hygiene

- **No secrets or build artifacts committed:** no `.env` files tracked, no `node_modules/` tracked, no `dist/`/`build/` output committed. `.gitignore` correctly excludes all of these.
- **`worker/` at repo root is an intentional stub, not dead code or duplication.** `worker/src/worker.js` deliberately throws an error directing developers to `server/src/worker/worker.js` (the canonical, actually-used worker). This is a documented redirect, not a bug — no action needed.
- **Single root lockfile (`package-lock.json`)** is correct for the npm-workspaces setup (`client`/`server` don't carry their own lockfiles).
- Overall the repo is comparatively tidy — the dead-file list above is short, and each entry has clean, unambiguous zero-reference evidence.

---

## Suggested priority order

1. **Fix the Claude model ID** (#1) — this is a full outage of every AI feature right now given today's date.
2. **Fix the two payment-verification exploits** (#2, #3) — real revenue-loss risk, exploitable by any authenticated user today.
3. **Fix the admin-session bootstrap bug** (#4) — admin panel is unusable via normal login.
4. **Fix the notarization double-credit races** (#5, #13) and **notarizationSla interval typo** (#6) — financial/SLA correctness.
5. **Fix the lawyer document-access wrong-ID bug** (#11) and **RTI filedDate gap** (#12) — both silently break shipped features.
6. Everything else in Critical/High, then work down through Medium as time allows.
7. Remove the confirmed dead files once a second pair of eyes confirms no dynamic imports reference them.

# NyayaSetu — Admin Persona Access Audit

**Date:** 2026-06-30  
**Branch:** main  
**Auditor:** Claude Code (automated + manual review)

---

## Table of Contents

1. [Admin Authentication & Guards](#1-admin-authentication--guards)
2. [Admin Routes (Backend)](#2-admin-routes-backend)
3. [Admin Pages (Frontend)](#3-admin-pages-frontend)
4. [Sidebar Navigation](#4-sidebar-navigation)
5. [Feature-by-Feature Access Matrix](#5-feature-by-feature-access-matrix)
6. [Data Models with Admin Relevance](#6-data-models-with-admin-relevance)
7. [Bug Fixed During Audit](#7-bug-fixed-during-audit)
8. [Known Gaps (Features Not Yet Built)](#8-known-gaps-features-not-yet-built)
9. [Security Observations](#9-security-observations)
10. [Admin Account Provisioning](#10-admin-account-provisioning)

---

## 1. Admin Authentication & Guards

### Middleware Stack (`server/src/middleware/auth.middleware.js`)

| Middleware | Purpose |
|---|---|
| `verifyToken` | Validates JWT Bearer token; attaches `{ userId, persona, plan }` to `req.user`. Returns 401 if missing, expired, or invalid. |
| `requirePersona('admin')` | Factory that checks `req.user.persona === 'admin'` (case-insensitive). Returns 403 `WRONG_PERSONA` if mismatch. |
| `requireAdmin` | Convenience shorthand for `requirePersona('admin')`. Used on template routes. |
| `optionalAuth` | Sets `req.user = null` silently if token absent — used on public routes. |

### Additional Protections

- **Redis suspension blocklist** — if `user:suspended:{userId}` key exists, `verifyToken` rejects with 401 `ACCOUNT_SUSPENDED`.
- **Self-protection** — admin accounts cannot be toggled inactive by other admins (explicit guard in `toggleUserActive` controller).
- **JWT expiry** — 1-hour access token; refresh tokens cleared on deactivation.

### Frontend Guard (`client/src/components/ui/ProtectedRoute.jsx`)

All `/admin/*` routes are wrapped in:

```jsx
<ProtectedRoute allowedPersonas={["admin"]}>
  <AppLayout />
</ProtectedRoute>
```

- Unauthenticated users → redirected to `/login?returnUrl=...`
- Wrong persona → redirected to their own home (`/${persona}/home`)
- Admin with valid token → allowed through

---

## 2. Admin Routes (Backend)

All routes below require `verifyToken` + `requirePersona('admin')` unless noted.  
Base path: `/v1/admin`

### Platform Statistics

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/admin/stats` | Platform-wide summary: total users, documents, active lawyers, signups, payments, subscriptions |
| GET | `/v1/admin/analytics` | 30-day time-series: signups per day, revenue per day, documents per day |

### User Management

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/admin/users` | List all users — filterable by `persona`, `plan`, free-text `search` |
| GET | `/v1/admin/users/:id` | Full user profile: documents, cases, lawyer/notary profile, subscription history |
| PATCH | `/v1/admin/users/:id/toggle-active` | Enable or disable a user account (clears refresh tokens on deactivation) |
| POST | `/v1/admin/users/:id/revoke-subscription` | Force-expire a paid subscription, dropping user to free tier |

### Lawyer Verification

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/admin/lawyers` | List lawyers — filterable by `verificationStatus`, free-text `search` |
| POST | `/v1/admin/lawyers/:id/verify` | Approve lawyer; sets `isVerified=true`, records `verifiedBy`, sends WhatsApp + email notification |
| POST | `/v1/admin/lawyers/:id/reject` | Reject lawyer; records `rejectedBy` + `rejectionReason`, clears sessions, notifies user |

### Notary Verification

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/admin/notaries` | List notaries — filterable by `verificationStatus`, free-text `search` |
| POST | `/v1/admin/notaries/:id/verify` | Approve notary; sets `isVerified=true`, records `verifiedBy`, sends notifications |
| POST | `/v1/admin/notaries/:id/reject` | Reject notary; records `rejectedBy` + `rejectionReason`, notifies user |

### Document Templates

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/admin/templates` | List all document templates |
| POST | `/v1/admin/templates` | Create new template |
| PUT | `/v1/admin/templates/:id` | Update existing template |
| DELETE | `/v1/templates/:id` | Soft-delete template (`requireAdmin` on shared template router) |

### Audit & Logging

| Method | Endpoint | Description |
|---|---|---|
| GET | `/v1/admin/audit-logs` | View audit logs — filterable by `action`, `entity`, `user`, `success` status |

---

## 3. Admin Pages (Frontend)

All pages are lazy-loaded and live under `client/src/pages/admin/`.

| Route | Component | Backed by API |
|---|---|---|
| `/admin/dashboard` | `AdminDashboard.jsx` | `/v1/admin/stats`, `/v1/admin/analytics` |
| `/admin/users` | `AdminUsers.jsx` | `/v1/admin/users` |
| `/admin/lawyers` | `AdminLawyers.jsx` | `/v1/admin/lawyers` |
| `/admin/notaries` | `AdminNotaries.jsx` | `/v1/admin/notaries` |
| `/admin/templates` | `AdminTemplates.jsx` | `/v1/admin/templates`, `/v1/templates` |
| `/admin/audit-logs` | `AdminAuditLog.jsx` | `/v1/admin/audit-logs` |
| `/admin/settings` | `Settings.jsx` (shared) | `/v1/auth/me`, `/v1/users/profile` |

Root `/admin` redirects to `/admin/dashboard`.

---

## 4. Sidebar Navigation

### After Fix (current state)

```
Administration
├── Dashboard        → /admin/dashboard
├── Users            → /admin/users
├── Templates        → /admin/templates
├── Lawyers          → /admin/lawyers
├── Notaries         → /admin/notaries   ← added during audit
└── Audit Log        → /admin/audit-logs
```

> **Note:** Settings is accessible via the Navbar profile menu → `/admin/settings`, not the sidebar.

---

## 5. Feature-by-Feature Access Matrix

| Feature | Admin Access Level | Details | Gaps |
|---|---|---|---|
| **Dashboard & Analytics** | Full | Stats cards, 30-day revenue + signup + document charts | No real-time data (polling only) |
| **User Management** | Full | List, search, filter by persona/plan, view full profile, toggle active, revoke subscription | Cannot edit user name/email/phone directly |
| **Lawyer Verification** | Full | List pending/approved/rejected, approve with notification, reject with reason + audit trail | Cannot revert approved → pending for re-review |
| **Notary Verification** | Full | Same as lawyer verification workflow | Cannot revert approved → pending for re-review |
| **Document Templates** | Full | Create, edit, soft-delete templates; control pricing, plan requirements, state availability | Cannot preview how template renders to citizen |
| **Audit Logs** | Full (read-only) | View all platform audit events, filter by action/entity/user/success; logs are immutable | Logs expire after 1 year |
| **Document Generation** | Partial | Can view metadata of user documents via user detail page | Cannot bulk-list all documents; cannot download or delete PDFs directly |
| **RTI Tracker** | Partial | Can see a user's RTI applications via user detail page | No `/admin/rti` page; cannot manage deadlines, statuses, or see all RTIs platform-wide |
| **Helpline / Triage** | Partial | Can see per-user triage quota usage via user detail page | No aggregate triage analytics, no SLA tracking, no request quality view |
| **Consultation Booking** | None | No admin endpoints | Cannot view all consultations, cancel bookings, or process refunds |
| **Chat Sessions** | None | No admin endpoints | Cannot audit conversation quality or message history |
| **Payments** | Partial | Sees aggregated revenue in analytics; can revoke subscriptions | Cannot view individual transaction details, Razorpay metadata, or process refunds |
| **Notifications** | None | No admin panel for notifications | Cannot send broadcast notifications to users |
| **Triage Quotas** | Partial | Can see quota usage per user; revoking subscription resets to free tier | Cannot manually reset or adjust quotas per user |

---

## 6. Data Models with Admin Relevance

### `User` model

| Field | Admin Action |
|---|---|
| `persona` | Read (filter users by persona) |
| `isActive` | Write via `toggle-active` |
| `subscription` | Write via `revoke-subscription` |
| `refreshTokens` | Cleared on deactivation |
| `freeUsage` | Read (visible in user detail) |

Admin users always have `isSubscribed = true` (virtual property), `plan = 'pro'`, and free usage limits of `999999`.

### `LawyerProfile` model

| Field | Admin Action |
|---|---|
| `verificationStatus` | Write (pending → approved / rejected) |
| `isVerified` | Write |
| `verificationDocs` | Read (view uploaded certificates) |
| `verifiedAt`, `verifiedBy` | Written on approval |
| `rejectedAt`, `rejectedBy`, `rejectionReason` | Written on rejection |

### `NotaryProfile` model

Identical structure to `LawyerProfile` — same fields and admin actions.

### `DocumentTemplate` model

| Field | Admin Action |
|---|---|
| `name`, `slug`, `category` | Write |
| `questionFlow` | Write (defines the chat wizard questions) |
| `pricePayPerDoc` | Write |
| `requiredPlan` | Write (free / basic / pro) |
| `availableStates` | Write |
| `isFeatured`, `isActive` | Write |
| `isAlwaysFree` | Auto-set by pre-save hook for free slugs |

### `AuditLog` model

| Field | Notes |
|---|---|
| `user` | Ref to the user who performed the action |
| `action` | Verb-style string, e.g. `admin.user.deactivated` |
| `entity`, `entityId` | What was affected |
| `metadata` | Action-specific context (mixed type) |
| `success` | Boolean — filterable |

Audit logs are **write-once** (pre-save hook blocks updates). Admin can read but cannot modify or delete.

### `AuditLog` tracked actions (admin-initiated)

| Action string | Triggered by |
|---|---|
| `admin_created` / `admin_updated` | Running `createAdmin.js` script |
| `admin.user.deactivated` | Toggle active → false |
| `admin.user.activated` | Toggle active → true |
| `admin.subscription.revoked` | Revoke subscription |
| `admin.lawyer.verified` | Approve lawyer |
| `admin.lawyer.rejected` | Reject lawyer |
| `admin.notary.verified` | Approve notary |
| `admin.notary.rejected` | Reject notary |
| `admin.template.created` | Create template |
| `admin.template.updated` | Update template |
| `admin.template.deleted` | Soft-delete template |

---

## 7. Bug Fixed During Audit

### Notaries missing from admin sidebar

**File:** `client/src/components/layout/Sidebar.jsx`  
**Severity:** High — feature was unreachable from UI  
**Status:** Fixed

**Problem:** The `/admin/notaries` route and `AdminNotaries.jsx` page were fully implemented on both frontend and backend, but no sidebar link existed. Admins could only reach the Notaries page by typing the URL directly.

**Fix applied:**
1. Imported `VerifiedUserRounded` from `@mui/icons-material`.
2. Added `notaries: VerifiedUserRounded` to the `IC` icon map.
3. Added `{ icon: IC.notaries, label: 'Notaries', path: '/admin/notaries' }` to the `admin` nav array, between Lawyers and Audit Log.

---

## 8. Known Gaps (Features Not Yet Built)

These are missing admin capabilities that would require new backend routes + frontend pages.

### High Priority

| Gap | Impact | Suggested Endpoint |
|---|---|---|
| **No individual payment details** | Cannot investigate payment disputes, see Razorpay transaction IDs, or process refunds | `GET /v1/admin/payments`, `POST /v1/admin/payments/:id/refund` |
| **No consultation management** | Cannot view bookings, cancel on behalf of users, or resolve disputes | `GET /v1/admin/consultations`, `PATCH /v1/admin/consultations/:id/cancel` |
| **No document moderation** | Cannot remove abusive or illegal user documents without direct DB access | `GET /v1/admin/documents`, `DELETE /v1/admin/documents/:id` |

### Medium Priority

| Gap | Impact | Suggested Endpoint |
|---|---|---|
| **No RTI admin dashboard** | Cannot see platform-wide RTI filing status or intervene on missed deadlines | `GET /v1/admin/rti`, `PATCH /v1/admin/rti/:id/extend-deadline` |
| **No triage / helpline analytics** | No visibility into helpline performance, peak times, or resolution quality | Add triage metrics to `/v1/admin/analytics` |
| **No quota management** | Cannot manually reset or adjust per-user free tier quotas for support cases | `PATCH /v1/admin/users/:id/reset-quota` |
| **No bulk user actions** | Cannot deactivate multiple users at once (e.g. spam sweep) | `POST /v1/admin/users/bulk-action` |

### Low Priority

| Gap | Impact | Suggested Endpoint |
|---|---|---|
| **No verification reversal** | Cannot revert an approved lawyer/notary back to pending for re-review | `POST /v1/admin/lawyers/:id/reset-verification` |
| **No template preview** | Cannot see how a template renders as a citizen before publishing | `GET /v1/templates/:id/preview` |
| **No broadcast notifications** | Cannot send platform-wide announcements or alerts to users | `POST /v1/admin/notifications/broadcast` |
| **No template versioning** | Editing a template affects all future documents; no rollback | Version field on `DocumentTemplate` model |

---

## 9. Security Observations

### Positive Controls

| Control | Detail |
|---|---|
| JWT auth with persona validation | All admin routes double-check persona in token |
| Immutable audit logs | Pre-save hook prevents any modification after creation |
| Redis suspension blocklist | Deactivated users blocked at token validation, not just DB check |
| Refresh tokens cleared on deactivation | Immediately invalidates all active sessions |
| Admin self-protection | Admins cannot deactivate each other (prevents accidental lockout) |
| bcrypt 12 rounds | Password hashing with high work factor |
| Signed time-limited URLs | Document downloads use 15-minute signed URLs (S3/Cloudinary) |
| RBAC — strict persona separation | Each route group allows exactly one persona; no escalation path |

### Concerns

| Concern | Risk | Recommendation |
|---|---|---|
| Predictable admin email (`admin@nyayasetu.in`) | Targeted phishing or credential stuffing | Change email post-provisioning; don't hardcode in script |
| Dummy phone in seed script (`+919178287528`) | If phone-based 2FA added later, wrong number on record | Update `createAdmin.js` before production deploy |
| No 2FA enforcement for admin | Admin account compromise = full platform access | Enforce TOTP or OTP for admin login |
| No IP allowlist for admin routes | Admin panel accessible from any network | Add IP-based middleware or VPN requirement for `/v1/admin/*` |
| Admin sees all user data (no fine-grained roles) | Any admin breach exposes all user PII | Consider sub-roles: `admin:viewer`, `admin:verifier`, `admin:superadmin` |
| Audit log 1-year expiry (commented out) | Log gaps could hinder incident investigation | Define and enforce a retention policy |
| No admin session timeout beyond JWT | 1-hour window is long for privileged operations | Add short-lived admin session with re-auth prompt |

---

## 10. Admin Account Provisioning

**Script:** `server/scripts/createAdmin.js`  
**Usage:** `node scripts/createAdmin.js` (safe to re-run — upserts, does not duplicate)

### Default values set by script

| Field | Value |
|---|---|
| Email | `admin@nyayasetu.in` |
| Name | `NyayaSetu Admin` |
| Phone | `+919178287528` (placeholder — change before production) |
| Persona | `ADMIN` (normalized to `admin` in JWT) |
| Plan | `pro` |
| Subscription expiry | `2099-12-31` |
| Free usage limits | All counters set to `999999` |
| `isEmailVerified` | `true` |
| Password | Random 16-character string — printed once, not stored |

### JWT payload for admin sessions

```json
{
  "userId": "<ObjectId>",
  "persona": "admin",
  "plan": "pro"
}
```

### Pre-production checklist for admin account

- [ ] Change admin email from `admin@nyayasetu.in` to a real monitored inbox
- [ ] Update phone number in `createAdmin.js`
- [ ] Change generated password immediately after first login
- [ ] Enable 2FA once implemented
- [ ] Restrict `/v1/admin/*` to internal IP range or VPN

---

*Generated by Claude Code audit — 2026-06-30*

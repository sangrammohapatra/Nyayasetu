# NyayaSetu — Complete Technical Architecture
**Version 3.0 | As-Built (June 2026) — Actual Implementation State**

> This document reflects the **actual codebase** as it exists today, not the aspirational design.
> Gaps between planned and implemented are called out explicitly.

---

## TABLE OF CONTENTS
1. [Tech Stack & Free-Tier Strategy](#1-tech-stack--free-tier-strategy)
2. [System Overview](#2-system-overview)
3. [Actual Folder Structure](#3-actual-folder-structure)
4. [MongoDB Schemas (As Implemented)](#4-mongodb-schemas-as-implemented)
5. [API Routes (As Mounted)](#5-api-routes-as-mounted)
6. [AI Pipeline](#6-ai-pipeline)
7. [WhatsApp Integration](#7-whatsapp-integration)
8. [Personas, Plans & Feature Gates](#8-personas-plans--feature-gates)
9. [Theme & Language System](#9-theme--language-system)
10. [External API Integrations](#10-external-api-integrations)
11. [Payment Architecture](#11-payment-architecture)
12. [Socket.IO & Real-Time](#12-socketio--real-time)
13. [Background Worker](#13-background-worker)
14. [Authentication & Security](#14-authentication--security)
15. [Frontend Architecture](#15-frontend-architecture)
16. [Environment Variables](#16-environment-variables)
17. [Deployment](#17-deployment)
18. [Known Gaps & TODOs](#18-known-gaps--todos)

---

## 1. Tech Stack & Free-Tier Strategy

### Core Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend | React (Vite) | 18.x | PWA-ready |
| UI Library | MUI v6 | 6.x | Custom theme system |
| State | Redux Toolkit + redux-persist | latest | 12 slices |
| Animations | Framer Motion | latest | Page transitions, stagger |
| Backend | Node.js + Express | 18+ / 4.x | CommonJS |
| Database | MongoDB + Mongoose | Atlas M0 | 16 models |
| Cache/Queue | Redis (ioredis) | Upstash free | With in-memory fallback |
| Real-time | Socket.IO | 4.x | Consultation chat + notifications |
| Monorepo | npm workspaces | — | client / server / worker |

### AI Provider Strategy (Abstracted)

```
AI_PROVIDER=gemini  →  gemini-2.5-flash  (dev — free tier)
AI_PROVIDER=claude  →  claude-sonnet-4-20250514  (prod — paid)
```

Single env variable switch, zero code change needed.

### Storage Strategy (Abstracted)

```
STORAGE_PROVIDER=cloudinary  →  Cloudinary free (dev)
STORAGE_PROVIDER=s3          →  AWS S3 (prod)
```

### Other Free-Tier Services

| Service | Dev (Free) | Production |
|---------|-----------|------------|
| OTP/SMS | Twilio trial | MSG91 |
| WhatsApp | Twilio sandbox | Meta Cloud API |
| Voice transcription | HuggingFace Whisper (free) | OpenAI Whisper |
| Email | Gmail SMTP | — |
| PDF hosting | Cloudinary | AWS S3 |
| Deployment | Render free / Vercel | — |

---

## 2. System Overview

```
Personas:
  citizen    — normal user / applicant
  lawyer     — verified advocate
  paralegal  — assistant to lawyer (access via /lawyer/* routes)
  admin      — platform admin
  notary     — document notarization officer (NEW — added post-v2)

Subscription Tiers:
  citizen:   free | basic (₹99/mo) | pro (₹199/mo)
  lawyer:    free | professional (₹499/mo) | firm (₹1499/mo)
  admin:     internal only
  notary:    internal only (no billing)
```

### Request Flow

```
Browser → Vite Dev / Vercel CDN
         → React Router v6 (createBrowserRouter)
         → ProtectedRoute (persona-gated)
         → AppLayout (Navbar + Sidebar + BottomNav)
         → Lazy-loaded page component
         → Axios api.js → Express /v1/* routes
         → Auth middleware → Controller → MongoDB
         → Optional: AI service, eCourts, Razorpay, etc.
```

---

## 3. Actual Folder Structure

```
nyayasetu/                               # npm workspace root
├── package.json                         # root: concurrently dev script
├── docker-compose.yml
├── scripts/
│   └── seed.js
│
├── client/                              # React PWA (Vite + MUI + Redux)
│   ├── vite.config.js
│   ├── public/
│   │   ├── manifest.json               # PWA manifest
│   │   └── locales/
│   │       ├── en/translation.json
│   │       └── hi/translation.json     # ⚠ Only EN + HI seeded; 9 other langs empty
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                      # Router + Provider + socket bootstrap
│       ├── i18n/i18n.js                # i18next with lazy HTTP backend
│       ├── theme/
│       │   ├── ThemeProvider.jsx        # MUI createTheme + CSS vars
│       │   ├── tokens.js               # RADIUS, SHADOWS, TYPOGRAPHY constants
│       │   └── themes/
│       │       ├── default.js
│       │       ├── dark.js
│       │       ├── saffron.js
│       │       ├── emerald.js
│       │       └── highContrast.js
│       ├── store/
│       │   ├── store.js                # Redux root + redux-persist config
│       │   └── slices/
│       │       ├── authSlice.js
│       │       ├── chatSlice.js
│       │       ├── chatBotSlice.js
│       │       ├── nyayabotSlice.js
│       │       ├── documentSlice.js
│       │       ├── caseSlice.js
│       │       ├── uiSlice.js          # theme, language, sidebar, snackbars
│       │       ├── subscriptionSlice.js
│       │       ├── notificationSlice.js
│       │       ├── lawyerSlice.js
│       │       ├── consultationChatSlice.js
│       │       ├── notarySlice.js
│       │       └── errorSlice.js
│       ├── hooks/
│       │   ├── useAuth.js
│       │   ├── useChat.js
│       │   ├── useNyayaBot.js
│       │   ├── useCaseTracker.js
│       │   ├── useDocumentStream.js    # SSE streaming hook
│       │   ├── useFeatureAccess.js     # tier feature gate
│       │   └── useErrorHandling.jsx
│       ├── services/
│       │   ├── api.js                  # Axios instance + auth interceptors
│       │   ├── socket.js               # Socket.IO client singleton
│       │   └── razorpay.js             # Razorpay checkout handler
│       ├── utils/
│       │   └── featureFlags.js         # tier → features map (must stay in sync with server)
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Navbar.jsx
│       │   │   ├── Sidebar.jsx         # Persona-aware; lordicon icons via CDN
│       │   │   ├── BottomNav.jsx
│       │   │   └── ThemeSwitcher.jsx   # ⚠ Commented out in AppLayout
│       │   ├── ui/
│       │   │   ├── AnimatedPage.jsx
│       │   │   ├── GlassCard.jsx
│       │   │   ├── GradientHeading.jsx
│       │   │   ├── SectionHeader.jsx
│       │   │   ├── FeatureGate.jsx
│       │   │   ├── UpgradeCTA.jsx
│       │   │   ├── ProtectedRoute.jsx
│       │   │   ├── ErrorBoundary.jsx
│       │   │   ├── ScrollProgressBar.jsx
│       │   │   ├── LordIcon.jsx
│       │   │   └── LanguageSelector.jsx
│       │   ├── chat/
│       │   │   ├── ChatWindow.jsx
│       │   │   ├── MessageBubble.jsx
│       │   │   └── VoiceInput.jsx
│       │   ├── case/
│       │   │   ├── CaseCard.jsx
│       │   │   ├── HearingTimeline.jsx
│       │   │   └── CNRInput.jsx
│       │   ├── document/
│       │   │   ├── DocumentCard.jsx
│       │   │   ├── ClauseExplainer.jsx
│       │   │   ├── StampDutyCalculator.jsx
│       │   │   └── LawyerAnnotationPanel.jsx
│       │   ├── lawyer/
│       │   │   ├── LawyerSearch.jsx
│       │   │   └── ConsultationBooking.jsx
│       │   ├── consultation/
│       │   │   └── ConsultationChat.jsx
│       │   ├── notary/
│       │   │   ├── NotarySearch.jsx
│       │   │   └── NotarizationBooking.jsx
│       │   └── nyayabot/
│       │       ├── NyayaBotWidget.jsx  # Floating chat button
│       │       ├── NyayaBotWindow.jsx
│       │       └── NyayaBotMessage.jsx
│       └── pages/
│           ├── auth/
│           │   ├── Login.jsx           # Phone/Email OTP + password login
│           │   ├── Register.jsx        # Persona + profile completion
│           │   └── AuthShared.jsx      # Shared layout/styles
│           ├── public/
│           │   └── LandingPage.jsx
│           ├── citizen/
│           │   ├── CitizenHome.jsx
│           │   ├── NewDocument.jsx     # Template picker
│           │   ├── ChatFlow.jsx        # Conversational document creation
│           │   ├── DocumentPreview.jsx
│           │   ├── MyDocuments.jsx
│           │   ├── CaseDashboard.jsx
│           │   ├── CitizenProfile.jsx
│           │   ├── LawyerProfile.jsx   # View a specific lawyer's profile
│           │   └── EmergencyHelpline.jsx
│           ├── lawyer/
│           │   ├── LawyerHome.jsx
│           │   ├── LawyerDashboard.jsx # Profile management
│           │   ├── ClientList.jsx
│           │   ├── ClientDetail.jsx
│           │   ├── CaseManagement.jsx
│           │   ├── ConsultationsPage.jsx
│           │   └── EarningsPanel.jsx
│           ├── notary/
│           │   ├── NotaryHome.jsx
│           │   ├── NotaryDashboard.jsx
│           │   └── NotarizationRequests.jsx
│           ├── admin/
│           │   ├── AdminDashboard.jsx
│           │   ├── AdminUsers.jsx
│           │   ├── AdminLawyers.jsx
│           │   ├── AdminTemplates.jsx
│           │   └── AdminAuditLog.jsx
│           ├── shared/
│           │   ├── Pricing.jsx
│           │   ├── Settings.jsx
│           │   ├── SharedDocumentView.jsx
│           │   ├── CalendarPage.jsx   # ⚠ File exists; hook/page newly added
│           │   └── LawSearch.jsx
│           └── NyayaBotPage.jsx
│
├── server/                              # Express REST API
│   ├── package.json
│   └── src/
│       ├── app.js                       # Express setup, middleware, route mounting
│       ├── server.js                    # HTTP server + Socket.IO + graceful shutdown
│       ├── config/
│       │   ├── db.js                    # Mongoose connection
│       │   ├── redis.js                 # ioredis + in-memory fallback
│       │   └── constants.js             # All shared constants (enums, limits, etc.)
│       ├── models/
│       │   ├── User.model.js            # Unified user — all personas
│       │   ├── LawyerProfile.model.js
│       │   ├── DocumentTemplate.model.js
│       │   ├── ChatSession.model.js
│       │   ├── Document.model.js
│       │   ├── CaseTracker.model.js
│       │   ├── Subscription.model.js
│       │   ├── Payment.model.js
│       │   ├── Consultation.model.js
│       │   ├── ConsultationMessage.model.js
│       │   ├── Notification.model.js
│       │   ├── AuditLog.model.js
│       │   ├── JurisdictionRule.model.js
│       │   ├── LegalAct.model.js
│       │   ├── NyayaBotSession.js       # AI triage chatbot session
│       │   ├── PublicTriage.model.js    # Emergency triage log
│       │   ├── NotaryProfile.model.js   # ⚠ NEW — Notary persona
│       │   ├── NotarizationRequest.model.js # ⚠ NEW — Notary requests
│       │   ├── Chat.js                  # ⚠ Legacy/parallel chat model
│       │   └── index.js                 # Barrel export
│       ├── routes/
│       │   ├── auth.routes.js           → /v1/auth/*
│       │   ├── template.routes.js       → /v1/templates/*
│       │   ├── chat.routes.js           → /v1/chat/*
│       │   ├── document.routes.js       → /v1/documents/*
│       │   ├── case.routes.js           → /v1/cases/*
│       │   ├── lawyer.routes.js         → /v1/lawyers/* & /v1/consultations/*
│       │   ├── payment.routes.js        → /v1/payments/*
│       │   ├── subscription.routes.js   → /v1/subscriptions/*
│       │   ├── whatsapp.routes.js       → /v1/whatsapp/*
│       │   ├── jurisdiction.routes.js   → /v1/jurisdiction/*
│       │   ├── notification.routes.js   → /v1/notifications/*
│       │   ├── admin.routes.js          → /v1/admin/*
│       │   ├── profile.routes.js        → /v1/profile/*
│       │   ├── consultationChat.routes.js → /v1/consultations/*
│       │   ├── triage.routes.js         → /v1/triage/*
│       │   ├── notary.routes.js         → /v1/* (inconsistently mounted)
│       │   ├── nyayabotRoutes.js        → /v1/nyayabot/* (duplicate mount!)
│       │   └── chatRoutes.js            # ⚠ STALE — duplicate of chat.routes.js
│       ├── controllers/
│       │   ├── auth.controller.js
│       │   ├── template.controller.js
│       │   ├── chat.controller.js
│       │   ├── document.controller.js
│       │   ├── case.controller.js
│       │   ├── lawyer.controller.js
│       │   ├── payment.controller.js
│       │   ├── consultation.controller.js
│       │   ├── consultationChat.controller.js
│       │   ├── whatsapp.controller.js
│       │   ├── notification.controller.js
│       │   ├── triage.controller.js
│       │   ├── admin.controller.js      # ⚠ Likely thin/stub
│       │   ├── nyayabotController.js    # ⚠ Non-standard naming
│       │   └── chatController.js        # ⚠ STALE — duplicate
│       ├── services/
│       │   ├── ai/
│       │   │   ├── aiProvider.js        # Switch: gemini | claude
│       │   │   ├── geminiClient.js
│       │   │   ├── claudeClient.js
│       │   │   ├── documentEngine.js    # Document generation prompts
│       │   │   ├── questionEngine.js    # Conversational question prompts
│       │   │   ├── clauseExplainer.js   # Clause plain-language prompts
│       │   │   ├── aiChatService.js     # General chat orchestration
│       │   │   ├── aiNyayaBotService.js # NyayaBot triage AI
│       │   │   └── aiTriageService.js   # Public emergency triage AI
│       │   ├── ecourts/
│       │   │   ├── ecourtsClient.js     # HTTP client for NJDG API
│       │   │   └── ecourtsService.js    # Business logic wrapper
│       │   ├── indianKanoon/
│       │   │   └── kanoonClient.js
│       │   ├── pdf/
│       │   │   ├── pdfGenerator.js      # PDFKit document generation
│       │   │   └── notaryStamp.js       # Notarization stamp overlay
│       │   ├── storage/
│       │   │   ├── storageProvider.js   # Switch: cloudinary | s3
│       │   │   ├── cloudinaryService.js
│       │   │   └── s3Service.js
│       │   ├── notification/
│       │   │   ├── emailService.js      # Nodemailer / Gmail SMTP
│       │   │   ├── whatsappService.js   # Twilio WhatsApp
│       │   │   ├── smsService.js        # Twilio SMS
│       │   │   └── documentQueueClient.js
│       │   ├── payment/
│       │   │   └── razorpayService.js
│       │   ├── signature/
│       │   │   ├── signatureProvider.js # Switch: self | signdesk
│       │   │   ├── selfSigner.js        # In-house PDF signing
│       │   │   └── signDeskProvider.js  # SignDesk integration
│       │   ├── video/
│       │   │   └── videoProvider.js     # ⚠ STUB — not implemented
│       │   ├── voice/
│       │   │   ├── whisperProvider.js   # Switch: huggingface | openai
│       │   │   └── voiceService.js
│       │   └── socket.js               # Socket.IO server init + handlers
│       ├── middleware/
│       │   ├── auth.middleware.js       # JWT verify → req.user
│       │   ├── subscription.middleware.js # requireFeature()
│       │   ├── chatMiddleware.js
│       │   ├── verifyTwilioSignature.middleware.js
│       │   └── error.middleware.js      # Global error handler
│       ├── utils/
│       │   ├── asyncHandler.js
│       │   └── logger.js               # Winston logger
│       ├── data/
│       │   └── legalAidCenters.js      # Static legal aid center data
│       └── worker/                     # ⚠ Worker code lives inside server/src!
│           ├── worker.js
│           └── jobs/
│               ├── checkHearingDates.job.js
│               ├── generateDocument.job.js
│               ├── resetFreeQuota.js
│               └── sendHearingAlert.job.js
│
└── worker/                              # ⚠ Separate workspace (near-empty)
    ├── package.json
    └── src/
        └── worker.js                    # ⚠ References ../server jobs (wrong path)
```

---

## 4. MongoDB Schemas (As Implemented)

### 4.1 User (Unified — All Personas)

Key fields (as in `User.model.js`):
- **Identity:** `phone` (sparse, E.164), `email` (sparse, lowercase), `name`, `avatar`
- **Persona:** `enum ['citizen','lawyer','paralegal','admin','notary']` (notary added)
- **Location:** `state`, `district`, `pincode`
- **Preferences:** `preferredLanguage`, `preferredTheme`
- **Subscription:** embedded `subscriptionSchema` (plan, validUntil, autoRenew, billingCycle)
- **Free usage counters:** `freeUsage` (docsGenerated, docsLimit, casesTracked, casesLimit, aiChatsUsed, aiChatsLimit, triageUsed, resetDate)
- **WhatsApp:** `whatsappOptIn`, `whatsappNumber`, `whatsappVerified`, `whatsappSessionData`
- **Auth:** `passwordHash` (select:false), `refreshTokens[]`, `isEmailVerified`, `isPhoneVerified`
- **Metadata:** `registrationSource`, `isActive`, `lastActive`, timestamps

**Virtuals:** `isSubscribed`, `displayName`

**Instance methods:** `isWithinQuota(type)`, `incrementUsage(type)`, `addRefreshToken(token)`, `removeRefreshToken(token)`

**Static methods:** `findByPhone(phone)`, `resetMonthlyQuotas()`

**Indexes:** phone, email, subscription.plan, state+district, whatsappNumber, createdAt, lastActive

### 4.2 Other Models Summary

| Model | File | Key Notes |
|-------|------|-----------|
| LawyerProfile | `LawyerProfile.model.js` | barCouncilNumber, specialisations, consultationFee, ratings, verificationStatus |
| DocumentTemplate | `DocumentTemplate.model.js` | questionFlow[], systemPromptAddendum, requiredPlan per persona |
| ChatSession | `ChatSession.model.js` | messages[], collectedData Map, status, TTL on abandoned sessions |
| Document | `Document.model.js` | content (Markdown), legalCitations[], nextSteps[], pdfUrl, shareToken, version |
| CaseTracker | `CaseTracker.model.js` | cnrNumber, hearings[], nextHearingDate, alertChannels, linkedDocuments |
| Subscription | `Subscription.model.js` | plan, billingCycle, razorpayOrderId, startDate, endDate |
| Payment | `Payment.model.js` | type (pay_per_doc/subscription/consultation), razorpay IDs, lawyerEarnings |
| Consultation | `Consultation.model.js` | citizen, lawyer, mode, scheduledAt, status, rating |
| ConsultationMessage | `ConsultationMessage.model.js` | consultation ref, sender, content, Socket.IO messages |
| Notification | `Notification.model.js` | type enum, isRead, channel, 90-day TTL |
| AuditLog | `AuditLog.model.js` | action, resourceType, resourceId, userId, IP, success |
| NyayaBotSession | `NyayaBotSession.js` | AI triage bot conversation state |
| PublicTriage | `PublicTriage.model.js` | Anonymous emergency triage submissions |
| NotaryProfile | `NotaryProfile.model.js` | ⚠ NEW persona — notary officer details |
| NotarizationRequest | `NotarizationRequest.model.js` | ⚠ NEW — doc notarization workflow, ₹199 Video KYC |

---

## 5. API Routes (As Mounted)

**Base URL:** `/v1`
**Auth:** `Authorization: Bearer <token>`

### Authentication — `/v1/auth`
| Method | Path | Auth | Handler |
|--------|------|------|---------|
| POST | `/send-otp` | Public | Send OTP (phone or email) |
| POST | `/verify-otp` | Public | **⚠ OTP CHECK BYPASSED** — issues JWT without validating OTP |
| POST | `/login` | Public | Password-based login |
| POST | `/register` | Auth | Complete profile (name, state, persona) |
| GET | `/me` | Auth | Get current user + lawyerProfile |
| PATCH | `/me` | Auth | Update profile/preferences |
| POST | `/refresh` | Public | Rotate refresh token |
| POST | `/logout` | Auth | Revoke refresh token |
| POST | `/whatsapp-entry` | Public | WA deep-link login |
| POST | `/set-password` | Auth | Set/change password |

### Templates — `/v1/templates`
| Method | Path | Notes |
|--------|------|-------|
| GET | `/` | List with filters (category, state, plan) |
| GET | `/categories` | Categories with counts |
| GET | `/featured` | Featured templates |
| GET | `/:slug` | Template detail + question flow |

### Chat — `/v1/chat`
| Method | Path | Notes |
|--------|------|-------|
| POST | `/sessions` | Start new chat session |
| POST | `/sessions/:id/message` | Send message (SSE stream) — AI rate limited |
| GET | `/sessions/:id` | Get session state |
| GET | `/sessions` | List user's sessions |
| POST | `/sessions/:id/voice` | Audio upload → transcription (multer) |
| POST | `/sessions/:id/abandon` | Mark session abandoned |

### Documents — `/v1/documents`
| Method | Path | Notes |
|--------|------|-------|
| POST | `/generate` | Enqueue document generation (Bull) |
| GET | `/` | List user's documents (paginated) |
| GET | `/:id` | Document detail |
| GET | `/:id/pdf` | PDF download URL |
| POST | `/:id/explain-clause` | AI clause explanation (SSE) |
| POST | `/:id/regenerate` | Re-generate with edits |
| POST | `/:id/share` | Generate share token |
| GET | `/shared/:shareToken` | Public shared document view |
| PATCH | `/:id/link-case` | Link document to case |
| DELETE | `/:id` | Soft delete |

### Cases — `/v1/cases`
| Method | Path | Notes |
|--------|------|-------|
| POST | `/` | Add case by CNR (fetches eCourts) |
| GET | `/` | List tracked cases |
| GET | `/:id` | Case detail + hearings |
| POST | `/:id/refresh` | Manual eCourts sync |
| PATCH | `/:id/alerts` | Update alert preferences |
| DELETE | `/:id` | Stop tracking |

### Lawyers & Consultations — `/v1/lawyers`, `/v1/consultations`
| Method | Path | Notes |
|--------|------|-------|
| GET | `/lawyers` | Search lawyers (filter, paginate) |
| GET | `/lawyers/:id` | Lawyer public profile |
| POST | `/lawyers/apply` | Apply as lawyer |
| PUT | `/lawyers/profile` | Update own profile |
| GET | `/lawyers/me/clients` | Lawyer's client list |
| POST | `/consultations` | Book consultation |
| GET | `/consultations` | List consultations |
| PATCH | `/consultations/:id/accept` | Lawyer accepts |
| PATCH | `/consultations/:id/complete` | Mark complete |

### Payments & Subscriptions
| Route Prefix | Key Endpoints |
|---|---|
| `/v1/payments` | create-order, verify, history, webhook (raw body) |
| `/v1/subscriptions` | create, verify, current, cancel |

### Other Routes
| Prefix | Purpose |
|--------|---------|
| `/v1/whatsapp` | Twilio webhook (Twilio signature verified) |
| `/v1/notifications` | List, mark-read, mark-all-read |
| `/v1/jurisdiction` | States list, state+docType rules |
| `/v1/admin` | Users list, stats, lawyer verify, template CRUD |
| `/v1/profile` | Extended profile operations |
| `/v1/triage` | Emergency AI triage (public + authenticated) |
| `/v1/nyayabot` | NyayaBot AI chat (duplicate mount — app.js:138 + 174) |
| `/v1/` + notary | Notarization endpoints (poorly scoped mount) |
| `/v1/consultations` | Consultation chat messages (Socket.IO backed) |

---

## 6. AI Pipeline

### Provider Abstraction

```js
// server/src/services/ai/aiProvider.js
// AI_PROVIDER=gemini → geminiClient
// AI_PROVIDER=claude → claudeClient
const provider = process.env.AI_PROVIDER || 'gemini';
module.exports = provider === 'claude' ? require('./claudeClient') : require('./geminiClient');
```

### Gemini Client (Dev — Free)

- Model: `gemini-2.5-flash`
- Supports streaming via `sendMessageStream()`
- System instruction passed at `startChat()`
- `chat(messages, systemPrompt, stream)` + `generate(prompt)`

### Claude Client (Prod — Paid)

- Model: `claude-sonnet-4-20250514`
- Streaming via `anthropic.messages.stream()`
- `max_tokens`: 2048 (chat), 4096 (generate)

### AI Services

| Service | Purpose |
|---------|---------|
| `documentEngine.js` | Full document generation from collected form data |
| `questionEngine.js` | Context-aware next-question selection |
| `clauseExplainer.js` | Plain-language clause explanation |
| `aiChatService.js` | General Q&A chat orchestration |
| `aiNyayaBotService.js` | NyayaBot floating widget AI |
| `aiTriageService.js` | Emergency helpline triage AI |

---

## 7. WhatsApp Integration

### Architecture

```
User WhatsApp message
  → Twilio webhook POST /v1/whatsapp/webhook
  → verifyTwilioSignature middleware
  → whatsapp.controller.js
  → State machine via whatsappPhase in ChatSession
  → All data stored in same MongoDB as web users
  → User can log in on web with same phone → sees all docs/cases
```

### Deep Link Entry (Web from WhatsApp)

```
POST /v1/auth/whatsapp-entry?phone=+91...&wa_token=...
→ Redis validates one-time wa_token (TTL: short)
→ Creates/finds user → Issues JWT
```

### WhatsApp State Machine Phases

`WELCOME → SELECT_TEMPLATE → CHAT_FLOW → REVIEW → DOWNLOAD → CASE_TRACK_MENU → CNR_INPUT`

---

## 8. Personas, Plans & Feature Gates

### Plan Matrix

**Citizen**

| Feature | Free | Basic ₹99/mo | Pro ₹199/mo |
|---------|------|--------------|-------------|
| Docs/month | 3 | 15 | Unlimited |
| Cases tracked | 1 | 5 | Unlimited |
| AI chat sessions/month | 5 | 30 | Unlimited |
| PDF download | ✗ | ✓ | ✓ |
| Voice input | ✗ | ✓ | ✓ |
| Clause explainer | ✗ | ✓ | ✓ |
| Document sharing | ✗ | ✓ | ✓ |
| Hearing alerts | ✗ | WhatsApp | WA + Email |
| Lawyer booking | ✗ | View only | Book |
| Pay-per-doc (simple/standard/complex) | ₹49/₹99/₹199 | included | included |

**Lawyer**

| Feature | Free | Professional ₹499/mo | Firm ₹1499/mo |
|---------|------|----------------------|----------------|
| Client docs reviewable/mo | 0 | 20 | Unlimited |
| Case management | ✗ | ✓ | ✓ |
| Consultation bookings | ✗ | ✓ | ✓ (priority) |
| Revenue share | ✗ | 90% | 92% |
| Team paralegals | 0 | 0 | 5 |
| Analytics | ✗ | Basic | Advanced |

### Feature Gate Implementation

**Backend:** `server/src/middleware/subscription.middleware.js` — `requireFeature(featureName)` middleware

**Frontend:** `client/src/utils/featureFlags.js` + `client/src/components/ui/FeatureGate.jsx`

⚠ **Critical:** These two sources are not auto-synced. Any change to plan features must be updated in both places manually.

---

## 9. Theme & Language System

### Themes

5 themes, each exports a MUI palette + sets CSS custom properties on `:root`:
- `default` — Blue/white justice theme
- `saffron` — Saffron/tricolor (India-inspired)
- `dark` — Dark mode
- `highContrast` — Accessibility
- `emerald` — Green calm

All component colors use CSS vars (`var(--color-primary)`, etc.) — zero hardcoded hex values in components.

### i18n

- `i18next` + `i18next-http-backend` + `i18next-browser-languagedetector`
- Translations loaded lazily from `/locales/{{lng}}/translation.json`
- Supported: `en, hi, bn, mr, ta, te, gu, kn, ml, pa, ur`
- ⚠ Only `en` and `hi` translation files are populated. Other 9 locales fall back to English.

### RTL

- Urdu (`ur`) triggers `document.documentElement.dir = 'rtl'`
- ⚠ MUI RTL transform (`jss-rtl`/`stylis-plugin-rtl`) not yet configured

---

## 10. External API Integrations

### eCourts / NJDG

- **Base:** `https://services.ecourts.gov.in`
- CNR lookup → case status, hearing history, next date
- Falls back to NJDG scrape if REST fails
- ⚠ Rate-limited/bot-blocked in production — proxy needed

### Indian Kanoon

- **Base:** `https://api.indiankanoon.org`
- `POST /search/` — keyword search
- `GET /doc/{docId}/` — full text
- Used for live law citations in generated documents

### Razorpay

- Orders API for pay-per-doc + subscription creation
- Webhook at `/v1/payments/webhook` (raw body captured, HMAC verified)
- SignDesk webhook at `/v1/webhooks/signdesk` (raw body captured)

### Twilio

- SMS OTP via `sendOTP(phone, otp)`
- WhatsApp via TwiML MessagingResponse
- Webhook signature verified via `verifyTwilioSignature` middleware

### SignDesk

- Digital signature provider (production)
- Self-signer fallback for dev/testing

---

## 11. Payment Architecture

### Pay-Per-Doc Pricing

| Document Type | Price |
|--------------|-------|
| Simple | ₹49 |
| Standard | ₹99 |
| Complex/Premium | ₹199 |

### Subscription Annual Pricing

| Plan | Monthly | Annual |
|------|---------|--------|
| Citizen Basic | ₹99 | ₹999 |
| Citizen Pro | ₹199 | ₹1,999 |
| Lawyer Professional | ₹499 | ₹4,999 |
| Lawyer Firm | ₹1,499 | ₹14,999 |

### Notarization

- ₹199 flat fee for Video KYC notarization
- Managed via `NotarizationRequest` model
- PDF stamp via `notaryStamp.js`

### Flow

```
Frontend: razorpay.js opens Razorpay checkout
→ POST /v1/payments/create-order → Razorpay Orders API → orderId
→ User pays → Razorpay fires POST /v1/payments/webhook (HMAC verified)
→ payment.controller.js updates Document/Subscription status
→ Notification sent to user
```

---

## 12. Socket.IO & Real-Time

**Setup:** `server/src/services/socket.js` → `initSocket(io)`

**Events:**
- `consultation:message` — new message in a consultation chat
- `consultation:new_message` — unread count increment
- `notification` — push real-time in-app notification

**Auth:** JWT token sent on connection; server verifies before allowing events.

**Frontend:** `client/src/services/socket.js` — singleton, connect/disconnect on auth state change.

---

## 13. Background Worker

**Location:** `server/src/worker/` (inside server workspace — **not** the separate `worker/` workspace)

**Jobs:**

| Job | Trigger | Purpose |
|-----|---------|---------|
| `checkHearingDates.job.js` | Scheduled (Bull cron) | Poll eCourts for upcoming hearings |
| `sendHearingAlert.job.js` | Triggered by above | Send WhatsApp/email hearing reminders |
| `generateDocument.job.js` | Enqueued by document controller | Async PDF generation |
| `resetFreeQuota.js` | 1st of month cron | Reset free-tier usage counters |

**Queue:** Bull.js over Redis (Upstash)

⚠ The root-level `worker/` workspace is a near-empty stub that references server paths incorrectly. All working job code is in `server/src/worker/`.

---

## 14. Authentication & Security

### Auth Flow

1. `POST /auth/send-otp` — generates OTP, stores in Redis (TTL 5m), sends via SMS/email
2. `POST /auth/verify-otp` — validates OTP → issues JWT access (15m) + refresh (30d)
3. ⚠ **OTP verification is currently BYPASSED** (commented out for dev). Any phone/email creates a session.
4. `POST /auth/refresh` — rotating refresh tokens (reuse detection: revoke all on reuse)
5. Multi-device: max `MAX_REFRESH_TOKENS` (defined in constants) active per user

### Security Middleware

- **helmet** — CSP, HSTS, X-Frame-Options, etc.
- **cors** — allowlist: CLIENT_URL + localhost:5173/3000
- **express-rate-limit** — global (100/15min), AI (10/min), OTP (5/15min)
- **auth.middleware.js** — JWT verify → `req.user = { userId, persona, plan }`
- **subscription.middleware.js** — `requireFeature(feature)` → 403 if plan lacks it
- **verifyTwilioSignature** — validates X-Twilio-Signature header on WhatsApp webhook

### In-Memory OTP Fallback

When Redis is unavailable, OTPs are stored in a `Map` in process memory. ⚠ No TTL enforcement on entries — memory leak risk during extended Redis outages.

---

## 15. Frontend Architecture

### Routing

`createBrowserRouter` (React Router v6) with persona-gated route trees:
- `/` → `LandingPage` (public)
- `/login`, `/register` → auth pages (no layout)
- `/citizen/*` → `ProtectedRoute(allowedPersonas=['citizen'])` → `AppLayout`
- `/lawyer/*` → `ProtectedRoute(allowedPersonas=['lawyer','paralegal'])` → `AppLayout`
- `/admin/*` → `ProtectedRoute(allowedPersonas=['admin'])` → `AppLayout`
- `/notary/*` → `ProtectedRoute(allowedPersonas=['notary'])` → `AppLayout`
- `/laws/search` → `ProtectedRoute` (any persona)
- `/shared/:shareToken` → public document view
- `/pricing` → public

All pages are lazy-loaded with `Suspense` + `PageLoader` fallback.

### State Management (Redux)

| Slice | Persisted | Purpose |
|-------|-----------|---------|
| authSlice | ✓ | User, tokens, loading |
| uiSlice | ✓ | Theme, language, sidebar, snackbars |
| subscriptionSlice | ✓ | Active plan, free usage counters |
| documentSlice | ✗ | Document list, current document |
| caseSlice | ✗ | Case list |
| chatSlice | ✗ | Active chat session |
| nyayabotSlice | ✗ | NyayaBot widget state |
| chatBotSlice | ✗ | (Likely legacy/duplicate of nyayabotSlice) |
| lawyerSlice | ✗ | Lawyer search results |
| notificationSlice | ✗ | In-app notifications |
| consultationChatSlice | ✗ | Consultation chat messages + unread |
| notarySlice | ✗ | Notary-specific state |
| errorSlice | ✗ | Global error state |

### AppBootstrap (App.jsx)

On mount:
1. If `nyayasetu_token` in localStorage → dispatch `getMe()` to hydrate user
2. If authenticated → connect Socket.IO, register event handlers
3. Set `document.dir` for RTL languages
4. Register service worker (PROD only)

---

## 16. Environment Variables

```bash
# Core
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
AI_PROVIDER=gemini                 # 'claude' in prod
STORAGE_PROVIDER=cloudinary        # 's3' in prod

# Database
MONGO_URI=mongodb+srv://...

# Cache / Queue
REDIS_URL=redis://...

# JWT
JWT_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=30d

# AI — Dev
GEMINI_API_KEY=AIza...

# AI — Prod
ANTHROPIC_API_KEY=sk-ant-...

# Voice — Dev
HF_API_KEY=hf_...
HF_WHISPER_MODEL=openai/whisper-large-v3

# Voice — Prod
OPENAI_API_KEY=sk-...

# WhatsApp / OTP
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_SMS_FROM=+15005550006

# OTP — Prod
MSG91_AUTH_KEY=...
MSG91_TEMPLATE_ID=...

# Storage — Dev
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Storage — Prod
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
AWS_S3_BUCKET=nyayasetu-documents

# Payments
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Signature
SIGNDESK_API_KEY=...
SIGNDESK_WEBHOOK_SECRET=...

# External APIs
ECOURTS_API_BASE=https://services.ecourts.gov.in
INDIANKANOON_API_KEY=...

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_FROM="NyayaSetu <noreply@nyayasetu.in>"

# Security
FIELD_ENCRYPTION_KEY=32-char-hex

# Dev shortcuts
DEV_PHONE=+919999999999
DEV_OTP=123456
```

---

## 17. Deployment

| Component | Dev | Production |
|-----------|-----|------------|
| Frontend | `vite dev` | Vercel |
| Backend | `nodemon` / Render free | Render / Railway |
| MongoDB | Atlas M0 (free) | Atlas M10+ |
| Redis | Upstash free | Upstash paid |
| Worker | `node server/src/worker/worker.js` | Same server or separate process |

Docker Compose: available for full local stack (MongoDB + Redis + server + client).

---

## 18. Known Gaps & TODOs

> These are gaps between the designed architecture and the actual implementation.
> See **AUDIT.md** for the full list of flaws, bugs, and improvement areas.

### Critical (Blocks Production)

- [ ] **OTP verification bypassed** — `auth.controller.js` lines 317–404 are commented out
- [ ] **Feature flags not synced** — `featureFlags.js` (client) vs `subscription.middleware.js` (server) can diverge
- [ ] **Lawyer auto-verified in dev** — `register()` sets `isVerified: process.env.NODE_ENV === 'development'`

### Missing Implementations

- [ ] Video consultation provider (`videoProvider.js` is a stub)
- [ ] 9 language translation files (only EN + HI exist)
- [ ] MUI RTL support for Urdu
- [ ] ThemeSwitcher widget (commented out in AppLayout)
- [ ] Admin controller (thin — most admin operations not fully implemented)
- [ ] `worker/` workspace (outer) references wrong paths

### Structural Issues

- [ ] Duplicate files: `chatRoutes.js`, `chatController.js`, `emailService.js` (root)
- [ ] `nyayabotRoutes` mounted twice in `app.js` (lines 138 + 174)
- [ ] `notaryRoutes` mounted at `/v1` root instead of `/v1/notary`
- [ ] Worker code split between `server/src/worker/` and `worker/` workspace

### Not Yet Built (from v2 Architecture)

- [ ] Pay-per-doc flow in frontend (UI exists, full payment gate missing)
- [ ] Paralegal persona pages (routes exist but no dedicated pages)
- [ ] Document versioning UI
- [ ] WhatsApp state machine (backend stub, not fully wired)
- [ ] Admin: lawyer approval workflow (frontend + backend)
- [ ] Subscription renewal / cancellation flow in UI

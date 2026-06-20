# NyayaSetu — Bridge to Justice

> **न्याय सबके लिए** — AI-powered legal document creation, court case tracking, and lawyer connect for every Indian citizen, in every Indian language.

---

## What is NyayaSetu?

NyayaSetu ("Bridge to Justice") makes professional legal documents and court case tracking accessible to every Indian — regardless of income, literacy, or legal knowledge.

Generate an RTI application, consumer complaint, or legal notice in under 10 minutes through a guided AI conversation. Track court hearings via CNR number. Connect with verified advocates. Notarize documents via Video KYC. All in your language.

---

## Features

### For Citizens
- **AI Document Generation** — 15+ legal templates (RTI, consumer complaints, cheque bounce, legal notices, etc.). Guided Q&A, no legal knowledge needed.
- **WhatsApp Integration** — Generate documents and receive hearing reminders directly on WhatsApp.
- **Court Case Tracker** — Track hearings via CNR number with eCourts / NJDG integration. Automatic WhatsApp/email reminders before each hearing.
- **NyayaBot** — Floating AI assistant for instant legal Q&A and emergency triage.
- **Emergency Helpline** — AI triage + directory of legal aid centers.
- **Lawyer Connect** — Find and book consultations with verified advocates.
- **Law Search** — Search Indian Kanoon for live case law and act sections.
- **11 Indian Languages** — English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Urdu.
- **Progressive Web App** — Installable on Android and iOS.
- **5 Themes** — Default, Saffron, Dark, High Contrast, Emerald.

### For Lawyers
- Verified advocate profiles with Bar Council number
- Consultation booking (chat, video, phone, in-person)
- Client portal — manage documents, case notes, consultations
- Earnings dashboard with analytics
- 90–92% revenue share on consultations

### For Notaries
- Video KYC notarization at ₹199 flat
- Digital stamp issuance via PDF overlay
- Request queue management

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 18 + Vite | PWA-ready |
| UI | MUI v6 + Framer Motion | 5 custom themes |
| State | Redux Toolkit + redux-persist | 13 slices |
| Backend | Node.js 18+ + Express 4 | CommonJS |
| Database | MongoDB + Mongoose | 16 models, Atlas M0 free |
| Cache / Queue | Redis (ioredis) + Bull.js | Upstash free tier |
| Real-time | Socket.IO 4 | Consultation chat + notifications |
| AI (dev) | Gemini 2.5 Flash | Google AI Studio free tier |
| AI (prod) | Claude Sonnet 4 | Abstracted — 1 env var switch |
| Payments | Razorpay | Test keys in dev |
| Storage (dev) | Cloudinary free | 25 GB storage |
| Storage (prod) | AWS S3 | ap-south-1 |
| SMS/WhatsApp | Twilio (dev) → MSG91 (prod SMS) | |
| Voice | HuggingFace Whisper (dev) → OpenAI (prod) | |
| PDF | PDFKit + Cloudinary/S3 | |
| Logging | Winston | |
| Monorepo | npm workspaces | client / server / worker |

---

## Personas & Plans

| Persona | Free | Paid Plans |
|---------|------|-----------|
| **Citizen** | 3 docs/mo, 1 case, 5 AI chats | Basic ₹99/mo · Pro ₹199/mo |
| **Lawyer** | View only | Professional ₹499/mo · Firm ₹1499/mo |
| **Paralegal** | Team member under Firm plan | — |
| **Notary** | Platform internal | — |
| **Admin** | Platform internal | — |

Pay-per-doc: ₹49 (simple) / ₹99 (standard) / ₹199 (complex)
Annual: ~2 months free

---

## Quick Start

### Prerequisites

- Node.js ≥ 18, npm ≥ 9
- MongoDB Atlas M0 (free) or local MongoDB
- Redis (Upstash free tier or local)
- Gemini API key (free from [ai.google.dev](https://ai.google.dev))

### 1. Install

```bash
git clone https://github.com/your-org/nyayasetu.git
cd nyayasetu
npm install          # installs all workspaces
```

### 2. Configure

```bash
cp .env.example .env
```

Minimum required for local dev:

```env
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/nyayasetu
REDIS_URL=redis://localhost:6379
JWT_SECRET=<node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<same command>
AI_PROVIDER=gemini
GEMINI_API_KEY=<from ai.google.dev — free>
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### 3. Run

```bash
# Frontend + Backend (recommended for dev)
npm run dev

# All three (includes background worker)
npm run dev:all
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:5000 |
| Health | http://localhost:5000/health |

### Dev Login

OTP verification is **currently bypassed** in development. Enter any phone number or email and submit — a session is created without OTP validation. This is intentional for development convenience and **must be re-enabled before production**.

### Docker

```bash
# Start MongoDB + Redis
docker-compose up -d mongo redis

# Or full stack
docker-compose up
```

---

## Project Structure

```
nyayasetu/
├── client/                    # React 18 PWA (Vite + MUI v6 + Redux)
│   ├── public/locales/        # i18n translation files (en + hi populated; 9 others empty)
│   └── src/
│       ├── App.jsx            # Router + Providers + socket bootstrap
│       ├── store/slices/      # 13 Redux slices
│       ├── pages/             # citizen/ lawyer/ admin/ notary/ shared/ auth/ public/
│       ├── components/        # layout/ ui/ chat/ case/ document/ lawyer/ notary/ nyayabot/
│       ├── theme/             # ThemeProvider + 5 themes + tokens
│       ├── hooks/             # useAuth, useChat, useCaseTracker, useFeatureAccess, …
│       └── services/          # api.js (Axios), socket.js, razorpay.js
│
├── server/                    # Express API + background jobs
│   └── src/
│       ├── app.js             # Express setup, middleware, route mounting
│       ├── server.js          # HTTP server + Socket.IO + graceful shutdown
│       ├── models/            # 16 Mongoose models
│       ├── routes/            # 16 route files mounted at /v1/*
│       ├── controllers/       # Business logic
│       ├── services/          # ai/ storage/ payment/ notification/ signature/ voice/
│       ├── middleware/        # auth, subscription, error, twilio signature
│       ├── config/            # db, redis, constants
│       └── worker/            # Bull.js jobs (inside server workspace)
│           └── jobs/          # checkHearingDates, sendHearingAlert, generateDocument, resetFreeQuota
│
├── scripts/seed.js            # Database seed
├── docker-compose.yml
├── .env.example
├── NyayaSetu_Complete_Architecture.md   # Full as-built architecture reference
└── AUDIT.md                   # All known issues, gaps, and improvement areas
```

---

## API Overview

Base: `http://localhost:5000/v1` | Auth: `Authorization: Bearer <token>`

| Route Group | Endpoints |
|------------|-----------|
| `/auth` | send-otp, verify-otp, login (password), register, me (GET/PATCH), refresh, logout, set-password, whatsapp-entry |
| `/templates` | List, categories, featured, detail by slug |
| `/chat` | Create session, send message (SSE), voice upload, session state |
| `/documents` | Generate, list, detail, PDF URL, clause explain, share, link-case, delete |
| `/cases` | Add by CNR, list, refresh from eCourts, alert settings, delete |
| `/lawyers` | Search, profile, apply, update profile, clients list |
| `/consultations` | Book, list, accept, complete, messages (via Socket.IO) |
| `/payments` | Create order, verify, history, Razorpay webhook |
| `/subscriptions` | Create, verify, current, cancel |
| `/triage` | Emergency AI triage (public + authenticated) |
| `/notifications` | List, mark-read, mark-all-read |
| `/whatsapp` | Twilio webhook (Twilio-signed) |
| `/admin` | Users, stats, lawyer verify, template CRUD, audit logs |

Full route reference: [NyayaSetu_Complete_Architecture.md](./NyayaSetu_Complete_Architecture.md#5-api-routes-as-mounted)

---

## Architecture

```
Browser / WhatsApp
      │
      ▼
React PWA (Vite)  ──── Socket.IO ────────────────┐
      │                                           │
      │ HTTPS / REST + SSE                        │
      ▼                                           ▼
Express API (:5000)                        Socket.IO events
  ├── Auth middleware (JWT)               (consultation chat,
  ├── Rate limiting (global / AI / OTP)   notifications)
  ├── AI Service  ─── Gemini / Claude
  ├── PDF Service ─── PDFKit + Storage
  ├── Razorpay    ─── Payment
  └── Twilio      ─── SMS / WhatsApp
      │
      ├── MongoDB (16 models)
      ├── Redis (OTP, cache, Bull queues)
      └── Bull Worker (background jobs)
              ├── checkHearingDates (cron)
              ├── sendHearingAlert
              ├── generateDocument
              └── resetFreeQuota (monthly)
```

**Data flow — Document Generation:**
```
ChatFlow UI → POST /chat/sessions/:id/message (SSE stream)
  → AI extracts data field by field
  → [data complete] → POST /documents/generate
  → Bull queue → generateDocument.job.js
  → PDFKit renders PDF → Cloudinary/S3
  → WhatsApp notification sent to user
```

---

## Tests

```bash
cd server
npm test                              # run all tests
npm test -- --testPathPattern=auth    # specific file
npm test -- --coverage                # coverage report
```

Currently: `auth.test.js` + `payment.test.js`. Coverage is low. See [AUDIT.md](./AUDIT.md) for what needs tests.

---

## Known Issues Before Production

See [AUDIT.md](./AUDIT.md) for the complete list. Critical blockers:

1. **OTP verification bypassed** — `auth.controller.js` lines 317–404 commented out. Must be re-enabled.
2. **Lawyer auto-verification in dev** — `register()` auto-approves lawyers when `NODE_ENV=development`.
3. **Feature flags not synced** — `client/src/utils/featureFlags.js` and `server/src/middleware/subscription.middleware.js` must be kept in sync manually.
4. **9 language translations empty** — only `en` and `hi` locales have content.
5. **Duplicate stale files** — `chatRoutes.js`, `chatController.js`, root-level `emailService.js` should be deleted.
6. **nyayabotRoutes double-mounted** — registered twice in `app.js` (lines 138 + 174).

---

## Security

- Helmet.js security headers (CSP, HSTS, X-Frame-Options)
- JWT access tokens (15m) + rotating refresh tokens (30d), reuse detection
- HMAC-SHA256 verification on Razorpay webhook
- X-Twilio-Signature verification on WhatsApp webhook
- Rate limiting: 100 req/15min global, 10 req/min on AI, 5 req/15min on OTP
- No raw secrets in logs
- Sensitive fields: `passwordHash` excluded from default select

---

## Architecture Reference

[NyayaSetu_Complete_Architecture.md](./NyayaSetu_Complete_Architecture.md) — full as-built documentation including:
- All MongoDB schemas
- Complete API route table
- AI provider abstraction
- Payment flow
- Feature gate matrix
- Environment variable reference
- Known gaps

---

## Acknowledgements

- [eCourts / NJDG](https://njdg.ecourts.gov.in) for case data
- [Indian Kanoon](https://indiankanoon.org) for legal citations
- All Indian advocates who reviewed template accuracy

---

**NyayaSetu — न्याय सबके लिए**

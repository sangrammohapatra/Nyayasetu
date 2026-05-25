# ⚖️ NyayaSetu — Bridge to Justice

> **न्याय सबके लिए** — AI-powered legal document creation and court case tracking for every Indian citizen, in every Indian language.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20-green.svg)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248.svg)](https://mongodb.com)

---

## 📖 What is NyayaSetu?

NyayaSetu ("Bridge to Justice" in Hindi) makes professional legal documents and court case tracking accessible to every Indian — regardless of income, literacy, or legal knowledge.

Generate an RTI application, consumer complaint, or legal notice in under 10 minutes through a guided AI conversation. Track court hearings via CNR number. Connect with verified advocates for just ₹99. All in your language.

---

## ✨ Features

### For Citizens
- 🤖 **AI Document Generation** — 15+ legal templates including RTI, consumer complaints, cheque bounce notices, and more. Guided Q&A, no legal knowledge needed.
- 📱 **WhatsApp Integration** — Generate documents and receive hearing reminders directly on WhatsApp.
- ⚖️ **Court Case Tracker** — Track hearings via CNR number with eCourts integration. Automatic WhatsApp/email reminders 2 days before each hearing.
- 👨‍⚖️ **Lawyer Connection** — Find and book consultations with verified advocates from ₹99.
- 🌐 **11 Indian Languages** — English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Urdu.
- 📲 **Progressive Web App** — Installable on Android and iOS. Works offline for viewing saved documents.
- 🔒 **Free Forever** — RTI applications, domestic violence complaints, and FIR drafts are permanently free for all users.

### For Lawyers
- 🏛️ **Verified Lawyer Profiles** — Join NyayaSetu's network and reach thousands of clients.
- 📅 **Consultation Booking** — Accept video, phone, chat, or in-person consultations.
- 💰 **Earnings Dashboard** — Track monthly earnings with Recharts analytics. 90% revenue share.
- 👥 **Client Portal** — Manage client documents and case notes in one place.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, MUI v5, Framer Motion, Redux Toolkit, React Router v6 |
| **Backend** | Node.js 20, Express 4, Mongoose 8 |
| **AI** | Google Gemini (dev) / Anthropic Claude Sonnet (prod) |
| **Database** | MongoDB 7.0 |
| **Cache / Queues** | Redis 7, Bull |
| **Auth** | JWT (access 15m + refresh 30d), Phone OTP |
| **Payments** | Razorpay |
| **Storage** | Cloudinary (dev) / AWS S3 (prod) |
| **SMS / WhatsApp** | Twilio |
| **Email** | Gmail SMTP (dev) / SendGrid (prod) |
| **i18n** | i18next with HTTP backend |
| **PWA** | Vite PWA Plugin + Workbox |
| **Testing** | Jest + Supertest + mongodb-memory-server |
| **Containers** | Docker + Docker Compose |
| **Monitoring** | Bull Board, Winston logger |

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | ≥ 20 | [nodejs.org](https://nodejs.org) |
| Docker + Compose | Latest | [docker.com](https://docker.com) |
| Git | Latest | [git-scm.com](https://git-scm.com) |

### 1 — Clone the repository

```bash
git clone https://github.com/your-org/nyayasetu.git
cd nyayasetu
```

### 2 — Install dependencies

```bash
# Backend
cd server && npm install && cd ..

# Frontend
cd client && npm install && cd ..
```

### 3 — Configure environment

```bash
# Copy the example env and fill in your values
cp .env.example .env
```

Minimum required values for local development:

```env
MONGO_URI=mongodb://localhost:27017/nyayasetu
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generate: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<generate same way>
FIELD_ENCRYPTION_KEY=<generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
AI_PROVIDER=gemini
GEMINI_API_KEY=<get free key at ai.google.dev>
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=<from twilio.com/console>
TWILIO_AUTH_TOKEN=<from twilio.com/console>
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
RAZORPAY_KEY_ID=rzp_test_<your_key>
RAZORPAY_KEY_SECRET=<your_secret>
STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=<your_cloud>
CLOUDINARY_API_KEY=<your_key>
CLOUDINARY_API_SECRET=<your_secret>
```

### 4 — Start infrastructure with Docker

```bash
# Start MongoDB and Redis only (server runs locally for hot-reload)
docker-compose up -d mongo redis

# Or start everything (server + worker in Docker)
docker-compose up -d
```

### 5 — Seed the database

```bash
cd server

# Seed all initial data (acts → jurisdictions → templates)
npm run seed:all

# Create the admin account (password printed once — save it!)
npm run create:admin
```

### 6 — Start development servers

```bash
# Terminal 1 — Express API (hot-reload)
cd server && npm run dev

# Terminal 2 — Bull Worker (hot-reload)
cd server && npm run worker:dev

# Terminal 3 — React frontend (Vite)
cd client && npm run dev
```

### 7 — Open in browser

| URL | Description |
|---|---|
| http://localhost:3000 | React frontend |
| http://localhost:5000/health | API health check |
| http://localhost:5001/admin/queues | Bull Board (queue monitor) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          NyayaSetu Platform                          │
└─────────────────────────────────────────────────────────────────────┘

  ┌───────────────┐     ┌───────────────┐     ┌───────────────────┐
  │  React PWA    │     │  WhatsApp Bot │     │   Admin Panel     │
  │  (Vite + MUI) │     │  (Twilio)     │     │   (React)         │
  └───────┬───────┘     └───────┬───────┘     └────────┬──────────┘
          │                     │                       │
          │         HTTPS / REST + SSE                  │
          └─────────────────────┼───────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │   Express API Server  │
                    │   Node.js 20 / :5000  │
                    │                       │
                    │  ┌─────────────────┐  │
                    │  │  Routes / Ctrl  │  │
                    │  ├─────────────────┤  │
                    │  │  Auth (JWT+OTP) │  │
                    │  ├─────────────────┤  │
                    │  │  AI Service     │  │  ◄── Gemini / Claude
                    │  ├─────────────────┤  │
                    │  │  Razorpay Svc   │  │  ◄── Payment
                    │  ├─────────────────┤  │
                    │  │  Storage Svc    │  │  ◄── Cloudinary / S3
                    │  └─────────────────┘  │
                    └───────────┬───────────┘
                                │
              ┌─────────────────┼────────────────┐
              │                 │                │
    ┌─────────▼──────┐  ┌───────▼──────┐  ┌─────▼──────────────┐
    │  MongoDB 7.0   │  │  Redis 7     │  │  Bull Worker       │
    │  (Documents,   │  │  (Sessions,  │  │  (Background jobs) │
    │   Users,       │  │   OTP cache, │  │                    │
    │   Cases,       │  │   Rate limit)│  │  ┌──────────────┐  │
    │   Templates)   │  └──────────────┘  │  │ hearingAlerts│  │
    └────────────────┘                    │  │ documents    │  │
                                          │  │ subscriptions│  │
                                          │  │ notifications│  │
                                          │  └──────────────┘  │
                                          └────────────────────┘

  External Services:
  ┌──────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐
  │  Twilio  │  │  Razorpay  │  │ Google AI  │  │  Cloudinary  │
  │  SMS/WA  │  │  Payments  │  │  Gemini    │  │  /AWS S3     │
  └──────────┘  └────────────┘  └────────────┘  └──────────────┘
```

### Data flow — Document Generation

```
User → ChatFlow UI
         │
         ▼
  POST /v1/chat/message
         │
         ▼
  AI Service (Gemini/Claude)
    ← SSE stream back to UI →
         │
  [dataComplete = true]
         │
         ▼
  Bull Queue: generateDocument
         │
         ▼
  Document stored in MongoDB
  PDF rendered + stored in Cloudinary/S3
         │
         ▼
  WhatsApp notification sent to user
```

---

## 📁 Project Structure

```
nyayasetu/
├── client/                     # React PWA
│   ├── public/
│   │   ├── locales/            # i18n translation files (en, hi, bn, mr, ta, te…)
│   │   ├── icons/              # PWA icons (72–512px)
│   │   └── manifest.json       # PWA manifest
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/         # Navbar, Sidebar, BottomNav, ThemeSwitcher
│   │   │   ├── ui/             # AnimatedPage, GlassCard, FeatureGate, ProtectedRoute
│   │   │   ├── chat/           # MessageBubble, VoiceInput
│   │   │   ├── case/           # CNRInput, HearingTimeline
│   │   │   ├── document/       # ClauseExplainer
│   │   │   └── lawyer/         # LawyerSearch, ConsultationBooking
│   │   ├── pages/
│   │   │   ├── auth/           # Login, Register
│   │   │   ├── citizen/        # Home, NewDocument, ChatFlow, DocumentPreview, …
│   │   │   ├── lawyer/         # LawyerHome, Dashboard, ClientList, Earnings, …
│   │   │   └── shared/         # Pricing, Settings
│   │   ├── store/
│   │   │   ├── store.js        # Redux store + persistence
│   │   │   └── slices/         # auth, ui, chat, document, case, subscription, …
│   │   ├── theme/              # MUI theme tokens + 5 themes + ThemeProvider
│   │   ├── i18n/               # i18next configuration
│   │   ├── services/           # api.js (axios), razorpay.js
│   │   └── utils/              # featureFlags.js
│   ├── index.html
│   └── vite.config.js
│
├── server/                     # Express API + Bull Worker
│   ├── src/
│   │   ├── config/             # constants.js, database.js
│   │   ├── controllers/        # auth, document, case, lawyer, payment, admin, …
│   │   ├── middleware/         # auth, rateLimiter, verifyTwilio, errorHandler
│   │   ├── models/             # User, DocumentTemplate, Document, Case, …
│   │   ├── routes/             # v1 router
│   │   ├── services/
│   │   │   ├── ai/             # aiService.js (Gemini/Claude abstraction)
│   │   │   ├── notification/   # whatsappService.js, emailService.js
│   │   │   ├── payment/        # razorpayService.js
│   │   │   └── storage/        # storageService.js
│   │   ├── utils/              # logger.js, asyncHandler.js, validators.js
│   │   ├── worker/
│   │   │   ├── worker.js       # Bull worker entry point
│   │   │   └── jobs/           # checkHearingDates, sendHearingAlert, generateDocument, …
│   │   ├── app.js              # Express app factory
│   │   └── server.js           # HTTP server entry
│   ├── tests/                  # Jest integration tests
│   ├── scripts/                # Seed scripts, createAdmin
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🧪 Running Tests

```bash
cd server

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPattern=auth
npm test -- --testPathPattern=payment

# Watch mode
npm run test:watch
```

Test files use `mongodb-memory-server` — no running MongoDB required.

---

## 🌱 Seeding Data

```bash
cd server

npm run seed:acts          # Seed 8 Legal Acts with real section text
npm run seed:jurisdictions # Seed 15 JurisdictionRule records (5 states × 3 types)
npm run seed:templates     # Seed 15 DocumentTemplate records
npm run seed:all           # Run all three in correct order
npm run create:admin       # Create admin@nyayasetu.in (password printed once)
```

All seed scripts are idempotent — safe to run multiple times.

---

## 🔑 Environment Variables

See [`.env.example`](.env.example) for the complete reference with inline documentation.

Key sections:
- **MongoDB / Redis** — connection strings
- **JWT** — access + refresh token secrets and expiry
- **AI Provider** — `gemini` (free dev) or `claude` (prod)
- **SMS / WhatsApp** — Twilio credentials
- **Storage** — Cloudinary (dev) or AWS S3 (prod)
- **Payments** — Razorpay test/live keys
- **Security** — `FIELD_ENCRYPTION_KEY` (AES-256 for sensitive DB fields)

---

## 📡 API Reference

Base URL: `http://localhost:5000/v1`

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/send-otp` | Send OTP to phone number |
| POST | `/auth/verify-otp` | Verify OTP, receive JWT |
| GET | `/auth/me` | Get current user profile |
| PATCH | `/auth/me` | Update profile |
| POST | `/auth/logout` | Logout (invalidate refresh token) |
| POST | `/auth/refresh` | Refresh access token |

### Documents
| Method | Path | Description |
|---|---|---|
| GET | `/templates` | List all document templates |
| GET | `/templates/:slug` | Get template details |
| POST | `/chat/sessions` | Create AI chat session |
| POST | `/chat/sessions/:id/messages` | Send message (SSE response) |
| GET | `/documents` | List user's documents |
| GET | `/documents/:id` | Get document |
| GET | `/documents/:id/pdf` | Get PDF download URL |
| POST | `/documents/:id/share` | Generate share link |
| DELETE | `/documents/:id` | Delete document |
| POST | `/documents/:id/explain-clause` | Explain clause (SSE) |

### Cases
| Method | Path | Description |
|---|---|---|
| POST | `/cases` | Add case by CNR |
| GET | `/cases` | List user's cases |
| PATCH | `/cases/:id/refresh` | Sync from eCourts |
| PATCH | `/cases/:id/alerts` | Update alert settings |
| DELETE | `/cases/:id` | Remove case |

### Lawyers
| Method | Path | Description |
|---|---|---|
| GET | `/lawyers` | Search lawyers |
| GET | `/lawyers/:id` | Get lawyer profile |
| POST | `/lawyers/apply` | Apply as lawyer |
| GET | `/lawyers/me/clients` | Get my clients |
| POST | `/consultations` | Book consultation |
| PATCH | `/consultations/:id/accept` | Accept consultation |
| PATCH | `/consultations/:id/reject` | Reject + refund |

### Payments
| Method | Path | Description |
|---|---|---|
| POST | `/payments/create-order` | Create Razorpay order |
| POST | `/payments/verify` | Verify payment |
| POST | `/payments/webhook` | Razorpay webhook |
| GET | `/payments/history` | Payment history |

Full OpenAPI spec: `http://localhost:5000/v1/docs` (when running)

---

## 🤝 Contributing

We welcome contributions! NyayaSetu is especially looking for:

- **Translators** — We need quality translations for bn, mr, ta, te, gu, kn, ml, pa, ur
- **Legal reviewers** — Lawyers who can verify template accuracy for different states
- **Developers** — Help with admin panel, more templates, and accessibility

### Development workflow

```bash
# 1. Fork the repo and clone your fork
git clone https://github.com/<your-username>/nyayasetu.git

# 2. Create a feature branch
git checkout -b feature/your-feature-name

# 3. Make changes, add tests
npm test

# 4. Commit with conventional commits
git commit -m "feat(templates): add POCSO complaint template"

# 5. Push and open a Pull Request
git push origin feature/your-feature-name
```

### Commit convention

```
feat(scope):     New feature
fix(scope):      Bug fix
docs(scope):     Documentation
test(scope):     Tests
refactor(scope): Code refactor
style(scope):    Formatting
chore(scope):    Dependencies / config
```

### Code style

- ESLint + Prettier (run `npm run lint:fix`)
- No `console.log` in production code — use `logger.info/error/warn`
- All monetary values in **paise** (₹1 = 100 paise)
- All API responses: `{ data }` for success, `{ error, details }` for errors

---

## 🔒 Security

- All JWT secrets rotated every 90 days
- Sensitive DB fields (phone, Aadhaar references) encrypted with AES-256
- Razorpay webhook verified with HMAC-SHA256
- Twilio webhook verified with X-Twilio-Signature
- Rate limiting on all endpoints (express-rate-limit)
- Helmet.js security headers
- No PII in logs

Found a vulnerability? Email security@nyayasetu.in — we respond within 24 hours.

---

## 📄 Licence

MIT © 2024 NyayaSetu

---

## 🙏 Acknowledgements

- [eCourts](https://ecourts.gov.in) for case data API
- [Indian Kanoon](https://indiankanoon.org) for legal citations
- All the Indian advocates who provided feedback on template accuracy
- Open-source contributors

---

<div align="center">
  <strong>⚖️ NyayaSetu — न्याय सबके लिए</strong><br>
  Made with ❤️ for India
</div>

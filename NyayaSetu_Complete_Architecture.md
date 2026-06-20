# NyayaSetu — Complete Updated Technical Architecture & Step-by-Step Code Generation Prompts
**Version 2.0 | Development-First (Free Tier) → Production-Ready**

---

## TABLE OF CONTENTS
1. [Architecture Decisions & Free-Tier Strategy](#1-architecture-decisions--free-tier-strategy)
2. [Updated System Overview](#2-updated-system-overview)
3. [Updated Folder Structure](#3-updated-folder-structure)
4. [Complete MongoDB Schema (v2)](#4-complete-mongodb-schema-v2)
5. [Complete API Design (v2)](#5-complete-api-design-v2)
6. [AI Pipeline (Gemini 2.5 Flash → Claude in Production)](#6-ai-pipeline)
7. [WhatsApp ↔ Web Account Sync](#7-whatsapp--web-account-sync)
8. [Multi-Persona & Subscription System](#8-multi-persona--subscription-system)
9. [Theme, Language & UI Architecture](#9-theme-language--ui-architecture)
10. [Real-Time APIs: eCourts & Indian Kanoon](#10-real-time-apis-ecourts--indian-kanoon)
11. [Payment Architecture (Razorpay Free → Paid)](#11-payment-architecture)
12. [Environment Variables (Full)](#12-environment-variables)

---

## 1. Architecture Decisions & Free-Tier Strategy

### AI Engine: Gemini 2.5 Flash (Dev) → Claude Sonnet (Production)
- **Claude API has NO free tier.** New accounts get a tiny starter credit only.
- **Gemini 2.5 Flash via Google AI Studio** has a genuine recurring free tier: 15 RPM, ~500–1,500 RPD depending on region/account. Sufficient for development.
- **Strategy:** Build an `AIProvider` abstraction layer. In dev, use `gemini-2.5-flash`. In production, swap to `claude-sonnet-4-20250514` by changing one env variable. No code changes needed.

### PDF Storage: Cloudinary Free (Dev) → AWS S3 (Production)
- Cloudinary free tier: 25 GB storage, 25 GB bandwidth/month — enough for dev/staging.

### Queue/Cache: Upstash Redis Free (Dev) → Upstash Redis paid or Redis Cloud (Production)
- Upstash free: 10,000 commands/day, 256MB — sufficient for dev.

### OTP: Twilio Free Trial (Dev) → MSG91 (Production)
- Twilio free trial gives $15.50 credit. MSG91 is cheapest for Indian numbers in production.

### WhatsApp: Twilio Sandbox (Dev) → Twilio Business/Meta Cloud API (Production)
- Twilio WhatsApp Sandbox is free for dev/testing.

### Voice Transcription: Whisper via Hugging Face Inference API Free (Dev) → OpenAI Whisper (Production)
- HF Inference API has a free tier for whisper-large-v3.

### Deployment (Dev): All free
- Frontend: Vercel free tier
- Backend: Render free tier (or Railway $5 free credits)
- MongoDB: Atlas M0 free cluster (512MB)

---

## 2. Updated System Overview

```
Stack:
  Frontend  → React (Vite) + MUI v6 + Redux Toolkit + Framer Motion
  Backend   → Node.js + Express + MongoDB (Mongoose)
  Worker    → Bull.js + Redis (Upstash)
  AI Engine → Gemini 2.5 Flash (dev) / Claude Sonnet 4 (prod) — abstracted
  Payments  → Razorpay (test keys in dev, live in prod)
  WhatsApp  → Twilio Sandbox (dev) / Meta Cloud API (prod)
  Storage   → Cloudinary (dev) / AWS S3 (prod)
  OTP       → Twilio (dev) / MSG91 (prod)
  Voice     → HuggingFace Whisper (dev) / OpenAI Whisper (prod)
  Real Laws → Indian Kanoon API (free, scraped) + eCourts NJDG (free public API)

Personas:
  - citizen      (normal user / applicant)
  - lawyer       (verified advocate)
  - paralegal    (assistant to lawyer)
  - admin        (platform admin)

Subscription Tiers per Persona:
  citizen:   free | basic | pro
  lawyer:    free | professional | firm
  admin:     internal only
```

---

## 3. Updated Folder Structure

```
nyayasetu/
├── client/                              # React PWA (Vite + MUI + Redux)
│   ├── public/
│   │   ├── manifest.json
│   │   ├── locales/                     # i18next translation files
│   │   │   ├── en/translation.json
│   │   │   ├── hi/translation.json
│   │   │   ├── bn/translation.json
│   │   │   ├── mr/translation.json
│   │   │   ├── ta/translation.json
│   │   │   └── te/translation.json
│   ├── src/
│   │   ├── theme/
│   │   │   ├── ThemeProvider.jsx        # MUI dynamic theme + user preference
│   │   │   ├── themes/
│   │   │   │   ├── default.js           # Blue/white justice theme
│   │   │   │   ├── saffron.js           # Saffron/tricolor (India-inspired)
│   │   │   │   ├── dark.js              # Dark mode
│   │   │   │   ├── highContrast.js      # Accessibility theme
│   │   │   │   └── emerald.js           # Green calm theme
│   │   │   └── tokens.js               # Shared design tokens (spacing, radius, etc.)
│   │   ├── i18n/
│   │   │   └── i18n.js                 # i18next config
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── AnimatedPage.jsx     # Framer Motion page transition wrapper
│   │   │   │   ├── GlassCard.jsx        # Glassmorphism card
│   │   │   │   ├── StatusBadge.jsx
│   │   │   │   ├── FeatureGate.jsx      # Show/hide based on subscription tier
│   │   │   │   ├── PlanBadge.jsx        # "PRO", "FREE" badge
│   │   │   │   └── UpgradeCTA.jsx       # Upgrade prompt component
│   │   │   ├── chat/
│   │   │   │   ├── ChatWindow.jsx       # Main chat container
│   │   │   │   ├── MessageBubble.jsx    # Animated message bubble
│   │   │   │   ├── TypingIndicator.jsx  # Animated dots
│   │   │   │   ├── VoiceInput.jsx       # Hold-to-record button
│   │   │   │   └── ProgressBar.jsx      # % questions answered
│   │   │   ├── document/
│   │   │   │   ├── DocumentViewer.jsx   # Render document with clause highlights
│   │   │   │   ├── DocumentCard.jsx     # Card in "My Documents" list
│   │   │   │   ├── ClauseExplainer.jsx  # Tap clause → plain language popup
│   │   │   │   └── NextStepsPanel.jsx   # Accordion of action steps
│   │   │   ├── case/
│   │   │   │   ├── CaseCard.jsx
│   │   │   │   ├── HearingTimeline.jsx  # Visual vertical timeline
│   │   │   │   └── CNRInput.jsx         # CNR number input with validation
│   │   │   ├── lawyer/
│   │   │   │   ├── LawyerCard.jsx
│   │   │   │   ├── LawyerSearch.jsx
│   │   │   │   ├── ConsultationBooking.jsx
│   │   │   │   └── LawyerDashboard.jsx  # Lawyer-specific dashboard
│   │   │   ├── pricing/
│   │   │   │   ├── PricingTable.jsx     # Animated comparison table
│   │   │   │   └── FeatureList.jsx      # Tick/cross feature grid per tier
│   │   │   ├── whatsapp/
│   │   │   │   └── WhatsAppConnectBanner.jsx
│   │   │   └── layout/
│   │   │       ├── Navbar.jsx           # Persona-aware top nav
│   │   │       ├── Sidebar.jsx          # Role-based sidebar
│   │   │       ├── BottomNav.jsx        # Mobile bottom navigation
│   │   │       └── ThemeSwitcher.jsx    # Floating theme palette widget
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx            # Phone OTP login
│   │   │   │   ├── Register.jsx         # Profile completion
│   │   │   │   └── WhatsAppEntry.jsx    # Deep link from WhatsApp
│   │   │   ├── citizen/
│   │   │   │   ├── Home.jsx             # Landing / dashboard
│   │   │   │   ├── NewDocument.jsx      # Template picker
│   │   │   │   ├── ChatFlow.jsx         # Conversational data collection
│   │   │   │   ├── DocumentPreview.jsx  # Review + download
│   │   │   │   ├── MyDocuments.jsx      # Document history
│   │   │   │   └── CaseDashboard.jsx    # CNR tracking
│   │   │   ├── lawyer/
│   │   │   │   ├── LawyerHome.jsx
│   │   │   │   ├── ClientList.jsx
│   │   │   │   ├── CaseManagement.jsx
│   │   │   │   ├── DocumentReview.jsx   # Review client-generated docs
│   │   │   │   └── EarningsPanel.jsx
│   │   │   ├── shared/
│   │   │   │   ├── Pricing.jsx          # Pricing page for all personas
│   │   │   │   ├── Settings.jsx         # Theme, language, notification prefs
│   │   │   │   ├── Profile.jsx
│   │   │   │   └── NotFound.jsx
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.jsx
│   │   │       ├── TemplateManager.jsx
│   │   │       └── UserManager.jsx
│   │   ├── store/                       # Redux Toolkit slices
│   │   │   ├── store.js                 # Root store config
│   │   │   ├── slices/
│   │   │   │   ├── authSlice.js
│   │   │   │   ├── chatSlice.js
│   │   │   │   ├── documentSlice.js
│   │   │   │   ├── caseSlice.js
│   │   │   │   ├── uiSlice.js           # theme, language, sidebar state
│   │   │   │   └── subscriptionSlice.js
│   │   │   └── middleware/
│   │   │       └── persistMiddleware.js # Persist theme/lang to localStorage
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useVoiceInput.js         # Web Speech API / HuggingFace
│   │   │   ├── useDocumentStream.js     # SSE streaming hook
│   │   │   ├── useFeatureAccess.js      # Check if user tier has feature
│   │   │   └── useCaseTracker.js
│   │   ├── services/
│   │   │   ├── api.js                   # Axios instance + auth interceptors
│   │   │   ├── razorpay.js              # Razorpay checkout handler
│   │   │   └── socket.js               # Socket.io for real-time lawyer chat
│   │   └── utils/
│   │       ├── featureFlags.js          # tier → features map
│   │       ├── jurisdictionUtils.js
│   │       └── dateUtils.js
│
├── server/                              # Node.js + Express REST API
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   ├── db.js
│   │   │   ├── redis.js
│   │   │   ├── cloudinary.js            # Dev storage
│   │   │   ├── s3.js                    # Prod storage
│   │   │   └── constants.js
│   │   ├── models/
│   │   │   ├── User.js                  # Unified user (all personas)
│   │   │   ├── LawyerProfile.js         # Extended profile for lawyers
│   │   │   ├── ParalegalProfile.js
│   │   │   ├── DocumentTemplate.js
│   │   │   ├── ChatSession.js
│   │   │   ├── Document.js
│   │   │   ├── CaseTracker.js
│   │   │   ├── JurisdictionRule.js
│   │   │   ├── LegalAct.js
│   │   │   ├── Subscription.js          # Subscription records
│   │   │   ├── Payment.js
│   │   │   ├── Consultation.js          # Lawyer-client consultations
│   │   │   ├── Notification.js
│   │   │   └── AuditLog.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── document.routes.js
│   │   │   ├── chat.routes.js
│   │   │   ├── case.routes.js
│   │   │   ├── lawyer.routes.js
│   │   │   ├── payment.routes.js
│   │   │   ├── subscription.routes.js
│   │   │   ├── whatsapp.routes.js       # Twilio webhook endpoint
│   │   │   ├── jurisdiction.routes.js
│   │   │   └── admin.routes.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── document.controller.js
│   │   │   ├── chat.controller.js
│   │   │   ├── case.controller.js
│   │   │   ├── lawyer.controller.js
│   │   │   ├── payment.controller.js
│   │   │   ├── subscription.controller.js
│   │   │   ├── whatsapp.controller.js
│   │   │   └── admin.controller.js
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── aiProvider.js         # ABSTRACTION LAYER — switches Gemini↔Claude
│   │   │   │   ├── geminiClient.js       # Gemini 2.5 Flash (dev)
│   │   │   │   ├── claudeClient.js       # Claude Sonnet (prod)
│   │   │   │   ├── documentEngine.js
│   │   │   │   ├── questionEngine.js
│   │   │   │   └── clauseExplainer.js
│   │   │   ├── ecourts/
│   │   │   │   ├── ecourtsClient.js      # NJDG REST API
│   │   │   │   └── caseParser.js
│   │   │   ├── indianKanoon/
│   │   │   │   ├── kanoonClient.js       # Indian Kanoon API
│   │   │   │   └── lawFetcher.js
│   │   │   ├── pdf/
│   │   │   │   ├── pdfGenerator.js       # PDFKit
│   │   │   │   └── templates/
│   │   │   ├── storage/
│   │   │   │   ├── storageProvider.js    # ABSTRACTION — Cloudinary dev / S3 prod
│   │   │   │   ├── cloudinaryService.js
│   │   │   │   └── s3Service.js
│   │   │   ├── notification/
│   │   │   │   ├── whatsappService.js    # Twilio WhatsApp
│   │   │   │   ├── emailService.js       # Nodemailer + Gmail SMTP (dev)
│   │   │   │   └── smsService.js
│   │   │   ├── payment/
│   │   │   │   └── razorpayService.js
│   │   │   └── voice/
│   │   │       ├── whisperProvider.js    # ABSTRACTION
│   │   │       ├── huggingfaceWhisper.js # Dev
│   │   │       └── openaiWhisper.js      # Prod
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js
│   │   │   ├── persona.middleware.js     # requirePersona('lawyer')
│   │   │   ├── subscription.middleware.js
│   │   │   ├── rateLimit.middleware.js
│   │   │   └── error.middleware.js
│   │   └── utils/
│   │       ├── logger.js
│   │       ├── asyncHandler.js
│   │       └── jurisdictionMapper.js
│
├── worker/
│   ├── src/
│   │   ├── worker.js
│   │   ├── queues/
│   │   │   ├── hearingAlertQueue.js
│   │   │   ├── documentQueue.js
│   │   │   ├── notificationQueue.js
│   │   │   └── subscriptionQueue.js     # Monthly reset + renewal
│   │   └── jobs/
│   │       ├── checkHearingDates.js
│   │       ├── sendHearingAlert.js
│   │       ├── generateDocument.js
│   │       ├── resetFreeQuota.js        # 1st of month: reset freeDocsUsed
│   │       └── syncWhatsAppState.js     # Re-sync WA user → web account
│
├── scripts/
│   ├── seedTemplates.js
│   ├── seedJurisdictions.js
│   └── seedLegalActs.js
│
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## 4. Complete MongoDB Schema (v2)

### 4.1 User (Unified — All Personas)

```js
// models/User.js
{
  _id: ObjectId,

  // Identity
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true, lowercase: true },
  name: String,
  avatar: String,  // Cloudinary/S3 URL

  // Persona
  persona: {
    type: String,
    enum: ['citizen', 'lawyer', 'paralegal', 'admin'],
    default: 'citizen'
  },

  // Location (drives jurisdiction)
  state: String,
  district: String,
  pincode: String,

  // Preferences
  preferredLanguage: {
    type: String,
    enum: ['en','hi','bn','mr','ta','te','gu','kn','ml','pa','ur'],
    default: 'en'
  },
  preferredTheme: {
    type: String,
    enum: ['default','saffron','dark','highContrast','emerald'],
    default: 'default'
  },

  // Subscription
  subscription: {
    plan: {
      type: String,
      enum: ['free','basic','pro','professional','firm'],
      default: 'free'
    },
    validUntil: Date,
    autoRenew: { type: Boolean, default: false },
    razorpaySubscriptionId: String
  },

  // Free tier usage counters
  freeUsage: {
    docsGenerated: { type: Number, default: 0 },
    docsLimit: { type: Number, default: 3 },       // 3 docs/month on free
    casesTracked: { type: Number, default: 0 },
    casesLimit: { type: Number, default: 1 },       // 1 case on free
    aiChatsUsed: { type: Number, default: 0 },
    aiChatsLimit: { type: Number, default: 5 },     // 5 AI chat sessions/month
    resetDate: Date                                 // 1st of next month
  },

  // WhatsApp
  whatsappOptIn: { type: Boolean, default: false },
  whatsappNumber: String,                          // +91XXXXXXXXXX
  whatsappVerified: { type: Boolean, default: false },
  whatsappSessionData: { type: Object, default: {} }, // WA conversation state

  // Auth
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  lastOtpSentAt: Date,
  refreshTokens: [String],                         // Array for multi-device

  // Metadata
  registrationSource: {
    type: String,
    enum: ['web', 'whatsapp', 'mobile_app'],
    default: 'web'
  },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastActive: Date
}

// Indexes
{ phone: 1 }
{ email: 1 }
{ 'subscription.plan': 1 }
{ state: 1, district: 1 }
{ whatsappNumber: 1 }
```

### 4.2 LawyerProfile

```js
// models/LawyerProfile.js
{
  _id: ObjectId,
  user: { type: ObjectId, ref: 'User', required: true, unique: true },

  // Bar Council
  barCouncilNumber: { type: String, unique: true },
  barCouncilState: String,
  enrollmentYear: Number,
  barCouncilVerified: { type: Boolean, default: false },
  barCouncilDoc: String,  // URL to uploaded certificate

  // Practice
  specialisations: [{
    type: String,
    enum: ['consumer','property','family','criminal','civil','labour','rti','tax','ip','corporate']
  }],
  practicingStates: [String],
  practicingDistricts: [String],
  primaryCourt: String,   // "Delhi High Court", "Bombay High Court"
  experience: Number,     // years
  languages: [String],
  bio: String,

  // Subscription (lawyer-specific)
  lawyerPlan: {
    type: String,
    enum: ['free','professional','firm'],
    default: 'free'
  },

  // Availability
  isAvailableForConsultation: { type: Boolean, default: false },
  consultationFee: Number,   // in paise (e.g. 50000 = ₹500)
  consultationModes: [{
    type: String,
    enum: ['chat','video','phone','in_person']
  }],

  // Ratings
  ratings: [{
    user: { type: ObjectId, ref: 'User' },
    score: { type: Number, min: 1, max: 5 },
    review: String,
    createdAt: Date
  }],
  averageRating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },

  // Revenue
  referralFeePercent: { type: Number, default: 10 },
  totalEarnings: { type: Number, default: 0 },

  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ user: 1 }
{ specialisations: 1, practicingStates: 1 }
{ barCouncilNumber: 1 }
{ averageRating: -1 }
{ lawyerPlan: 1, isAvailableForConsultation: 1 }
```

### 4.3 DocumentTemplate

```js
// models/DocumentTemplate.js
{
  _id: ObjectId,
  slug: { type: String, unique: true },
  name: String,
  nameHi: String, namebn: String, nameMr: String,

  category: {
    type: String,
    enum: ['consumer','property','employment','family','criminal','rti','civil','financial','startup','labour']
  },
  description: String,
  descriptionHi: String,
  estimatedTime: String,   // "8 minutes"
  complexity: { type: String, enum: ['simple','moderate','complex'], default: 'moderate' },

  primaryActs: [{ type: ObjectId, ref: 'LegalAct' }],

  questionFlow: [{
    id: String,
    question: String,
    questionHi: String,
    inputType: { type: String, enum: ['text','date','number','choice','address','phone','email','multiline'] },
    required: Boolean,
    options: [String],
    optionsHi: [String],
    dependsOn: { fieldId: String, value: String },
    validation: { regex: String, message: String },
    helpText: String
  }],

  systemPromptAddendum: String,

  availableStates: [String],   // empty = nationwide

  // Tiering: who can access this template
  requiredPlan: {
    citizen: { type: String, enum: ['free','basic','pro'], default: 'free' },
    lawyer: { type: String, enum: ['free','professional','firm'], default: 'free' }
  },
  pricePayPerDoc: Number,      // in paise — for citizens on pay-per-doc

  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },
  usageCount: { type: Number, default: 0 },
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ slug: 1 }
{ category: 1, isActive: 1 }
{ isFeatured: 1 }
```

### 4.4 ChatSession

```js
// models/ChatSession.js
{
  _id: ObjectId,
  user: { type: ObjectId, ref: 'User', required: true },
  template: { type: ObjectId, ref: 'DocumentTemplate', required: true },
  source: { type: String, enum: ['web', 'whatsapp', 'mobile'], default: 'web' },

  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'] },
    content: String,
    timestamp: { type: Date, default: Date.now },
    extractedField: String,
    extractedValue: mongoose.Schema.Types.Mixed
  }],

  collectedData: { type: Map, of: mongoose.Schema.Types.Mixed },

  status: {
    type: String,
    enum: ['active','data_complete','generating','completed','abandoned','paused'],
    default: 'active'
  },

  document: { type: ObjectId, ref: 'Document' },
  resolvedState: String,
  resolvedDistrict: String,
  language: { type: String, default: 'en' },
  progressPercent: { type: Number, default: 0 },

  // WhatsApp state continuation
  whatsappPhase: String,   // Used for multi-step WA flow state

  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
}

// Indexes
{ user: 1, createdAt: -1 }
{ status: 1 }
// TTL: abandon sessions older than 7 days with status 'active'
{ createdAt: 1 }, { expireAfterSeconds: 604800, partialFilterExpression: { status: 'active' } }
```

### 4.5 Document

```js
// models/Document.js
{
  _id: ObjectId,
  user: { type: ObjectId, ref: 'User', required: true },
  session: { type: ObjectId, ref: 'ChatSession' },
  template: { type: ObjectId, ref: 'DocumentTemplate' },
  reviewedByLawyer: { type: ObjectId, ref: 'User', default: null },  // Lawyer who reviewed

  title: String,
  content: String,           // Full document text (Markdown)
  contentHtml: String,

  legalCitations: [{
    act: String,
    section: String,
    description: String,
    url: String              // Indian Kanoon link to section
  }],

  clauseExplanations: [{
    clauseIndex: Number,
    clauseText: String,
    explanation: String,
    explanationHi: String
  }],

  nextSteps: [{
    step: Number,
    instruction: String,
    instructionHi: String,
    authority: String,
    fee: String,
    timelineExpected: String,
    onlineLink: String       // URL if filing can be done online
  }],

  pdfUrl: String,
  pdfGeneratedAt: Date,
  pdfSize: Number,           // bytes

  collectedData: { type: Map, of: mongoose.Schema.Types.Mixed },
  state: String,
  language: String,

  // Payment & access
  isPaid: { type: Boolean, default: false },
  accessType: {
    type: String,
    enum: ['free_tier','subscription','pay_per_doc','lawyer_generated'],
    default: 'free_tier'
  },
  payment: { type: ObjectId, ref: 'Payment' },

  // Versioning
  version: { type: Number, default: 1 },
  previousVersions: [{ content: String, pdfUrl: String, createdAt: Date }],

  // Sharing
  shareToken: { type: String, unique: true, sparse: true },  // For share-via-link
  isShared: { type: Boolean, default: false },

  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}

// Indexes
{ user: 1, createdAt: -1 }
{ template: 1 }
{ shareToken: 1 }
{ isDeleted: 1 }
```

### 4.6 CaseTracker

```js
// models/CaseTracker.js
{
  _id: ObjectId,
  user: { type: ObjectId, ref: 'User', required: true },
  sharedWithLawyer: { type: ObjectId, ref: 'User', default: null },

  cnrNumber: { type: String, required: true },
  caseTitle: String,
  caseType: String,
  petitioner: String,
  respondent: String,
  court: String,
  state: String,
  district: String,
  filingDate: Date,

  hearings: [{
    date: Date,
    purpose: String,
    result: String,
    nextDate: Date,
    judge: String,
    fetchedAt: Date
  }],

  nextHearingDate: Date,
  lastFetchedAt: Date,
  caseStatus: { type: String, enum: ['active','disposed','transferred'], default: 'active' },

  alertDaysBefore: { type: Number, default: 1 },
  alertChannels: {
    whatsapp: { type: Boolean, default: true },
    email: { type: Boolean, default: false }
  },
  alertsSent: [{
    hearingDate: Date,
    channel: String,
    sentAt: Date
  }],

  // Documents linked to this case
  linkedDocuments: [{ type: ObjectId, ref: 'Document' }],

  isActive: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}

// Indexes
{ user: 1 }
{ cnrNumber: 1 }
{ nextHearingDate: 1, isActive: 1 }
```

### 4.7 Subscription

```js
// models/Subscription.js
{
  _id: ObjectId,
  user: { type: ObjectId, ref: 'User', required: true },
  plan: {
    type: String,
    enum: ['basic','pro','professional','firm'],
    required: true
  },
  persona: { type: String, enum: ['citizen','lawyer','paralegal'] },
  billingCycle: { type: String, enum: ['monthly','annual'] },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  autoRenew: { type: Boolean, default: true },

  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySubscriptionId: String,

  amount: Number,          // in paise
  currency: { type: String, default: 'INR' },
  discount: Number,        // paise

  cancelledAt: Date,
  cancelReason: String,

  createdAt: { type: Date, default: Date.now }
}

// Indexes
{ user: 1, isActive: 1 }
{ endDate: 1 }
```

### 4.8 Payment

```js
// models/Payment.js
{
  _id: ObjectId,
  user: { type: ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['pay_per_doc','subscription','consultation'] },

  // References
  document: { type: ObjectId, ref: 'Document' },
  subscription: { type: ObjectId, ref: 'Subscription' },
  consultation: { type: ObjectId, ref: 'Consultation' },

  // Razorpay
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,

  amount: Number,
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['created','paid','failed','refunded'], default: 'created' },
  description: String,

  // Lawyer commission (if applicable)
  lawyerEarnings: Number,
  platformEarnings: Number,

  createdAt: { type: Date, default: Date.now },
  paidAt: Date
}
```

### 4.9 Consultation

```js
// models/Consultation.js
{
  _id: ObjectId,
  citizen: { type: ObjectId, ref: 'User', required: true },
  lawyer: { type: ObjectId, ref: 'User', required: true },
  document: { type: ObjectId, ref: 'Document' },  // Optional: doc being reviewed

  mode: { type: String, enum: ['chat','video','phone','in_person'] },
  scheduledAt: Date,
  duration: Number,   // minutes
  status: {
    type: String,
    enum: ['requested','accepted','rejected','completed','cancelled'],
    default: 'requested'
  },

  notes: String,         // Lawyer's notes
  citizenNotes: String,
  rating: { type: Number, min: 1, max: 5 },
  review: String,

  fee: Number,           // in paise
  payment: { type: ObjectId, ref: 'Payment' },

  createdAt: Date,
  updatedAt: Date
}
```

### 4.10 JurisdictionRule & LegalAct
*(Same as v1 — no changes needed)*

### 4.11 Notification

```js
// models/Notification.js
{
  _id: ObjectId,
  user: { type: ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'hearing_reminder', 'doc_ready', 'payment_success',
      'lawyer_accepted', 'consultation_reminder', 'subscription_expiring',
      'free_quota_warning', 'system'
    ]
  },
  title: String,
  body: String,
  data: { type: Object },        // Extra data (caseId, docId, etc.)
  isRead: { type: Boolean, default: false },
  channel: { type: String, enum: ['web','whatsapp','email','sms'] },
  createdAt: { type: Date, default: Date.now }
}

// Indexes
{ user: 1, isRead: 1 }
{ createdAt: 1 }  // TTL: delete notifications older than 90 days
```

---

## 5. Complete API Design (v2)

**Base URL:** `https://api.nyayasetu.in/v1` (prod) | `http://localhost:5000/v1` (dev)
**Auth:** JWT Bearer token in `Authorization: Bearer <token>`
**Rate limits:** General: 100 req/15min | AI: 10 req/min | OTP: 3 req/15min

---

### AUTH

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/send-otp` | Public | Send OTP via SMS |
| POST | `/auth/verify-otp` | Public | Verify OTP → JWT |
| POST | `/auth/register` | Auth | Complete profile (name, state, persona) |
| GET | `/auth/me` | Auth | Get full current user |
| PATCH | `/auth/me` | Auth | Update profile / preferences |
| POST | `/auth/refresh` | Public | Refresh JWT |
| POST | `/auth/logout` | Auth | Invalidate refresh token |
| POST | `/auth/whatsapp-entry` | Public | Deep link from WhatsApp → create/link account |

---

### TEMPLATES

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/templates` | Auth | List templates (filter: category, state, plan) |
| GET | `/templates/categories` | Auth | Categories with doc counts |
| GET | `/templates/featured` | Auth | Featured templates |
| GET | `/templates/:slug` | Auth | Template detail + question flow |

---

### CHAT

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/chat/sessions` | Auth | Start new session |
| POST | `/chat/sessions/:id/message` | Auth | Send message → SSE stream response |
| GET | `/chat/sessions/:id` | Auth | Get session state |
| GET | `/chat/sessions` | Auth | List user's sessions |
| POST | `/chat/sessions/:id/voice` | Auth | Upload audio → transcription |
| POST | `/chat/sessions/:id/abandon` | Auth | Mark session abandoned |

---

### DOCUMENTS

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/documents/generate` | Auth | Trigger async generation |
| GET | `/documents` | Auth | List user's documents |
| GET | `/documents/:id` | Auth | Document detail |
| GET | `/documents/:id/pdf` | Auth | Get PDF download URL |
| POST | `/documents/:id/explain-clause` | Auth | AI explain clause (SSE) |
| POST | `/documents/:id/regenerate` | Auth | Regenerate with edits |
| POST | `/documents/:id/share` | Auth | Generate share token |
| GET | `/documents/shared/:shareToken` | Public | View shared document |
| PATCH | `/documents/:id/link-case` | Auth | Link document to a case |
| DELETE | `/documents/:id` | Auth | Soft delete |

---

### CASE TRACKER

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/cases` | Auth | Add case by CNR |
| GET | `/cases` | Auth | List tracked cases |
| GET | `/cases/:id` | Auth | Case detail + hearings |
| POST | `/cases/:id/refresh` | Auth | Manual eCourts sync |
| PATCH | `/cases/:id/alerts` | Auth | Update alert prefs |
| POST | `/cases/:id/share-lawyer` | Auth | Share case with lawyer |
| DELETE | `/cases/:id` | Auth | Stop tracking |

---

### LAWYERS

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/lawyers` | Auth | Search lawyers |
| GET | `/lawyers/:id` | Auth | Lawyer profile |
| POST | `/lawyers/apply` | Auth(lawyer) | Submit lawyer application |
| PUT | `/lawyers/profile` | Auth(lawyer) | Update own profile |
| GET | `/lawyers/me/clients` | Auth(lawyer) | Lawyer's clients list |
| GET | `/lawyers/me/cases` | Auth(lawyer) | Lawyer's assigned cases |
| POST | `/consultations` | Auth | Book consultation |
| GET | `/consultations` | Auth | List consultations |
| PATCH | `/consultations/:id/accept` | Auth(lawyer) | Accept consultation |
| PATCH | `/consultations/:id/complete` | Auth(lawyer) | Mark complete |

---

### PAYMENTS & SUBSCRIPTIONS

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/payments/create-order` | Auth | Create pay-per-doc order |
| POST | `/payments/verify` | Auth | Verify + unlock |
| GET | `/payments/history` | Auth | Payment history |
| POST | `/subscriptions/create` | Auth | Create subscription order |
| POST | `/subscriptions/verify` | Auth | Activate subscription |
| GET | `/subscriptions/current` | Auth | Active subscription info |
| POST | `/subscriptions/cancel` | Auth | Cancel subscription |
| POST | `/payments/webhook` | Public | Razorpay webhook (HMAC verified) |

---

### WHATSAPP WEBHOOK

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/whatsapp/webhook` | Twilio-signed | Incoming WA message handler |
| GET | `/whatsapp/webhook` | Twilio-signed | Twilio verification challenge |

---

### JURISDICTION & LAWS

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/jurisdiction/states` | Public | List supported states |
| GET | `/jurisdiction/:state/:docType` | Auth | Rules for state + doc type |
| GET | `/acts` | Auth | List legal acts |
| GET | `/acts/:id/sections` | Auth | Sections of an act |
| GET | `/laws/search` | Auth | Search Indian Kanoon (proxy) |

---

### NOTIFICATIONS

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/notifications` | Auth | User notifications |
| PATCH | `/notifications/:id/read` | Auth | Mark read |
| POST | `/notifications/read-all` | Auth | Mark all read |

---

### ADMIN

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/admin/users` | Admin | List users with filters |
| GET | `/admin/stats` | Admin | Platform stats |
| POST | `/admin/lawyers/:id/verify` | Admin | Verify lawyer |
| POST | `/admin/templates` | Admin | Create template |
| PUT | `/admin/templates/:id` | Admin | Update template |

---

## 6. AI Pipeline

### 6.1 AIProvider Abstraction

```js
// services/ai/aiProvider.js
// Set AI_PROVIDER=gemini in dev, AI_PROVIDER=claude in prod

const provider = process.env.AI_PROVIDER || 'gemini';

let client;
if (provider === 'claude') {
  client = require('./claudeClient');
} else {
  client = require('./geminiClient');
}

module.exports = {
  chat: client.chat,       // (messages, systemPrompt, stream) => response
  generate: client.generate // (prompt) => JSON response
};
```

### 6.2 Gemini Client (Dev)

```js
// services/ai/geminiClient.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

async function chat(messages, systemPrompt, stream = false) {
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const lastMsg = messages[messages.length - 1].content;
  const chat = model.startChat({
    history,
    systemInstruction: systemPrompt
  });
  if (stream) {
    return chat.sendMessageStream(lastMsg);
  }
  const result = await chat.sendMessage(lastMsg);
  return result.response.text();
}

async function generate(prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { chat, generate };
```

### 6.3 Claude Client (Prod)

```js
// services/ai/claudeClient.js
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function chat(messages, systemPrompt, stream = false) {
  const params = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content }))
  };
  if (stream) {
    return anthropic.messages.stream(params);
  }
  const response = await anthropic.messages.create(params);
  return response.content[0].text;
}

async function generate(prompt) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content[0].text;
}

module.exports = { chat, generate };
```

---

## 7. WhatsApp ↔ Web Account Sync

### Flow

```
User sends WhatsApp message to NyayaSetu number
→ Twilio webhook hits POST /whatsapp/webhook
→ whatsapp.controller.js extracts phone number
→ Look up User by whatsappNumber
  → If found: load session, continue flow
  → If not found: create User(registrationSource: 'whatsapp', whatsappNumber: phone)
→ WhatsApp conversation managed via state machine (whatsappPhase in ChatSession)
→ All documents/cases created via WhatsApp are stored in same MongoDB as web
→ User can log in on web with same phone number → sees all their docs
```

### WhatsApp State Machine

```
Phases:
  WELCOME          → Send greeting, ask language preference
  SELECT_TEMPLATE  → Show numbered list of document types
  CHAT_FLOW        → Mirror the web chat flow via text messages
  REVIEW           → Send document summary, ask to download
  DOWNLOAD         → Send PDF link via WhatsApp media message
  CASE_TRACK_MENU  → List options: Add case / View cases / Back
  CNR_INPUT        → Ask for CNR, validate, fetch from eCourts
```

### Key Implementation

```js
// whatsapp.controller.js
const handleIncoming = async (req, res) => {
  const { From, Body, MediaUrl0 } = req.body;
  const phone = From.replace('whatsapp:', '');

  let user = await User.findOne({ whatsappNumber: phone });
  if (!user) {
    user = await User.create({
      whatsappNumber: phone,
      whatsappOptIn: true,
      whatsappVerified: true,
      registrationSource: 'whatsapp',
      phone: phone
    });
  }

  const session = await getOrCreateWhatsAppSession(user._id);
  const response = await processWhatsAppMessage(user, session, Body.trim());

  // Reply via Twilio
  const twiml = new MessagingResponse();
  twiml.message(response);
  res.type('text/xml').send(twiml.toString());
};
```

---

## 8. Multi-Persona & Subscription System

### Personas and Plans

#### CITIZEN Plans

| Feature | Free | Basic (₹99/mo) | Pro (₹199/mo) |
|---------|------|-----------------|----------------|
| Documents/month | 3 | 15 | Unlimited |
| Document types | 5 basic | All basic+standard | All including premium |
| Case tracking | 1 case | 5 cases | Unlimited |
| AI chat sessions | 5 | 30 | Unlimited |
| PDF download | ✗ (preview only) | ✓ | ✓ |
| Voice input | ✗ | ✓ | ✓ |
| Clause explainer | ✗ | ✓ | ✓ |
| Document sharing | ✗ | ✓ | ✓ |
| Hearing alerts | ✗ | WhatsApp only | WhatsApp + Email |
| Lawyer connection | ✗ | View profiles | Book consultation |
| Priority support | ✗ | ✗ | ✓ |

#### LAWYER Plans

| Feature | Free | Professional (₹499/mo) | Firm (₹1499/mo) |
|---------|------|------------------------|-----------------|
| Client docs reviewable | 0 | 20/month | Unlimited |
| Case management | ✗ | ✓ | ✓ |
| Client portal access | ✗ | ✓ | ✓ |
| Verified badge | ✗ | ✓ | ✓ Gold |
| Consultation bookings | ✗ | ✓ | ✓ Priority |
| Revenue share | ✗ | 90% | 92% |
| Team members | 0 | 0 | 5 paralegals |
| Analytics | ✗ | Basic | Advanced |
| Custom branding | ✗ | ✗ | ✓ |

### Feature Gate Component (Frontend)

```jsx
// components/ui/FeatureGate.jsx
import { useSelector } from 'react-redux';
import { FEATURE_MAP } from '../../utils/featureFlags';

const FeatureGate = ({ feature, fallback = null, children }) => {
  const { user } = useSelector(s => s.auth);
  const plan = user?.subscription?.plan || 'free';
  const persona = user?.persona || 'citizen';

  const allowed = FEATURE_MAP[persona]?.[plan]?.includes(feature);
  if (allowed) return children;
  return fallback || <UpgradeCTA feature={feature} currentPlan={plan} persona={persona} />;
};
```

---

## 9. Theme, Language & UI Architecture

### Theme System (MUI)

All colours live EXCLUSIVELY in theme files. Zero hardcoded hex values anywhere in components.

```js
// theme/themes/default.js
export const defaultTheme = {
  palette: {
    primary: { main: 'var(--color-primary)', contrastText: 'var(--color-on-primary)' },
    secondary: { main: 'var(--color-secondary)' },
    background: { default: 'var(--color-bg)', paper: 'var(--color-surface)' },
    text: { primary: 'var(--color-text)', secondary: 'var(--color-text-secondary)' }
  },
  // CSS vars set on :root based on selected theme
};

// 5 themes: default, saffron, dark, highContrast, emerald
// Each exports a palette + sets CSS custom properties
```

```js
// theme/ThemeProvider.jsx
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { setTheme } from '../store/slices/uiSlice';

const NyayaThemeProvider = ({ children }) => {
  const { theme: themeName } = useSelector(s => s.ui);
  const themeConfig = THEMES[themeName] || THEMES.default;
  const muiTheme = createTheme(themeConfig);
  return <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>;
};
```

### Language System (i18next)

```js
// i18n/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en','hi','bn','mr','ta','te'],
    backend: { loadPath: '/locales/{{lng}}/translation.json' },
    interpolation: { escapeValue: false }
  });
```

All static UI strings use `useTranslation()` hook:
```jsx
const { t, i18n } = useTranslation();
<Button>{t('document.generate')}</Button>
// On language change: i18n.changeLanguage('hi')
```

### Animations (Framer Motion)
- Page transitions: `AnimatedPage` wrapper with `opacity` + `y` slide
- List items: `staggerChildren` in parent `motion.div`
- Message bubbles: scale + fade on appear
- Theme switch: Circular reveal animation from ThemeSwitcher button position
- Document generation: Progress pulse animation
- Stat counters: `useMotionValue` + `useSpring` for number animation

---

## 10. Real-Time APIs: eCourts & Indian Kanoon

### eCourts / NJDG API (Free Public API)

```
Base URL: https://services.ecourts.gov.in/ecourtindiaHC/
NJDG REST: https://njdg.ecourts.gov.in/njdgnew/index.php
Case status API (CNR lookup): https://services.ecourts.gov.in/ecourtindiaHC/cases/case_no
```

The eCourts API is the **National Judicial Data Grid (NJDG)** system. It is publicly accessible but undocumented. Key endpoints:
- Case status by CNR number
- Hearing history
- Next hearing date

```js
// services/ecourts/ecourtsClient.js
const axios = require('axios');

const ECOURTS_BASE = process.env.ECOURTS_API_BASE || 'https://services.ecourts.gov.in';

async function getCaseStatus(cnrNumber) {
  try {
    // CNR-based lookup — format: STATECOURT00CASENO/YEAR
    const res = await axios.get(
      `${ECOURTS_BASE}/ecourtindiaHC/cases/case_no`,
      {
        params: { cnr_no: cnrNumber },
        headers: {
          'User-Agent': 'NyayaSetu/1.0 (legal access tool)',
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );
    return parseCaseData(res.data);
  } catch (err) {
    // Fallback: scrape NJDG web interface
    return await scrapeNJDG(cnrNumber);
  }
}
```

**Note for dev:** eCourts sometimes blocks bots. Use a rotating proxy in production. In dev, use mock data for testing. The NJDG portal at https://njdg.ecourts.gov.in is the authoritative source.

### Indian Kanoon API (Free)

Indian Kanoon provides a free API for searching and fetching Indian legal documents, judgments, and act sections.

```
Base URL: https://api.indiankanoon.org
Auth: API key (register free at https://api.indiankanoon.org)
Endpoints:
  GET /search/?formInput={query}&pagenum=0  → Search judgments/laws
  GET /doc/{docid}/                          → Full document text
```

```js
// services/indianKanoon/kanoonClient.js
const axios = require('axios');
const KANOON_BASE = 'https://api.indiankanoon.org';
const KANOON_KEY = process.env.INDIANKANOON_API_KEY;

async function searchLaw(query, pagenum = 0) {
  const res = await axios.post(
    `${KANOON_BASE}/search/`,
    { formInput: query, pagenum },
    { headers: { Authorization: `Token ${KANOON_KEY}` } }
  );
  return res.data;
}

async function getDocument(docId) {
  const res = await axios.get(
    `${KANOON_BASE}/doc/${docId}/`,
    { headers: { Authorization: `Token ${KANOON_KEY}` } }
  );
  return res.data;
}

// Used to populate LegalAct sections and provide live law search
module.exports = { searchLaw, getDocument };
```

---

## 11. Payment Architecture

### Plans & Prices (INR)

```
Citizen Basic:  ₹99/month  | ₹999/year
Citizen Pro:    ₹199/month | ₹1,999/year
Lawyer Professional: ₹499/month | ₹4,999/year
Lawyer Firm:   ₹1,499/month | ₹14,999/year

Pay-per-doc pricing:
  Simple documents: ₹49
  Standard documents: ₹99
  Complex/premium documents: ₹199
```

### Razorpay Integration (Test Keys in Dev)

```js
// server: services/payment/razorpayService.js
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,      // rzp_test_... in dev
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function createOrder(amount, currency = 'INR', receipt) {
  return await razorpay.orders.create({ amount, currency, receipt });
}

async function verifyPayment(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body).digest('hex');
  return expected === signature;
}
```

---

## 12. Environment Variables (Full)

```bash
# ==================== CORE ====================
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
AI_PROVIDER=gemini              # 'gemini' in dev, 'claude' in prod

# ==================== DATABASE ====================
MONGO_URI=mongodb+srv://...     # Atlas M0 free in dev

# ==================== CACHE/QUEUE ====================
REDIS_URL=redis://...           # Upstash free in dev

# ==================== JWT ====================
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=another-secret-key
JWT_REFRESH_EXPIRES_IN=30d

# ==================== AI ====================
# Dev (Gemini — free tier)
GEMINI_API_KEY=AIza...          # From Google AI Studio (FREE)

# Prod (Claude — paid)
ANTHROPIC_API_KEY=sk-ant-...    # Only set in production

# ==================== VOICE ====================
# Dev (HuggingFace — free tier)
HF_API_KEY=hf_...               # From huggingface.co (FREE)
HF_WHISPER_MODEL=openai/whisper-large-v3

# Prod (OpenAI Whisper)
OPENAI_API_KEY=sk-...           # Only set in production

# ==================== WHATSAPP / OTP ====================
# Dev (Twilio — free trial)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886  # Twilio sandbox number
TWILIO_SMS_FROM=+15005550006                # Twilio test number

# Prod (MSG91 for OTP)
MSG91_AUTH_KEY=...
MSG91_TEMPLATE_ID=...

# ==================== STORAGE ====================
# Dev (Cloudinary — free tier)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
STORAGE_PROVIDER=cloudinary     # 'cloudinary' in dev, 's3' in prod

# Prod (AWS S3)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
AWS_S3_BUCKET=nyayasetu-documents

# ==================== PAYMENTS ====================
RAZORPAY_KEY_ID=rzp_test_...    # Test keys in dev
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# ==================== EXTERNAL APIs ====================
ECOURTS_API_BASE=https://services.ecourts.gov.in
INDIANKANOON_API_KEY=...        # Register free at api.indiankanoon.org

# ==================== EMAIL ====================
# Dev (Gmail SMTP — free)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=nyayasetu.dev@gmail.com
EMAIL_PASS=app-specific-password
EMAIL_FROM="NyayaSetu <noreply@nyayasetu.in>"

# ==================== SECURITY ====================
FIELD_ENCRYPTION_KEY=32-char-hex-key
SESSION_SECRET=...

# ==================== FEATURE FLAGS ====================
ENABLE_LAWYER_PORTAL=true
ENABLE_VOICE_INPUT=true
ENABLE_WHATSAPP=true
```

---

## BONUS: New Features Added (Not in Original Architecture)

Beyond the base architecture, the following features have been **added or improved**:

| Feature | Details |
|---------|---------|
| **Document Sharing** | Share document via unique link token (public view, no PDF) |
| **Lawyer Reviews from Consultation** | Rating collected after consultation, not just referral |
| **Multi-device JWT** | RefreshToken array supports up to 5 devices |
| **Paralegal Persona** | Third persona (assistant to lawyer) — profile stub ready |
| **WhatsApp Account Creation** | Full account creation + document creation via WhatsApp |
| **eCourts Auto-refresh** | Bull job automatically refreshes case data daily |
| **Indian Kanoon Integration** | Live law search + citation URLs in generated documents |
| **Document Versioning** | User can regenerate, old versions stored |
| **Free Social Templates** | Domestic violence + police complaint always free (₹0) |
| **Audit Log** | Every sensitive action logged to AuditLog collection |
| **Notification Center** | In-app notification system with WhatsApp + email + web channels |
| **Theme Switcher** | 5 themes, animated transition, persisted to DB + localStorage |
| **11 Languages** | Support for en, hi, bn, mr, ta, te, gu, kn, ml, pa, ur |
| **PWA Support** | Installable PWA with service worker + offline caching |
| **High Contrast Theme** | Accessibility-first theme for visually impaired users |
| **CNR Format Validator** | Client-side + server-side CNR format validation |
| **Admin Dashboard** | Template management, lawyer verification, platform stats |

---

*NyayaSetu Architecture v2.0 | Free-first, production-ready | Generated for code scaffolding*

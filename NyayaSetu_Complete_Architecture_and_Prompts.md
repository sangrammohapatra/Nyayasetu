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
13. [Step-by-Step Code Generation Prompts (Claude Free)](#13-step-by-step-code-generation-prompts)

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

## 13. Step-by-Step Code Generation Prompts

> **Instructions:** Copy each prompt EXACTLY into a new Claude conversation. Each prompt builds on the previous. After each prompt, copy the generated code into your project before moving to the next. The prompts are sized for Claude's free tier (short context, one concern at a time).

---

### PROMPT 1 — Project Scaffolding & Environment

```
You are an expert MERN stack developer. Create the complete project scaffolding for NyayaSetu — an Indian legal tech platform.

TASK: Set up the monorepo structure with root package.json, then create client/ (React+Vite) and server/ (Node.js+Express) with all dependencies installed.

PROJECT CONTEXT:
- NyayaSetu helps Indian citizens create legal documents via AI chat
- Stack: MongoDB, Express, React (MUI v6 + Redux Toolkit + Framer Motion), Node.js
- Dev AI: Gemini 2.5 Flash (free). Prod AI: Claude (paid). Abstracted via env var.

OUTPUT 1: Root package.json with workspaces config:
{
  "name": "nyayasetu",
  "private": true,
  "workspaces": ["client", "server", "worker"],
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "npm run dev --workspace=server",
    "dev:client": "npm run dev --workspace=client"
  }
}

OUTPUT 2: server/package.json with these exact dependencies:
express, mongoose, cors, helmet, morgan, dotenv, jsonwebtoken, bcryptjs,
express-rate-limit, multer, bull, ioredis, axios, nodemailer,
@google/generative-ai, @anthropic-ai/sdk, twilio, razorpay,
cloudinary, pdfkit, mongoose-field-encryption, winston, socket.io,
crypto-js, uuid, date-fns
devDependencies: nodemon, jest

OUTPUT 3: client/package.json with these exact dependencies:
react, react-dom, react-router-dom, @reduxjs/toolkit, react-redux,
@mui/material, @mui/icons-material, @emotion/react, @emotion/styled,
framer-motion, axios, i18next, react-i18next, i18next-browser-languagedetector,
i18next-http-backend, react-hook-form, @hookform/resolvers, yup,
socket.io-client, date-fns, react-toastify
devDependencies: vite, @vitejs/plugin-react

OUTPUT 4: server/src/app.js — Express app with:
- helmet() security headers
- cors({ origin: process.env.CLIENT_URL, credentials: true })
- express.json({ limit: '10mb' })
- morgan('dev') logging
- rate limiter (100 req / 15min)
- Mount all route files (auth, document, chat, case, lawyer, payment, subscription, whatsapp, jurisdiction, notification, admin)
- Global error handler middleware at bottom
- Health check: GET /health → { status: 'ok', timestamp }

OUTPUT 5: server/src/server.js — Entry point that:
- Loads dotenv
- Connects to MongoDB (db.js)
- Connects to Redis (redis.js)
- Starts Express server on PORT
- Graceful shutdown on SIGTERM

OUTPUT 6: server/src/config/db.js — Mongoose connection with:
- Retry logic (3 attempts, 5s delay)
- Connection events (connected, error, disconnected)
- useNewUrlParser, useUnifiedTopology options

OUTPUT 7: server/src/config/redis.js — ioredis client:
- Connect to REDIS_URL
- Handle connection errors gracefully
- Export client

OUTPUT 8: server/.env.example with all variables from the architecture doc
OUTPUT 9: client/vite.config.js with proxy: { '/v1': 'http://localhost:5000' }
OUTPUT 10: client/src/main.jsx — React entry with Provider, BrowserRouter, ThemeProvider, I18nextProvider

Generate ALL files completely with full code. No placeholders, no "// add later" comments.
```

---

### PROMPT 2 — All MongoDB Schemas

```
You are an expert MongoDB/Mongoose developer building NyayaSetu, an Indian legal tech platform.

TASK: Create ALL 13 Mongoose model files in server/src/models/. Each must be production-ready with proper validation, indexes, and timestamps.

Create these files with complete schemas:

1. User.js:
Fields: _id, phone(unique sparse), email(unique sparse lowercase), name, avatar, 
persona(enum: citizen/lawyer/paralegal/admin, default: citizen),
state, district, pincode,
preferredLanguage(enum: en/hi/bn/mr/ta/te/gu/kn/ml/pa/ur, default: en),
preferredTheme(enum: default/saffron/dark/highContrast/emerald, default: default),
subscription: { plan(enum: free/basic/pro/professional/firm, default: free), validUntil, autoRenew, razorpaySubscriptionId },
freeUsage: { docsGenerated(0), docsLimit(3), casesTracked(0), casesLimit(1), aiChatsUsed(0), aiChatsLimit(5), resetDate },
whatsappOptIn(false), whatsappNumber, whatsappVerified(false), whatsappSessionData(Object),
isEmailVerified(false), isPhoneVerified(false), lastOtpSentAt, refreshTokens([String]),
registrationSource(enum: web/whatsapp/mobile_app, default: web),
isActive(true), createdAt, lastActive
Indexes: phone, email, subscription.plan, state+district, whatsappNumber
Pre-save hook: set freeUsage.resetDate to 1st of next month if not set

2. LawyerProfile.js: (as defined in architecture section 4.2)

3. DocumentTemplate.js: (as defined in architecture section 4.3)

4. ChatSession.js: (as defined in architecture section 4.4)
Include TTL index: { createdAt: 1 }, expireAfterSeconds: 604800, partialFilterExpression: { status: 'active' }

5. Document.js: (as defined in architecture section 4.5)

6. CaseTracker.js: (as defined in architecture section 4.6)

7. Subscription.js: (as defined in architecture section 4.7)

8. Payment.js: (as defined in architecture section 4.8)

9. Consultation.js: (as defined in architecture section 4.9)

10. JurisdictionRule.js:
Fields: _id, state(String), documentType(String, matches template slug),
applicableActs: [{ act(ref LegalAct), isOverride(Boolean), notes }],
filingAuthority: { name, address, website, phone },
filingFee: { amount, currency(INR), notes },
limitationPeriod: { days, fromEvent },
courtHierarchy: [{ level, name, jurisdiction }],
isActive(true), lastVerified
Unique compound index: { state: 1, documentType: 1 }

11. LegalAct.js:
Fields: _id, shortName, fullName, year, type(central/state), applicableState,
sections: [{ number, title, text, simplifiedText, relevantTo([String]) }],
isActive, updatedAt
Indexes: shortName, type, sections.relevantTo

12. Notification.js: (as defined in architecture section 4.11)
Add TTL index on createdAt: expireAfterSeconds: 7776000 (90 days)

13. AuditLog.js:
Fields: _id, user(ref User), action(String), entity(String), entityId(ObjectId),
ipAddress, userAgent, metadata(Object), createdAt
Index: { user: 1, createdAt: -1 }, { entity: 1, entityId: 1 }

RULES:
- All schemas: { timestamps: true } where applicable OR manual createdAt/updatedAt
- Every schema exported as: module.exports = mongoose.model('ModelName', schema)
- Add schema.methods and schema.statics where sensible (e.g. User.findByPhone, User.isSubscribed())
- Add pre-save hooks for: User (normalize phone to E.164), LawyerProfile (recompute averageRating)
- Use mongoose.Schema.Types.Mixed for flexible data; Map for collectedData

Generate all 13 files completely.
```

---

### PROMPT 3 — Auth System (Backend)

```
You are building NyayaSetu's authentication system (MERN stack, Node.js/Express/MongoDB).

TASK: Build the complete authentication backend. Files to create:

1. server/src/middleware/auth.middleware.js
   - verifyToken(req, res, next): extract JWT from Authorization header, verify with JWT_SECRET, attach user to req.user
   - optionalAuth: same but doesn't fail if no token (for public routes)
   - requirePersona(...personas): middleware factory: requirePersona('lawyer', 'admin') → 403 if user.persona not in list
   - requireAdmin: shorthand for requirePersona('admin')

2. server/src/middleware/subscription.middleware.js
   - checkFeatureAccess(feature): factory middleware that reads user.subscription.plan + user.persona against FEATURE_MAP
   - checkFreeQuota(quotaType): check freeUsage.docsGenerated vs docsLimit etc., return 403 with { error: 'QUOTA_EXCEEDED', upgradeUrl: '/pricing' } if exceeded
   - FEATURE_MAP object: maps persona → plan → array of allowed feature strings

3. server/src/services/notification/smsService.js
   - sendOTP(phone, otp): in dev use Twilio SMS, in prod use MSG91
   - Uses process.env.SMS_PROVIDER ('twilio' | 'msg91')

4. server/src/controllers/auth.controller.js with these handlers:
   sendOTP: validate phone (+91 Indian mobile), generate 6-digit OTP, store in Redis with 5min TTL (key: otp:{phone}), call smsService.sendOTP, return { message, expiresIn: 300 }
   verifyOTP: retrieve from Redis, compare, delete key on success. Find or create User by phone. Generate JWT (15m) + refreshToken (30d). Return { token, refreshToken, user, isNewUser }
   register: complete profile setup (name, state, district, persona). If persona=lawyer, create LawyerProfile stub. Return updated user.
   getMe: return populated user with subscription info
   updateMe: allow updating name, state, district, preferredLanguage, preferredTheme, whatsappOptIn
   refresh: verify refresh token from body, issue new JWT pair
   logout: remove refresh token from user.refreshTokens array

5. server/src/routes/auth.routes.js:
   POST /send-otp → sendOTP
   POST /verify-otp → verifyOTP
   POST /register → verifyToken + register
   GET /me → verifyToken + getMe
   PATCH /me → verifyToken + updateMe
   POST /refresh → refresh
   POST /logout → verifyToken + logout
   POST /whatsapp-entry → handle deep link from WhatsApp (phone in query param → issue temp token)

6. server/src/utils/asyncHandler.js: wrapper that catches async errors and passes to next()

7. server/src/middleware/error.middleware.js:
   - errorHandler(err, req, res, next): map mongoose/jwt/razorpay errors to status codes
   - 400 for ValidationError, 401 for jwt errors, 403 for forbidden, 404 for not found, 500 for everything else
   - In dev: include stack trace. In prod: sanitize error messages.

IMPORTANT:
- JWT payload: { userId, persona, plan }
- OTP in dev: if NODE_ENV=development AND phone=+919999999999 → OTP is always "123456" (test shortcut)
- Refresh tokens: stored as array in user.refreshTokens (supports multiple devices, max 5)
- Phone normalization: always store as +91XXXXXXXXXX
- Rate limit OTP: use express-rate-limit, 3 req per phone per 15min (keyed by req.body.phone)
```

---

### PROMPT 4 — AI Abstraction Layer & Document Engine

```
You are building NyayaSetu's AI engine (Node.js). The system uses Gemini 2.5 Flash in dev and Claude Sonnet in production, via an abstraction layer.

TASK: Build the complete AI service layer. Files to create:

1. server/src/services/ai/geminiClient.js
   - Uses @google/generative-ai SDK
   - model: 'gemini-2.5-flash'
   - chat(messages, systemPrompt, stream=false): 
     * Convert messages array [{role, content}] to Gemini history format (user/model)
     * Last message is the new user input
     * systemInstruction from systemPrompt
     * If stream=true: return async generator that yields text deltas
     * If stream=false: return full text string
   - generate(prompt, jsonMode=false): single-shot generation
     * If jsonMode=true: wrap prompt with instruction to return ONLY valid JSON, no markdown, no backticks
     * Parse and return JSON object
   - Handle rate limit errors (429): retry after 1s with exponential backoff, max 3 retries

2. server/src/services/ai/claudeClient.js
   - Uses @anthropic-ai/sdk
   - model: 'claude-sonnet-4-20250514', max_tokens: 4096
   - chat(messages, systemPrompt, stream=false): same interface as geminiClient
   - generate(prompt, jsonMode=false): same interface
   - Handle overload errors with same retry logic

3. server/src/services/ai/aiProvider.js
   - Import both clients
   - Switch based on process.env.AI_PROVIDER ('gemini' or 'claude')
   - Export: { chat, generate } — same interface regardless of provider

4. server/src/services/ai/questionEngine.js
   - Function: getNextQuestion(session, template, jurisdictionRule)
   - Builds system prompt:
     "You are NyayaSetu, a compassionate Indian legal assistant. You are collecting information to draft a {templateName}. 
     Jurisdiction: {state} — {filingAuthority}. 
     Applicable law: {primaryActs}.
     Already collected: {JSON.stringify(collectedData)}.
     Still needed: {remainingFields}.
     Conversation language: {language}.
     Rules:
     - Ask ONE question at a time. Be conversational and empathetic.
     - If user provides multiple pieces of info, extract all, then ask next missing field.
     - When ALL required fields are collected, respond ONLY with this JSON: {\"dataComplete\":true,\"summary\":\"...\"}
     - Never use legal jargon when asking questions. Use simple {language} language.
     - For Hindi (hi): respond entirely in Devanagari script."
   - Calls aiProvider.chat(session.messages, systemPrompt, true) → SSE stream
   - After each response: extract any field values from the AI response using regex/JSON parsing
   - Returns: { stream, extractedFields, isComplete }

5. server/src/services/ai/documentEngine.js
   - Function: generateDocument(session, template, jurisdictionRule, legalActSections)
   - Builds the full document generation prompt (as in architecture section 5.2)
   - Calls aiProvider.generate(prompt, jsonMode=true)
   - Returns parsed JSON: { documentText, legalCitations, clauseExplanations, nextSteps }
   - Include Indian Kanoon URLs in legalCitations by appending search URL
   - Error handling: if JSON parse fails, retry once with stricter prompt

6. server/src/services/ai/clauseExplainer.js
   - Function: explainClause(clauseText, language, stream=true)
   - System prompt: "Explain this legal clause in simple {language} language a common person can understand. Use an analogy if helpful. Max 100 words."
   - Returns stream or text

All functions must handle errors gracefully. Log errors with winston (use logger from utils/logger.js).
```

---

### PROMPT 5 — Chat & Document Controllers

```
You are building NyayaSetu's core backend controllers (Node.js/Express/MongoDB).

TASK: Build chat session management and document generation. Files to create:

1. server/src/controllers/chat.controller.js

createSession:
  - Auth required. Check freeUsage.aiChatsUsed vs aiChatsLimit → 403 if exceeded
  - Load DocumentTemplate by slug from body
  - Check template.requiredPlan against user's plan → 403 with { upgradeRequired: true } if insufficient
  - Load JurisdictionRule for user.state + template.slug (or nearest match)
  - Create ChatSession: { user, template, source: 'web', language, resolvedState }
  - Increment user.freeUsage.aiChatsUsed
  - Call questionEngine to get first question (inject an empty message to kick off)
  - Return { sessionId, firstMessage, template summary, estimatedQuestions }

sendMessage:
  - Load session. Verify session belongs to req.user.
  - Append user message to session.messages
  - Set response headers for SSE: Content-Type: text/event-stream, Cache-Control: no-cache
  - Call questionEngine.getNextQuestion(session, template, jurisdiction) → stream
  - Pipe stream to SSE: write `data: {"delta":"...","done":false}\n\n` for each chunk
  - Extract fields from full response, update session.collectedData
  - Update progressPercent based on required fields filled
  - If isComplete: set session.status = 'data_complete', send final SSE with { done: true, dataComplete: true }
  - On stream end: write `data: {"done":true}\n\n` and close response
  - Save session to DB

getSession: return session with messages + collectedData + progressPercent
listSessions: return user's sessions paginated (limit 20)
abandonSession: set status = 'abandoned'

2. server/src/controllers/document.controller.js

generateDocument:
  - Load session (must be status='data_complete'). Verify ownership.
  - Check user can download PDF: free tier gets preview only, paid gets PDF
  - Set session.status = 'generating', save
  - Create Document stub in DB with status info
  - Add job to Bull documentQueue: { sessionId, userId, documentId }
  - Return 202: { documentId, status: 'generating', pollUrl }

getDocument: return full document. If isPaid=false AND user.plan='free': return document WITHOUT pdfUrl (show upgrade prompt)
listDocuments: paginated, filter by template category
getPDF: check payment status, generate signed Cloudinary/S3 URL (15min expiry), return { pdfUrl }
explainClause: SSE stream from clauseExplainer service
shareDocument: generate UUID shareToken, save to document, return share URL
getSharedDocument: public endpoint, find by shareToken, return limited view (no PDF URL)
regenerate: re-run documentEngine with updated collectedData from body patches

3. server/src/worker/jobs/generateDocument.js (Bull job processor)
  - Process job from documentQueue
  - Load session + template + jurisdictionRule + legalActSections
  - Call documentEngine.generateDocument()
  - Generate PDF via pdfGenerator.js
  - Upload PDF via storageProvider
  - Update Document with content, pdfUrl, legalCitations, clauseExplanations, nextSteps
  - Set document status complete
  - Update session.status = 'completed'
  - Send WhatsApp/email notification if user has alerts enabled
  - On error: update document with error status, notify user

4. server/src/services/pdf/pdfGenerator.js
  - Uses pdfkit
  - generateLegalDocument(document, user, template) → Buffer
  - Layout: header with NyayaSetu logo + document title, body with formatted legal text, footer with date/disclaimer
  - Each section has proper indentation and spacing
  - Append "Next Steps" section at end
  - Append "Legal Citations" section
  - Return PDF buffer

5. server/src/routes/document.routes.js and server/src/routes/chat.routes.js
  - All routes with proper auth middleware
  - subscription.middleware on quota-sensitive endpoints

Include all necessary imports. Use asyncHandler for all controller functions.
```

---

### PROMPT 6 — Case Tracker, eCourts & Indian Kanoon

```
You are building NyayaSetu's case tracking system (Node.js/Express/MongoDB).

TASK: Build the case tracker with real eCourts integration and Indian Kanoon law search.

1. server/src/services/ecourts/ecourtsClient.js
  - Uses axios
  - getCaseStatus(cnrNumber): 
    * Primary: GET https://services.ecourts.gov.in/ecourtindiaHC/cases/case_no?cnr_no={cnr}
    * Set headers: User-Agent, Accept: application/json
    * Timeout: 15000ms
    * On failure/CAPTCHA: use mock data in dev (return sample case object)
    * In prod: implement scrapeNJDG() as fallback using cheerio
  - parseCaseData(rawData): normalize response to { caseTitle, petitioner, respondent, court, hearings: [], nextHearingDate, caseStatus }
  - validateCNR(cnrNumber): regex validate CNR format (2 letters + 2 digits + 6 digits + 4 digit year)
  - Mock data for dev: realistic Indian court case object with 3 past hearings and 1 upcoming

2. server/src/services/indianKanoon/kanoonClient.js
  - Uses axios with INDIANKANOON_API_KEY
  - searchLaw(query, pagenum=0): POST https://api.indiankanoon.org/search/ with { formInput, pagenum }
  - getDocument(docId): GET /doc/{docId}/
  - searchActSection(actName, sectionNumber): convenience method building optimal query
  - Cache results in Redis for 24h (key: kanoon:{hash(query)})
  - Return normalized { results: [{ docId, title, headline, publishdate, doctype }] }

3. server/src/controllers/case.controller.js
  addCase:
    - Validate CNR format
    - Check casesTracked vs casesLimit (free tier: max 1)
    - Check duplicate: same user + same CNR → 409
    - Fetch from eCourts API
    - Create CaseTracker document
    - Increment user.freeUsage.casesTracked
    - Return case with parsed hearing data

  listCases: user's cases with populated hearings, sorted by nextHearingDate
  getCaseDetail: full case with hearing history
  
  refreshCase:
    - Fetch latest from eCourts
    - Update hearings array (deduplicate by date)
    - Update nextHearingDate
    - Return updated case

  updateAlerts: PATCH alertDaysBefore, alertChannels
  shareCasewithLawyer: set sharedWithLawyer field, notify lawyer via WhatsApp/email
  removeCase: set isActive=false, decrement user.freeUsage.casesTracked

4. server/src/routes/case.routes.js — all routes with auth

5. server/src/routes/jurisdiction.routes.js
  GET /jurisdiction/states → list all unique states from JurisdictionRule collection
  GET /jurisdiction/:state/:docType → find JurisdictionRule, populate applicableActs
  GET /acts → list all LegalActs (paginated)
  GET /acts/:id/sections → act sections (can filter by relevantTo query param)
  GET /laws/search → proxy to kanoonClient.searchLaw, return results

6. server/src/worker/jobs/checkHearingDates.js (Bull cron job)
  - Runs daily at 6:00 AM IST
  - Find all CaseTracker where isActive=true AND nextHearingDate is within alertDaysBefore days
  - For each: call ecourtsClient to refresh, then add sendHearingAlert job to queue
  - Deduplication: job ID = alert_{caseId}_{hearingDate.toISOString()}

7. server/src/worker/jobs/sendHearingAlert.js
  - Loads case + user
  - If alertChannels.whatsapp: send via whatsappService
  - If alertChannels.email: send via emailService
  - Message template: "🏛️ Hearing Reminder: Your case {caseTitle} has a hearing on {date} at {court}. Prepared by NyayaSetu."
  - Save to alertsSent array on CaseTracker
```

---

### PROMPT 7 — WhatsApp Bot & Notification Services

```
You are building NyayaSetu's WhatsApp bot and notification system (Node.js/Twilio).

TASK: Build WhatsApp integration and all notification services.

1. server/src/controllers/whatsapp.controller.js
  The WhatsApp bot is a STATE MACHINE. Each user has a 'phase' stored in user.whatsappSessionData.

  Phases and flows:
  WELCOME: User sends any message for first time → reply with greeting in their language + show menu:
    "Welcome to NyayaSetu! I can help you with legal documents.
    Reply with:
    1️⃣ Create a document
    2️⃣ Track my court case
    3️⃣ Find a lawyer
    4️⃣ Change language (भाषा बदलें)"

  LANGUAGE_SELECT: User replies 1-6 for language. Save to user.preferredLanguage. Transition to MENU.

  MAIN_MENU: Show options 1-3 + 4 for language change

  SELECT_TEMPLATE: Show numbered list of document categories (max 9 fit in WA message). 
    On selection: show templates in that category. On template selection: transition to CHAT_FLOW

  CHAT_FLOW: 
    - Load or create ChatSession (source: 'whatsapp')
    - Forward user message to questionEngine (non-streaming, return full text)
    - Reply with AI response
    - On dataComplete: transition to GENERATING, trigger document generation
  
  GENERATING: "⏳ Your document is being prepared. I'll send it to you shortly!"
  
  DOCUMENT_READY: 
    - Send document summary as WhatsApp message
    - If user is on paid plan: send PDF via WhatsApp media message (Twilio media URL)
    - If free: "To download your PDF, visit nyayasetu.in and log in with your phone number."
  
  CASE_MENU: Sub-menu for case tracking
  CNR_INPUT: Ask for CNR number, validate, fetch, show case summary

  Handler functions:
  - handleIncoming(req, res): Twilio webhook handler. Validate Twilio signature. Extract phone + message. Route to state machine.
  - processStateMachine(user, message): giant switch on user.whatsappSessionData.phase
  - sendWhatsAppMessage(to, message, mediaUrl=null): Twilio client.messages.create
  - buildTwiMLResponse(message): return TwiML XML

2. server/src/services/notification/whatsappService.js
  - Uses twilio
  - sendMessage(phone, message): send plain text
  - sendMediaMessage(phone, message, mediaUrl): send with attachment
  - TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM
  - In dev: log message to console AND send via Twilio sandbox

3. server/src/services/notification/emailService.js
  - Uses nodemailer with Gmail SMTP (dev) or SendGrid (prod, env: EMAIL_PROVIDER)
  - sendEmail({ to, subject, html }): base function
  - Templates as functions that return HTML:
    * hearingReminderEmail(caseTitle, date, court): styled HTML email
    * documentReadyEmail(documentTitle, downloadUrl): styled HTML with CTA button  
    * welcomeEmail(name): onboarding email
    * otpEmail(otp): for users who prefer email OTP
  - In dev: use Ethereal mail (nodemailer.createTestAccount()) or just log to console

4. server/src/routes/whatsapp.routes.js
  GET /webhook → Twilio challenge response (validate req.query['hub.verify_token'])
  POST /webhook → verifyTwilioSignature middleware + handleIncoming

5. verifyTwilioSignature middleware:
  - Use twilio.validateRequest to verify X-Twilio-Signature header
  - Return 403 if invalid (except in dev where NODE_ENV=development)

6. server/src/controllers/notification.controller.js
  getNotifications: paginated, sorted by createdAt desc
  markRead: set isRead=true on notification by ID
  markAllRead: set isRead=true for all user notifications

7. server/src/routes/notification.routes.js — auth protected

Include proper error handling and logging throughout.
```

---

### PROMPT 8 — Lawyer Portal Backend

```
You are building NyayaSetu's lawyer portal backend (Node.js/Express/MongoDB).

TASK: Build lawyer management, consultation system, and payment commission logic.

1. server/src/controllers/lawyer.controller.js

searchLawyers:
  - Query: state, specialisation, district, minRating, maxFee, availableOnly
  - Only return verified lawyers (isVerified: true)
  - Paginate (limit 10, page param)
  - Return: lawyer profile + user name + averageRating + isAvailable

getLawyerProfile: full profile with ratings (last 5)

applyAsLawyer:
  - User must have persona='lawyer' (or update persona to 'lawyer')
  - Create/update LawyerProfile from body: barCouncilNumber, specialisations, practicingStates, experience, bio, consultationFee
  - Upload bar council certificate: handle file upload via multer + cloudinaryService
  - Set isVerified=false, admin must verify

updateLawyerProfile: only own profile

getMyClients:
  - Lawyer's clients = users who have shared cases or booked consultations with this lawyer
  - Return list with their cases + documents

2. server/src/controllers/consultation.controller.js

createConsultation:
  - Citizen creates: { lawyerId, mode, scheduledAt, notes, documentId(optional) }
  - Check lawyer isAvailableForConsultation
  - Create consultation (status: 'requested')
  - Create Razorpay order for consultationFee
  - Notify lawyer via WhatsApp/email
  - Return { consultationId, paymentOrder }

acceptConsultation: Lawyer only. Set status='accepted'. Notify citizen.
rejectConsultation: Lawyer only. Set status='rejected'. Refund if already paid.
completeConsultation: Lawyer only. Set status='completed'. Calculate commission split.
  - Platform takes referralFeePercent (default 10%)
  - Lawyer gets (100 - referralFeePercent)%
  - Update lawyer.totalEarnings
  - Update Payment with lawyerEarnings + platformEarnings

rateConsultation: Citizen rates (1-5) + review. Update lawyer averageRating (recompute from all ratings).

listConsultations: for both citizen (own) and lawyer (their bookings). Filter by status.

3. server/src/routes/lawyer.routes.js:
GET /lawyers → searchLawyers (auth)
GET /lawyers/:id → getLawyerProfile (auth)
POST /lawyers/apply → verifyToken + requirePersona('lawyer') + applyAsLawyer
PUT /lawyers/profile → verifyToken + requirePersona('lawyer') + updateLawyerProfile
GET /lawyers/me/clients → verifyToken + requirePersona('lawyer') + getMyClients
POST /consultations → verifyToken + requirePersona('citizen') + createConsultation
GET /consultations → verifyToken + listConsultations
PATCH /consultations/:id/accept → verifyToken + requirePersona('lawyer') + acceptConsultation
PATCH /consultations/:id/complete → verifyToken + requirePersona('lawyer') + completeConsultation
POST /consultations/:id/rate → verifyToken + requirePersona('citizen') + rateConsultation

4. server/src/controllers/admin.controller.js (basic)
verifyLawyer: set LawyerProfile.isVerified=true, send notification to lawyer
getStats: { totalUsers, totalDocuments, totalPayments(sum), activeLawyers, todaySignups }
listUsers: paginated with filters
getUser: full user profile + all documents + all cases

5. server/src/routes/admin.routes.js (all require requirePersona('admin'))
```

---

### PROMPT 9 — Payment & Subscription Backend

```
You are building NyayaSetu's payment and subscription system (Node.js/Express/Razorpay).

TASK: Build the complete payment flow for pay-per-doc and recurring subscriptions.

PLAN PRICES (in paise):
const PLANS = {
  citizen: {
    basic: { monthly: 9900, annual: 99900 },    // ₹99/mo, ₹999/yr
    pro: { monthly: 19900, annual: 199900 }      // ₹199/mo, ₹1,999/yr
  },
  lawyer: {
    professional: { monthly: 49900, annual: 499900 },
    firm: { monthly: 149900, annual: 1499900 }
  }
};
const PAY_PER_DOC = { simple: 4900, standard: 9900, premium: 19900 };

1. server/src/services/payment/razorpayService.js
  - Initialize: new Razorpay({ key_id, key_secret })
  - createOrder(amount, currency='INR', receipt, notes={}): → razorpay.orders.create()
  - verifyPaymentSignature(orderId, paymentId, signature) → boolean (HMAC SHA256)
  - createSubscription(planId, totalCount, customerId): → razorpay.subscriptions.create()
  - cancelSubscription(subscriptionId): → razorpay.subscriptions.cancel()
  - fetchPayment(paymentId): → razorpay.payments.fetch()

2. server/src/controllers/payment.controller.js

createDocumentOrder:
  - Load Document by ID (verify ownership)
  - Check if already paid → 400 "Already paid"
  - Get price from template.pricePayPerDoc or PAY_PER_DOC[template.complexity]
  - Create Razorpay order
  - Create Payment record (status: 'created')
  - Return { orderId, amount, currency, razorpayKeyId }

verifyDocumentPayment:
  - Verify Razorpay signature
  - Update Payment status to 'paid'
  - Update Document: isPaid=true, accessType='pay_per_doc', payment=paymentId
  - Generate PDF if not already generated
  - Return { success: true, pdfUrl }

createSubscriptionOrder:
  - Body: { plan, billingCycle, persona }
  - Calculate amount
  - Create Razorpay order
  - Return order details + razorpayKeyId

verifySubscription:
  - Verify signature
  - Create Subscription record
  - Update User.subscription: { plan, validUntil: now + 30/365 days, autoRenew: true }
  - Update User.freeUsage limits based on plan (basic: 15 docs, pro: unlimited)
  - Create Payment record
  - Send welcome email
  - Return { success: true, subscription }

getPaymentHistory: paginated list of user payments with document/subscription info

3. webhook handler (POST /payments/webhook):
  - Verify X-Razorpay-Signature using RAZORPAY_WEBHOOK_SECRET
  - Handle events: payment.captured, subscription.activated, subscription.charged, subscription.cancelled, payment.failed
  - On payment.captured: same as verifyDocumentPayment logic (idempotent)
  - On subscription.cancelled: update Subscription.isActive=false, User.subscription.plan='free'

4. server/src/routes/payment.routes.js
  POST /payments/create-order → verifyToken + createDocumentOrder
  POST /payments/verify → verifyToken + verifyDocumentPayment
  POST /subscriptions/create → verifyToken + createSubscriptionOrder
  POST /subscriptions/verify → verifyToken + verifySubscription
  GET /subscriptions/current → verifyToken + (return user subscription info)
  POST /subscriptions/cancel → verifyToken + cancelSubscription
  GET /payments/history → verifyToken + getPaymentHistory
  POST /payments/webhook → razorpayWebhookVerify middleware + webhookHandler
  (webhook route must NOT use express.json() — needs raw body for HMAC)

5. server/src/worker/jobs/resetFreeQuota.js (Bull cron, runs 1st of each month midnight IST)
  - Find all users where freeUsage.resetDate <= now
  - Reset: docsGenerated=0, casesTracked=0, aiChatsUsed=0
  - Set resetDate to 1st of next month
  - Process in batches of 100 using cursor

NOTES:
- In dev with Razorpay test keys: all ₹ amounts in paise, test card: 4111 1111 1111 1111
- Webhook secret must be set in Razorpay dashboard → Webhooks
- Always verify signature before processing any payment
```

---

### PROMPT 10 — Redux Store & API Layer (Frontend)

```
You are building NyayaSetu's React frontend state management (Redux Toolkit + Axios).

TASK: Build the complete Redux store, API service layer, and custom hooks.

1. client/src/services/api.js
  - Axios instance: baseURL='/v1', timeout:30000, withCredentials:true
  - Request interceptor: attach Authorization: Bearer token from localStorage
  - Response interceptor: on 401 → call /auth/refresh → retry original request once → on second 401 → dispatch logout + redirect to /login
  - Export axios instance as default

2. client/src/store/store.js
  - configureStore with these slices: auth, chat, document, case, ui, subscription, notification, lawyer
  - middleware: redux-persist for auth + ui slices (localStorage)
  - export RootState and AppDispatch types

3. client/src/store/slices/authSlice.js
  State: { user: null, token: null, refreshToken: null, loading: false, error: null }
  Async thunks (createAsyncThunk):
    sendOTP(phone): POST /auth/send-otp
    verifyOTP({ phone, otp }): POST /auth/verify-otp → save token to state + localStorage
    register(profileData): POST /auth/register
    getMe(): GET /auth/me
    updateMe(data): PATCH /auth/me
    logout(): POST /auth/logout → clear state + localStorage
  Reducers: clearError, setUser, setToken
  Selectors: selectUser, selectIsAuthenticated, selectUserPlan, selectUserPersona

4. client/src/store/slices/uiSlice.js
  State: { theme: 'default', language: 'en', sidebarOpen: false, notifications: [] }
  Reducers: setTheme(persist), setLanguage(persist + call i18n.changeLanguage), toggleSidebar
  Persisted fields: theme, language
  On setLanguage: also update User via updateMe API (optimistic update)

5. client/src/store/slices/chatSlice.js
  State: { sessions: [], currentSession: null, messages: [], loading: false, streaming: false, streamBuffer: '' }
  Thunks:
    createSession({ templateSlug, language }): POST /chat/sessions
    sendMessage({ sessionId, message }): POST /chat/sessions/:id/message
      - Uses EventSource/fetch for SSE
      - Dispatches addStreamDelta on each SSE chunk
      - On done: dispatches streamComplete
  Reducers: addMessage, addStreamDelta, streamComplete, setCurrentSession, clearChat

6. client/src/store/slices/documentSlice.js
  State: { documents: [], currentDocument: null, generating: false, generationProgress: 0, error: null }
  Thunks: generateDocument, listDocuments, getDocument, getPDF, explainClause, shareDocument

7. client/src/store/slices/caseSlice.js
  State: { cases: [], currentCase: null, loading: false }
  Thunks: addCase, listCases, getCaseDetail, refreshCase, removeCase

8. client/src/store/slices/subscriptionSlice.js
  State: { currentPlan: 'free', subscription: null, plans: {}, loading: false }
  Thunks: getCurrentSubscription, createOrder, verifyPayment, cancelSubscription

9. client/src/hooks/useAuth.js
  - Custom hook wrapping auth selectors + actions
  - Returns: { user, isAuthenticated, plan, persona, login, logout, isFeatureAllowed(feature) }

10. client/src/hooks/useDocumentStream.js
  - Manages SSE connection for document generation
  - Uses EventSource API
  - Returns: { stream, startStream, isStreaming, buffer, error }

11. client/src/hooks/useFeatureAccess.js
  - Returns: canAccess(feature) → boolean based on user plan + persona
  - Import FEATURE_MAP from featureFlags.js

12. client/src/utils/featureFlags.js
  - Complete FEATURE_MAP object:
    citizen: {
      free: ['basic_templates', 'preview_document', 'ai_chat_limited', 'track_1_case'],
      basic: ['all_basic_templates', 'pdf_download', 'voice_input', 'clause_explainer', 'track_5_cases', 'hearing_alerts_whatsapp', 'view_lawyer_profiles'],
      pro: ['all_templates', 'unlimited_docs', 'unlimited_cases', 'all_alerts', 'book_consultation', 'priority_support']
    },
    lawyer: {
      free: ['apply_profile'],
      professional: ['client_portal', 'case_management', 'consultation_bookings', 'verified_badge'],
      firm: ['all_professional', 'team_access', 'analytics', 'custom_branding', 'priority_placement']
    }
  - Helper: hasFeature(persona, plan, featureName) → boolean

13. client/src/services/razorpay.js
  - loadRazorpay(): dynamically load Razorpay checkout script
  - openCheckout({ orderId, amount, currency, name, description, prefill, onSuccess, onDismiss }):
    * Load script, new window.Razorpay({...}).open()
    * prefill: { name: user.name, contact: user.phone, email: user.email }
    * theme: { color: '#1a237e' } (will override from theme in production via CSS var)
    * On payment.failed: call onDismiss with error
```

---

### PROMPT 11 — Theme System & MUI Setup (Frontend)

```
You are building NyayaSetu's React theme system (MUI v6 + CSS custom properties + Framer Motion).

TASK: Build the complete theme system. No hardcoded colors anywhere in components.

1. client/src/theme/tokens.js
  Export design tokens:
  SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 }
  RADIUS = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 }
  SHADOWS = { sm: '0 1px 3px rgba(0,0,0,0.12)', md: '...', lg: '...', glow: '0 0 20px var(--color-primary-alpha)' }
  TYPOGRAPHY = { fontFamily: { display: 'Playfair Display', body: 'DM Sans', mono: 'JetBrains Mono' }, ... }
  TRANSITIONS = { fast: '150ms ease', normal: '250ms ease', slow: '400ms ease' }

2. client/src/theme/themes/default.js — Blue Justice theme
  CSS vars set on :root:
    --color-primary: #1565C0
    --color-primary-light: #1E88E5
    --color-primary-alpha: rgba(21, 101, 192, 0.15)
    --color-secondary: #E65100
    --color-bg: #F8FAFF
    --color-surface: #FFFFFF
    --color-text: #1A1A2E
    --color-text-secondary: #5C6BC0
    --color-border: #E8EAF6
    --color-success: #2E7D32
    --color-error: #C62828
    --color-warning: #E65100
  MUI palette config using these vars
  Typography overrides: h1-h6 use Playfair Display, body uses DM Sans

3. client/src/theme/themes/saffron.js — India-inspired Saffron/Tricolor:
  --color-primary: #FF6F00 (Saffron)
  --color-secondary: #1B5E20 (India Green)  
  --color-bg: #FFFBF0
  --color-surface: #FFFFFF
  --color-text: #1A1200

4. client/src/theme/themes/dark.js — Dark mode:
  --color-primary: #5C9BF5
  --color-bg: #0D1117
  --color-surface: #161B22
  --color-text: #E6EDF3
  --color-border: #30363D

5. client/src/theme/themes/highContrast.js — Accessibility:
  --color-primary: #0000CC
  --color-bg: #FFFFFF
  --color-text: #000000
  --color-border: #000000
  Minimum 7:1 contrast ratios everywhere

6. client/src/theme/themes/emerald.js — Calm Green:
  --color-primary: #00695C
  --color-bg: #F0FDF4
  --color-surface: #FFFFFF
  --color-text: #004D40

7. client/src/theme/ThemeProvider.jsx
  - Import all 5 themes
  - Read theme name from Redux store (ui.theme)
  - On theme change:
    * Apply CSS custom properties to document.root
    * Create MUI theme from config
    * Animate the transition: use document.documentElement.style.transition = 'background 0.3s, color 0.3s'
  - Also handle i18n: set dir='rtl' if language is Urdu
  - Inject Google Fonts link tags: Playfair Display, DM Sans (only once)
  - Wrap children in MuiThemeProvider + CssBaseline

8. client/src/components/layout/ThemeSwitcher.jsx
  - Floating action button in bottom-right corner
  - On click: expand to show 5 circular color swatches (one per theme)
  - Each swatch shows theme primary color
  - On swatch click: dispatch setTheme, collapse
  - Animate with Framer Motion: AnimatePresence + spring animation
  - Tooltip showing theme name on hover
  - Persist selection to Redux + localStorage

9. client/src/components/ui/AnimatedPage.jsx
  - Framer Motion wrapper for page transitions
  - initial: { opacity: 0, y: 20 }
  - animate: { opacity: 1, y: 0 }
  - exit: { opacity: 0, y: -20 }
  - transition: { duration: 0.3, ease: 'easeOut' }

10. client/src/components/ui/GlassCard.jsx
  - MUI Paper with glassmorphism: backdrop-filter: blur(12px), semi-transparent background
  - Uses --color-surface with 0.85 alpha
  - Border: 1px solid --color-border with 0.5 alpha
  - elevation prop affects blur intensity

11. client/src/components/ui/FeatureGate.jsx and UpgradeCTA.jsx (from earlier architecture)
  - FeatureGate: check permission, show children or UpgradeCTA
  - UpgradeCTA: attractive card showing feature name, current plan, upgrade CTA button
    * Uses theme colors (no hardcoded hex)
    * Framer Motion: subtle pulse on the upgrade button
    * Link to /pricing

Ensure ALL color references use CSS custom properties OR MUI theme palette. Zero hardcoded hex values.
```

---

### PROMPT 12 — Authentication Pages & Layout (Frontend)

```
You are building NyayaSetu's React authentication pages and main layout (MUI + Framer Motion + i18next).

TASK: Build stunning auth pages and the main app layout.

DESIGN DIRECTION: Refined, trustworthy, Indian legal aesthetic. Playfair Display for headings, DM Sans for body. Deep blue primary on light background. Subtle court/scale of justice motifs. Animations: smooth, professional, never gimmicky.

1. client/src/pages/auth/Login.jsx
  - Two sections: left panel (decorative) + right panel (form)
  - Left: animated SVG of scales of justice (build with SVG paths using CSS vars colors), tagline in Playfair Display, 3 feature bullets
  - Right: 
    * Logo + "NyayaSetu" header
    * Language selector (6 languages) at top right
    * Phone number input (Indian +91 prefix fixed, 10 digit input)
    * On submit: dispatch sendOTP, transition to OTP input
    * OTP input: 6 individual digit boxes (like Aadhaar portals), auto-advance on digit entry
    * Resend OTP button (visible after 30s countdown)
    * Submit OTP: dispatch verifyOTP
    * On isNewUser=true: redirect to /register. Else: redirect to /{persona}/home
  - Mobile: stacked single column (no left panel)
  - Animations: Framer Motion staggered fade-in of form elements
  - i18n: all text via t() hook

2. client/src/pages/auth/Register.jsx
  - 3-step wizard with progress indicator:
    Step 1: Personal Info — Name, State (dropdown with all Indian states), District
    Step 2: Persona — Card selection (Citizen / Lawyer) with icons, descriptions, plan comparison
    Step 3: Preferences — Language, Theme preview, WhatsApp opt-in (with sample notification shown)
  - Each step animates in/out with horizontal slide
  - On step 3 complete: dispatch register, redirect to dashboard
  - Validation via react-hook-form + yup

3. client/src/components/layout/Navbar.jsx
  - Sticky top nav, MUI AppBar
  - Left: Logo + "NyayaSetu" 
  - Center (desktop): Search bar for laws/documents
  - Right: NotificationBell (badge count), Avatar (dropdown: Profile, Settings, Theme, Logout)
  - Mobile: hamburger menu
  - Show plan badge (FREE/PRO) next to avatar
  - ThemeSwitcher accessible from avatar menu

4. client/src/components/layout/Sidebar.jsx
  - Persistent on desktop (240px), drawer on mobile
  - Role-aware navigation items:
    citizen: Home, New Document, My Documents, Case Tracker, Find Lawyer, Pricing, Settings
    lawyer: Home, My Clients, Cases, Consultations, Earnings, Profile, Settings
    admin: Dashboard, Users, Templates, Lawyers, Analytics
  - Active item highlighted with left border (primary color)
  - Collapsed mode (64px icons only) toggled by button
  - Each item with MUI icon + label
  - At bottom: subscription status card (shows plan, days remaining, upgrade CTA if free)

5. client/src/components/layout/BottomNav.jsx (mobile only, hidden on desktop)
  - Fixed bottom, 5 key items based on persona
  - MUI BottomNavigation component
  - Active state animation: icon scales up 1.2x with spring

6. client/src/pages/citizen/Home.jsx
  - Hero section: "आपका कानूनी अधिकार, हमारी ज़िम्मेदारी" (translatable) + subtitle
  - Quick action cards with icons: Create Document, Track Case, Find Lawyer, Legal FAQ
  - Recent documents list (max 3)
  - Upcoming hearing card (if any)
  - Animated stats: X documents created, Y users helped (use useMotionValue for counter animation)
  - Free tier usage meter (progress bar: X/3 docs used)

7. Protected route component: client/src/components/ui/ProtectedRoute.jsx
  - If not authenticated: redirect to /login with returnUrl
  - If wrong persona for route: redirect to /{userPersona}/home
  - Shows loading spinner during auth check

All components must:
- Use useTranslation() for all visible text (provide en translations inline as fallback)
- Use theme CSS variables or MUI theme props for all colors (never hardcode)
- Be fully responsive (mobile-first)
- Use Framer Motion for entry animations
```

---

### PROMPT 13 — Document Creation Flow (Frontend)

```
You are building NyayaSetu's core document creation flow (React + MUI + Redux + Framer Motion).

TASK: Build the document creation user flow — template picker, AI chat, and document preview.

1. client/src/pages/citizen/NewDocument.jsx — Template Picker
  - Page title: "Create a Legal Document"
  - Category filter tabs (horizontal scroll on mobile): Consumer, Property, Employment, Family, Criminal, RTI, Civil, Financial, Labour, Startup
  - Document template grid (3 cols desktop, 2 tablet, 1 mobile)
  - Each DocumentTemplateCard shows:
    * Icon (category-based MUI icon)
    * Document name (translated)
    * Estimated time
    * Complexity badge (Simple/Moderate/Complex)
    * Plan badge (FREE / BASIC / PRO)
    * Hover: scale(1.03) with shadow (Framer Motion)
  - On card click: if user has access → navigate to /chat/{slug}. If not → show FeatureGate UpgradeCTA
  - Search bar to filter templates
  - "Popular this week" section at top with 4 featured templates
  - Loading skeleton while fetching templates

2. client/src/pages/citizen/ChatFlow.jsx — AI Conversational Data Collection
  - Full screen chat interface (like WhatsApp)
  - Header: template name + progress bar (%) + "X of Y questions"
  - Message area: scrollable, auto-scroll to bottom on new message
  - AI messages: left-aligned bubble (primary color bg, white text)
  - User messages: right-aligned bubble (surface bg, dark text)
  - Typing indicator: three animated dots (Framer Motion stagger)
  - Input area (bottom fixed):
    * Text input with send button
    * Voice input button (hold to record) — pulsing red animation when recording
    * Language badge (clickable, opens language switcher)
  - On mount: dispatch createSession({ templateSlug, language })
  - On send: dispatch sendMessage → show typing indicator → stream response into AI bubble
  - Progress bar updates as progressPercent from Redux
  - When dataComplete: show "Document ready! Generating..." animation → auto-navigate to /documents/{id}
  - Connection bar: show "AI is thinking..." during generation
  - If session exists (returning user): load history and resume

3. client/src/components/chat/MessageBubble.jsx
  - Framer Motion: initial={scale:0.8, opacity:0} animate={scale:1, opacity:1}
  - User bubbles: right-aligned, rounded corners (top-right straight)
  - AI bubbles: left-aligned with small avatar (scales of justice icon)
  - Support markdown rendering (bold, bullet points from AI responses)
  - Timestamps on hover

4. client/src/components/chat/VoiceInput.jsx
  - Hold button to record (Web Speech API)
  - Visual feedback: pulsing circle animation during recording
  - On release: transcribe + insert into input box
  - Request mic permission gracefully (show explanation if denied)

5. client/src/pages/citizen/DocumentPreview.jsx — View Generated Document
  - Show loading state with pulsing placeholder if still generating (poll every 2s)
  - Once ready:
    Left panel (70%): 
      * Document rendered as formatted text with section headings
      * Each numbered clause is clickable → opens ClauseExplainer popover
    Right panel (30%):
      * "Legal Citations" accordion (show act name, section, one-line description)
      * "Next Steps" stepper (MUI Stepper, vertical)
      * "Download PDF" button (if paid) OR "Upgrade to Download" (if free)
      * "Share Document" button → copy shareable link to clipboard
      * "Connect with Lawyer" CTA card
  - Mobile: tabs between Document / Citations / Next Steps
  - PDF download flow:
    * If user has paid plan: call getPDF() → open Cloudinary URL in new tab
    * If free: open Razorpay checkout via openCheckout() → on success → reload + show PDF button
  - Animate sections appearing with stagger

6. client/src/components/document/ClauseExplainer.jsx
  - MUI Popover anchored to clicked clause
  - On open: dispatch explainClause(clauseIndex, language) → show streaming text
  - "In Simple Terms:" header with emoji
  - Framer Motion: fade + scale in
  - Language toggle inside popover to re-explain in different language

7. client/src/pages/citizen/MyDocuments.jsx
  - Documents list with search + filter (by category, date, status)
  - DocumentCard: title, template category icon, date created, status (generating/complete), isPaid badge
  - Actions: View, Download (if paid), Share, Delete
  - Empty state: illustrated (SVG) with CTA to create first document
  - Infinite scroll (load 10 at a time)

All components: use Redux for state, axios API via service layer, theme CSS vars for colors, Framer Motion for all transitions.
```

---

### PROMPT 14 — Case Tracker & Pricing Pages (Frontend)

```
You are building NyayaSetu's Case Tracker dashboard and Pricing page (React + MUI + Framer Motion).

1. client/src/pages/citizen/CaseDashboard.jsx
  - Header: "My Court Cases" + "Add Case" button
  - If free plan and casesTracked >= casesLimit: show banner "Upgrade to track more cases"
  - Case grid (cards):
    Each CaseCard shows:
    * Court name + case title
    * CNR number (monospace font)
    * Next hearing date (large, highlighted if within 7 days)
    * Status badge (Active/Disposed/Transferred)
    * Alert settings icons (WhatsApp/Email)
    * "Refresh" button (manual sync)
  - On click: expand to HearingTimeline
  
  Add Case modal:
  * CNR input with format hint (e.g., DLHC010012342024)
  * Validate CNR format client-side before submit
  * Loading state while fetching from eCourts
  * On success: animated card slides into grid

  client/src/components/case/HearingTimeline.jsx:
  - Vertical timeline (MUI / custom)
  - Past hearings: grey with ✓
  - Next hearing: highlighted with pulsing dot
  - Each entry: date, purpose, result, judge name
  - "Remind me" button on upcoming hearings

  client/src/components/case/CNRInput.jsx:
  - Input that formats as user types (auto-uppercase, max 16 chars)
  - Real-time format validation with visual feedback
  - Help tooltip with CNR format explanation and where to find it

2. client/src/pages/shared/Pricing.jsx — The most important marketing page
  
  Layout:
  a) Hero: "Legal help that fits your pocket" + tagline + current plan badge
  b) Toggle: Monthly / Annual (Annual shows 2 months free badge)
  c) Persona tabs: For Citizens / For Lawyers
  d) Three pricing cards side by side:
    Each card:
    * Plan name with icon
    * Price (animated number when toggling monthly/annual)
    * "Most Popular" badge on recommended plan (animated ribbon)
    * Feature list: ✅ Included | ❌ Not included | 🔒 Upgrade
    * CTA button (Framer Motion: hover lift effect)
  e) Feature comparison table (expandable, shows all 20+ features)
  f) FAQ accordion section
  g) "Still not sure?" section with lawyer testimonials

  Citizen plans:
  FREE: 3 docs/month, 5 AI chats, 1 case, preview only, no PDF, 5 templates
  BASIC ₹99/month: 15 docs, 30 chats, 5 cases, PDF download, all templates, voice, clause explainer, WhatsApp alerts
  PRO ₹199/month: Unlimited everything + lawyer connections + priority support + email alerts

  Lawyer plans:
  FREE: Apply for profile only
  PROFESSIONAL ₹499/month: Client portal, 20 reviews/month, verified badge, consultation bookings
  FIRM ₹1,499/month: Everything + 5 team members + analytics + custom branding

  Payment flow:
  * On CTA click: dispatch createSubscriptionOrder → Razorpay checkout → verifySubscription
  * On success: confetti animation (use canvas-confetti), redirect to dashboard

3. client/src/pages/shared/Settings.jsx
  Sections (vertical tabs on desktop, accordion on mobile):
  a) Account: Edit name, email (optional), state, district
  b) Appearance: 
    * Theme picker (show 5 theme cards with preview)
    * Animated transition when switching themes
  c) Language: 
    * 11 language options with native script labels
    * "Preview" button shows sample text in selected language
  d) Notifications:
    * WhatsApp toggle + verify number
    * Email toggle + verify email
    * Notification types checklist (hearing reminders, doc ready, etc.)
  e) Subscription:
    * Current plan with expiry
    * Usage meters (docs, cases, AI chats) with animated progress bars
    * Upgrade / Cancel buttons
  f) Security:
    * Active sessions list
    * "Logout from all devices" button

4. client/src/components/layout/Navbar.jsx — Notification bell with popover:
  - Bell icon with badge (unread count)
  - Click: MUI Popover with notifications list
  - Each notification: icon (type-based), title, time, read/unread styling
  - "Mark all read" button at top
  - Empty state illustration
  - Framer Motion: popover slides down

All components must use theme CSS vars for colors. All text through i18n. Fully responsive.
```

---

### PROMPT 15 — Lawyer Portal Frontend

```
You are building NyayaSetu's Lawyer Portal (React + MUI + Framer Motion).

TASK: Build all lawyer-facing pages.

1. client/src/pages/lawyer/LawyerHome.jsx
  - Summary stats cards (animated counters): Active Clients, Cases This Month, Consultations Pending, Earnings This Month
  - Pending consultations (urgent): show as action items at top
  - Recent client activities feed (client X created document Y, client Z's case has hearing)
  - Quick actions: View Clients, New Consultation, Update Availability toggle

2. client/src/pages/citizen/NewDocument.jsx — Add "Connect with Lawyer" button that leads to:
   client/src/components/lawyer/LawyerSearch.jsx
  - Search form: State, Specialisation (multi-select), Language, Budget (range slider)
  - Results grid of LawyerCards
  - LawyerCard: Photo/avatar, name, verified badge, specialisations chips, rating stars, experience, consultation fee, "Book Now" button
  - On "Book Now": opens ConsultationBooking drawer

3. client/src/components/lawyer/ConsultationBooking.jsx
  - MUI Drawer sliding from right
  - Step 1: Select mode (Chat / Video / Phone / In Person)
  - Step 2: Date + time picker (available slots from API)
  - Step 3: Notes + attach document (optional)
  - Step 4: Payment summary → "Pay & Confirm"
  - Razorpay checkout integration
  - On success: show confirmation with calendar invite option

4. client/src/pages/lawyer/ClientList.jsx
  - List of citizens who shared cases/docs with this lawyer
  - Each row: citizen name, cases shared, docs shared, last activity, "View" button
  - Search by name

5. client/src/pages/lawyer/CaseManagement.jsx
  - Lawyer's assigned cases (shared by citizens)
  - Same HearingTimeline component as citizen
  - Can add notes per case

6. client/src/pages/lawyer/EarningsPanel.jsx
  - Total earnings (lifetime, this month)
  - Commission breakdown: consultations, referrals, document reviews
  - Pending payouts
  - Payment history table
  - Recharts: monthly earnings bar chart using theme colors (NO hardcoded colors — use theme.palette from useMuiTheme())

7. client/src/pages/lawyer/LawyerDashboard.jsx (profile setup page)
  - Multi-step form:
    Step 1: Bar Council details (enrollment number, state)
    Step 2: Specialisations (checkbox grid with icons)  
    Step 3: Practice details (states, courts, experience, bio)
    Step 4: Availability + fees (consultation modes, fee in ₹, calendar availability)
    Step 5: Upload documents (bar council certificate)
  - Submit → "Under Review" status shown with timeline

8. client/src/pages/citizen/LawyerProfile.jsx (public view)
  - Full lawyer profile: photo, name, verified badge, rating, bio
  - Specialisation chips
  - Review/rating list
  - "Book Consultation" button
  - "Chat on WhatsApp" button (only if lawyer has whatsappOptIn)

All Recharts components: extract colors from theme using useMemo + useTheme() — NEVER hardcode chart colors.
```

---

### PROMPT 16 — Seed Data, Scripts & Database Init

```
You are building NyayaSetu's seed data scripts (Node.js/MongoDB/Mongoose).

TASK: Create seed scripts for initial data population.

1. scripts/seedTemplates.js
  Seed 15 DocumentTemplate records:
  1. slug: 'legal_notice_landlord', name: 'Legal Notice to Landlord', category: 'property', complexity: 'simple', pricePayPerDoc: 4900
     Primary acts: Transfer of Property Act 1882 (S.106), Rent Control Act (state-specific)
     Question flow (8 questions): sender_name, sender_address, landlord_name, landlord_address, property_address, tenancy_start_date, issue_type(choice: security_deposit/repairs/illegal_eviction/other), issue_details
  
  2. slug: 'consumer_complaint', name: 'Consumer Complaint', category: 'consumer', complexity: 'moderate', pricePayPerDoc: 9900
     Primary acts: Consumer Protection Act 2019
     Questions: complainant_name, complainant_address, opposite_party_name, op_address, product_service, purchase_date, purchase_amount, defect_description, relief_sought
  
  3. slug: 'rti_application', name: 'RTI Application', category: 'rti', complexity: 'simple', pricePayPerDoc: 4900
     Primary acts: Right to Information Act 2005
     Questions: applicant_name, applicant_address, public_authority_name, public_authority_address, information_sought, time_period
  
  4. slug: 'employment_termination', name: 'Employment Termination Notice', category: 'employment', complexity: 'moderate', pricePayPerDoc: 9900
  5. slug: 'bail_application', name: 'Bail Application', category: 'criminal', complexity: 'complex', pricePayPerDoc: 19900
  6. slug: 'divorce_petition', name: 'Divorce Petition (Mutual Consent)', category: 'family', complexity: 'complex', pricePayPerDoc: 19900
  7. slug: 'property_sale_agreement', name: 'Property Sale Agreement', category: 'property', complexity: 'complex', pricePayPerDoc: 19900
  8. slug: 'power_of_attorney', name: 'Power of Attorney (General)', category: 'civil', complexity: 'moderate', pricePayPerDoc: 9900
  9. slug: 'cheque_bounce_notice', name: 'Cheque Bounce Legal Notice', category: 'financial', complexity: 'simple', pricePayPerDoc: 4900 (NI Act S.138)
  10. slug: 'labour_dispute', name: 'Labour Dispute Application', category: 'labour', complexity: 'moderate', pricePayPerDoc: 9900
  11. slug: 'startup_founders_agreement', name: "Founders' Agreement", category: 'startup', complexity: 'complex', pricePayPerDoc: 19900
  12. slug: 'domestic_violence_complaint', name: 'Domestic Violence Complaint', category: 'family', complexity: 'simple', pricePayPerDoc: 0 (requiredPlan: free for all — social good)
  13. slug: 'police_complaint', name: 'Police Complaint / FIR Draft', category: 'criminal', complexity: 'simple', pricePayPerDoc: 0 (free)
  14. slug: 'insurance_claim', name: 'Insurance Claim Dispute Notice', category: 'consumer', complexity: 'moderate', pricePayPerDoc: 9900
  15. slug: 'landlord_eviction', name: 'Eviction Notice to Tenant', category: 'property', complexity: 'simple', pricePayPerDoc: 4900

  Set requiredPlan.citizen: 'free' for free templates, 'basic' for pricePayPerDoc templates, 'pro' for complex ones
  Mark rti_application, domestic_violence_complaint, police_complaint as FREE for all

2. scripts/seedJurisdictions.js
  Seed JurisdictionRule for 5 states × 3 document types (15 records):
  States: Maharashtra, Delhi, West Bengal, Tamil Nadu, Karnataka
  DocTypes: consumer_complaint, rti_application, legal_notice_landlord
  
  For each combination provide:
  - Correct filingAuthority (real district consumer forum names + addresses)
  - Real filing fees (Maharashtra consumer forum: free for claims < ₹5L, ₹200 for ₹5-10L)
  - Correct limitation periods
  - Court hierarchy

3. scripts/seedLegalActs.js
  Seed 8 LegalAct records with real section text:
  1. Consumer Protection Act, 2019 — sections: 2(1)(d) [consumer definition], 35 [filing complaint], 38 [procedure], 69 [limitation]
  2. Right to Information Act, 2005 — sections: 6, 7, 8, 19
  3. Transfer of Property Act, 1882 — sections: 105-107, 111
  4. Negotiable Instruments Act, 1881 — sections: 138, 141, 142, 143A
  5. Code of Civil Procedure, 1908 — sections: 9, 80 (notice)
  6. Indian Evidence Act, 1872 — sections: 17, 65B
  7. Protection of Women from Domestic Violence Act, 2005 — sections: 3, 12, 17
  8. Industrial Disputes Act, 1947 — sections: 2(k), 10, 25F

  Include simplifiedText for each section (plain language version)
  Include relevantTo array linking to template slugs

4. scripts/createAdmin.js
  - Creates one admin user:
    email: admin@nyayasetu.in, persona: 'admin', isEmailVerified: true, name: 'NyayaSetu Admin'
  - Log the generated temp password

5. Add npm scripts to server/package.json:
  "seed:templates": "node scripts/seedTemplates.js"
  "seed:jurisdictions": "node scripts/seedJurisdictions.js"
  "seed:acts": "node scripts/seedLegalActs.js"
  "seed:all": "npm run seed:acts && npm run seed:jurisdictions && npm run seed:templates"
  "create:admin": "node scripts/createAdmin.js"

Each script: connect to MongoDB, check if data already exists (don't duplicate), insert, log counts, disconnect.
```

---

### PROMPT 17 — i18n Translations & PWA Config

```
You are adding internationalization and PWA configuration to NyayaSetu (React + i18next).

1. client/public/locales/en/translation.json — Complete English translations:
Provide ALL keys for:
  auth: { login_title, phone_label, otp_title, otp_subtitle, resend_otp, register_title, steps: [...], persona_citizen, persona_citizen_desc, persona_lawyer, persona_lawyer_desc }
  nav: { home, new_document, my_documents, case_tracker, find_lawyer, pricing, settings, profile, logout }
  document: { create, title, category_*, template_picker_title, chat_title, preview_title, generating, download_pdf, upgrade_to_download, share, citations, next_steps, clause_explainer_title }
  case: { add_case, cnr_label, cnr_hint, next_hearing, hearings, refresh, alerts, no_cases, track_limit_reached }
  pricing: { title, monthly, annual, free_plan, basic_plan, pro_plan, professional_plan, firm_plan, features: { ... 20 features }, upgrade_cta, current_plan }
  lawyer: { search_title, book_consultation, verified, experience, fee, booking_steps: [...] }
  common: { loading, error, retry, save, cancel, back, next, done, free, upgrade, per_month, per_year, of }
  settings: { theme: { title, default, saffron, dark, highContrast, emerald }, language: { title, en, hi, bn, mr, ta, te }, notifications: {...} }

2. client/public/locales/hi/translation.json — Hindi translations for ALL same keys
  (Provide Devanagari script for all Hindi text)

3. client/public/manifest.json — PWA manifest:
  name: "NyayaSetu", short_name: "NyayaSetu"
  description: "Legal document creation and case tracking for every Indian"
  start_url: "/"
  display: "standalone"
  background_color: "#F8FAFF"
  theme_color: "#1565C0"
  icons: sizes 72, 96, 128, 144, 152, 192, 384, 512 (all pointing to /icons/icon-{size}.png)
  categories: ["productivity", "utilities"]
  lang: "en"

4. client/vite.config.js — Add PWA plugin:
  Use vite-plugin-pwa
  workbox: { runtimeCaching for API calls (network-first), static assets (cache-first) }
  Register service worker

5. client/src/i18n/i18n.js — Complete i18next config:
  Languages: en, hi, bn, mr, ta, te
  Backend: load from /locales/{{lng}}/translation.json
  Detection: localStorage first, then browser
  Fallback: 'en'
  Cache: enabled

6. client/src/components/ui/LanguageSelector.jsx
  - MUI Select with flag emojis + native script labels
  - 🇬🇧 English | हिन्दी | বাংলা | मराठी | தமிழ் | తెలుగు
  - On change: call i18n.changeLanguage() + dispatch setLanguage to Redux + call API updateMe

7. Also add to client/index.html:
  <link rel="preconnect" to Google Fonts
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap">
  Proper meta tags for PWA (apple-touch-icon, theme-color, viewport)

Generate all files completely with real translation strings (use actual Hindi for Hindi translations, not transliterations).
```

---

### PROMPT 18 — Docker, Final Wiring & Testing

```
You are finalizing NyayaSetu's deployment configuration and wiring everything together.

TASK: Docker setup, final wiring, and basic test structure.

1. docker-compose.yml (for local dev):
  services:
    mongo: mongo:7.0, port 27017, volume nyaya_mongo_data
    redis: redis:7-alpine, port 6379, volume nyaya_redis_data
    server: build ./server, port 5000, depends: mongo+redis, env_file .env, volume ./server:/app (hot reload)
    worker: build ./worker (same Dockerfile as server but different CMD), depends: mongo+redis
  volumes: nyaya_mongo_data, nyaya_redis_data
  networks: nyaya_network

2. server/Dockerfile:
  FROM node:20-alpine
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  EXPOSE 5000
  CMD ["node", "src/server.js"] (dev: nodemon)

3. worker/src/worker.js — Bull worker entry point:
  - Import all queues and job processors
  - hearingAlertQueue.process('checkHearingDates', 1, checkHearingDatesJob)
  - hearingAlertQueue.process('sendHearingAlert', 5, sendHearingAlertJob)
  - documentQueue.process('generateDocument', 3, generateDocumentJob)
  - subscriptionQueue.process('resetFreeQuota', 1, resetFreeQuotaJob)
  - Bull Board UI at /admin/queues (for monitoring)
  - Schedule cron jobs using bull's repeat option:
    checkHearingDates: cron '0 6 * * *' (6 AM IST = 0:30 UTC)
    resetFreeQuota: cron '0 18 L * *' (midnight IST on last day of month)

4. server/src/utils/logger.js:
  Winston logger:
  - Console transport (colorized in dev)
  - File transport: logs/error.log (error level only), logs/combined.log (all)
  - Format: timestamp + level + message + metadata
  - In dev: pretty print. In prod: JSON format.
  Export: logger with .info, .error, .warn, .debug methods

5. .env.example — complete file with all 35+ variables, commented sections, no actual values

6. server/src/config/constants.js:
  Export: PLANS, PAY_PER_DOC prices, FREE_TIER_LIMITS, INDIAN_STATES array (all 28 states + 8 UTs),
  LANGUAGES array, DOCUMENT_CATEGORIES array, PERSONA_TYPES array

7. Basic test files (Jest):
  server/tests/auth.test.js:
    - Test sendOTP with valid phone
    - Test verifyOTP with correct OTP
    - Test verifyOTP with wrong OTP → 400
    - Test getMe with valid JWT
    - Test getMe with expired JWT → 401
  
  server/tests/payment.test.js:
    - Test verifyPaymentSignature with valid inputs
    - Test verifyPaymentSignature with tampered data → false

8. client/src/App.jsx — Main router:
  - React Router v6 with createBrowserRouter
  - Routes:
    /login, /register → auth pages (no layout)
    / → redirect to /citizen/home or /lawyer/home based on persona
    /citizen/* → citizen pages within Layout
    /lawyer/* → lawyer pages within Layout  
    /admin/* → admin pages (requirePersona admin)
    /shared/:shareToken → public shared document view
    /pricing → public pricing page
    * → 404 page
  - Wrap all routes in NyayaThemeProvider
  - Wrap in Redux Provider + PersistGate
  - AnimatePresence for page transitions

9. client/src/App.jsx — Also add:
  - Startup: dispatch getMe() on app load if token exists
  - Global Snackbar for toast notifications (react-toastify with theme colors)
  - Language direction: set document.documentElement.dir = 'rtl' for Urdu
  - Service worker registration

10. README.md:
  Project title, description, features list, tech stack, 
  Getting Started (clone, npm install, cp .env.example .env, docker-compose up, npm run seed:all, npm run dev)
  Architecture diagram (ASCII), API docs link, Contributing section
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

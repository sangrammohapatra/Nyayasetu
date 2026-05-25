/**
 * server/src/controllers/whatsapp.controller.js
 *
 * WhatsApp bot — STATE MACHINE controller.
 *
 * Each user has a `whatsappSessionData` sub-document on their User record:
 *   {
 *     phase:               'WELCOME' | 'LANGUAGE_SELECT' | 'MAIN_MENU' | 'SELECT_TEMPLATE'
 *                          | 'CHAT_FLOW' | 'GENERATING' | 'DOCUMENT_READY'
 *                          | 'CASE_MENU' | 'CNR_INPUT',
 *     activeSessionId:     ObjectId | null,
 *     activeCategorySlug:  string | null,
 *     templateChoices:     [ { number, slug } ],
 *     categoryChoices:     [ { number, slug } ],
 *     lastDocumentId:      ObjectId | null,
 *     updatedAt:           Date
 *   }
 *
 * Handlers exported:
 *   handleIncoming(req, res)               — Twilio POST /webhook handler
 *   processStateMachine(user, message)     — switch on phase
 *   sendWhatsAppMessage(to, message, mediaUrl=null) — thin wrapper around whatsappService
 *   buildTwiMLResponse(message, mediaUrl)  — produce TwiML XML for instant Twilio reply
 *   notifyDocumentReady({ userId, documentId }) — called by worker on doc generation done
 */

const { twiml: TwilioTwiml } = require('twilio');

const User = require('../models/User.model');
const DocumentTemplate = require('../models/DocumentTemplate.model');
const ChatSession = require('../models/ChatSession.model');
const Document = require('../models/Document.model');
const CaseTracker = require('../models/CaseTracker.model');

const whatsappService = require('../services/notification/whatsappService');
const questionEngine = require('../services/ai/questionEngine');
const ecourtsService = require('../services/ecourts/ecourtsService');
const documentQueue = require('../services/notification/documentQueueClient');

const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

/* ---------------------------------------------------------------------------
 * Static config: languages, menu structures, copy.
 * ------------------------------------------------------------------------ */

const LANGUAGE_OPTIONS = [
  { num: '1', code: 'en', label: 'English' },
  { num: '2', code: 'hi', label: 'हिन्दी (Hindi)' },
  { num: '3', code: 'bn', label: 'বাংলা (Bengali)' },
  { num: '4', code: 'mr', label: 'मराठी (Marathi)' },
  { num: '5', code: 'ta', label: 'தமிழ் (Tamil)' },
  { num: '6', code: 'te', label: 'తెలుగు (Telugu)' },
];

const COPY = {
  welcome: {
    en: '👋 Welcome to *NyayaSetu* — your bridge to justice.\n\nI can help you with legal documents and court case tracking in your language.\n\nReply with:\n1️⃣ Create a document\n2️⃣ Track my court case\n3️⃣ Find a lawyer\n4️⃣ Change language (भाषा बदलें)',
    hi: '👋 *न्यायसेतु* में आपका स्वागत है — न्याय का सेतु।\n\nमैं आपकी भाषा में कानूनी दस्तावेज़ और कोर्ट केस ट्रैकिंग में मदद कर सकता हूँ।\n\nजवाब दें:\n1️⃣ दस्तावेज़ बनाएँ\n2️⃣ मेरा कोर्ट केस ट्रैक करें\n3️⃣ वकील ढूँढें\n4️⃣ भाषा बदलें',
    bn: '👋 *NyayaSetu*-এ স্বাগতম।\n\nআমি আপনার ভাষায় আইনি নথি এবং আদালতের মামলা ট্র্যাক করতে সাহায্য করতে পারি।\n\nউত্তর দিন:\n1️⃣ একটি নথি তৈরি করুন\n2️⃣ আমার মামলা ট্র্যাক করুন\n3️⃣ একজন আইনজীবী খুঁজুন\n4️⃣ ভাষা পরিবর্তন করুন',
    mr: '👋 *न्यायसेतु* मध्ये आपले स्वागत आहे.\n\nमी तुमच्या भाषेत कायदेशीर कागदपत्रे आणि कोर्ट केस ट्रॅकिंगमध्ये मदत करू शकतो.\n\nउत्तर द्या:\n1️⃣ कागदपत्र तयार करा\n2️⃣ माझा कोर्ट केस ट्रॅक करा\n3️⃣ वकील शोधा\n4️⃣ भाषा बदला',
    ta: '👋 *நியாயசேது*-விற்கு வரவேற்கிறோம்.\n\nநான் உங்கள் மொழியில் சட்ட ஆவணங்கள் மற்றும் நீதிமன்ற வழக்கு கண்காணிப்பில் உதவ முடியும்.\n\nபதில் அளிக்கவும்:\n1️⃣ ஒரு ஆவணத்தை உருவாக்கவும்\n2️⃣ எனது வழக்கைப் பின்தொடரவும்\n3️⃣ ஒரு வழக்கறிஞரைக் கண்டுபிடிக்கவும்\n4️⃣ மொழியை மாற்று',
    te: '👋 *న్యాయసేతు*కు స్వాగతం.\n\nనేను మీ భాషలో చట్టపరమైన పత్రాలు మరియు కోర్టు కేసు ట్రాకింగ్‌లో సహాయపడగలను.\n\nప్రత్యుత్తరం ఇవ్వండి:\n1️⃣ పత్రాన్ని సృష్టించండి\n2️⃣ నా కేసును ట్రాక్ చేయండి\n3️⃣ న్యాయవాదిని కనుగొనండి\n4️⃣ భాషను మార్చండి',
  },
  languageSelect:
    '🌐 Please select your language / अपनी भाषा चुनें:\n\n1️⃣ English\n2️⃣ हिन्दी (Hindi)\n3️⃣ বাংলা (Bengali)\n4️⃣ मराठी (Marathi)\n5️⃣ தமிழ் (Tamil)\n6️⃣ తెలుగు (Telugu)\n\nReply with the number (1-6).',
  mainMenu: {
    en: '📋 *Main Menu*\n\n1️⃣ Create a document\n2️⃣ Track my court case\n3️⃣ Find a lawyer\n4️⃣ Change language',
    hi: '📋 *मुख्य मेनू*\n\n1️⃣ दस्तावेज़ बनाएँ\n2️⃣ कोर्ट केस ट्रैक करें\n3️⃣ वकील ढूँढें\n4️⃣ भाषा बदलें',
    bn: '📋 *প্রধান মেনু*\n\n1️⃣ নথি তৈরি করুন\n2️⃣ মামলা ট্র্যাক করুন\n3️⃣ আইনজীবী খুঁজুন\n4️⃣ ভাষা পরিবর্তন',
    mr: '📋 *मुख्य मेनू*\n\n1️⃣ कागदपत्र तयार करा\n2️⃣ कोर्ट केस ट्रॅक करा\n3️⃣ वकील शोधा\n4️⃣ भाषा बदला',
    ta: '📋 *முக்கிய மெனு*\n\n1️⃣ ஆவணம் உருவாக்கு\n2️⃣ வழக்கைப் பின்தொடர்\n3️⃣ வழக்கறிஞரைக் கண்டுபிடி\n4️⃣ மொழியை மாற்று',
    te: '📋 *ప్రధాన మెను*\n\n1️⃣ పత్రం సృష్టించండి\n2️⃣ కేసును ట్రాక్ చేయండి\n3️⃣ న్యాయవాదిని కనుగొనండి\n4️⃣ భాషను మార్చండి',
  },
  unknownInput: {
    en: '🤔 I didn\'t understand. Please reply with the number of the option you want, or type *menu* to return to the main menu.',
    hi: '🤔 मैं समझ नहीं पाया। कृपया विकल्प की संख्या के साथ उत्तर दें, या मुख्य मेनू पर लौटने के लिए *menu* टाइप करें।',
    bn: '🤔 আমি বুঝতে পারিনি। দয়া করে বিকল্পের নম্বর দিয়ে উত্তর দিন, বা মূল মেনুতে ফিরতে *menu* টাইপ করুন।',
    mr: '🤔 मला समजले नाही. कृपया पर्यायाच्या क्रमांकासह उत्तर द्या, किंवा मुख्य मेनूवर परत येण्यासाठी *menu* टाइप करा.',
    ta: '🤔 எனக்குப் புரியவில்லை. தயவுசெய்து விருப்பத்தின் எண்ணுடன் பதிலளிக்கவும், அல்லது முதன்மை மெனுவுக்குத் திரும்ப *menu* என தட்டச்சு செய்யவும்.',
    te: '🤔 నాకు అర్థం కాలేదు. దయచేసి ఎంపిక సంఖ్యతో ప్రత్యుత్తరం ఇవ్వండి, లేదా ప్రధాన మెనుకు తిరిగి రావడానికి *menu* అని టైప్ చేయండి.',
  },
  generating: {
    en: '⏳ Your document is being prepared. I\'ll send it to you shortly!',
    hi: '⏳ आपका दस्तावेज़ तैयार किया जा रहा है। मैं इसे जल्द ही आपको भेजूँगा!',
    bn: '⏳ আপনার নথি প্রস্তুত করা হচ্ছে। আমি শীঘ্রই এটি আপনাকে পাঠাব!',
    mr: '⏳ तुमचा दस्तऐवज तयार होत आहे. मी तो लवकरच तुम्हाला पाठवेन!',
    ta: '⏳ உங்கள் ஆவணம் தயாரிக்கப்படுகிறது. நான் விரைவில் உங்களுக்கு அனுப்புகிறேன்!',
    te: '⏳ మీ పత్రం సిద్ధం చేయబడుతోంది. నేను త్వరలో మీకు పంపుతాను!',
  },
  freePdfLocked: {
    en: '🔒 To download your PDF, visit *nyayasetu.in* and log in with this phone number.\n\nUpgrade to *Basic ₹99/month* for direct WhatsApp PDF delivery.',
    hi: '🔒 अपना पीडीएफ डाउनलोड करने के लिए, *nyayasetu.in* पर जाएँ और इस फ़ोन नंबर से लॉग इन करें।\n\nसीधे व्हाट्सएप पर पीडीएफ पाने के लिए *बेसिक ₹99/माह* में अपग्रेड करें।',
    bn: '🔒 আপনার PDF ডাউনলোড করতে, *nyayasetu.in* এ যান এবং এই ফোন নম্বর দিয়ে লগ ইন করুন।',
    mr: '🔒 तुमचा PDF डाउनलोड करण्यासाठी, *nyayasetu.in* ला भेट द्या आणि या फोन नंबरने लॉग इन करा.',
    ta: '🔒 உங்கள் PDF ஐ பதிவிறக்க, *nyayasetu.in* க்குச் சென்று இந்த தொலைபேசி எண்ணுடன் உள்நுழையவும்.',
    te: '🔒 మీ PDFని డౌన్‌లోడ్ చేయడానికి, *nyayasetu.in*కి వెళ్లి ఈ ఫోన్ నంబర్‌తో లాగిన్ చేయండి.',
  },
  cnrAsk: {
    en: '📋 Please send your *CNR Number* (16-character case number from eCourts).\n\nExample: DLHC010012342024',
    hi: '📋 कृपया अपना *CNR नंबर* भेजें (eCourts से 16-अक्षर का केस नंबर)।\n\nउदाहरण: DLHC010012342024',
    bn: '📋 অনুগ্রহ করে আপনার *CNR নম্বর* পাঠান (eCourts থেকে 16-অক্ষরের কেস নম্বর)।',
    mr: '📋 कृपया तुमचा *CNR क्रमांक* पाठवा (eCourts वरून 16-वर्णांचा केस क्रमांक).',
    ta: '📋 உங்கள் *CNR எண்* அனுப்பவும் (eCourts இல் இருந்து 16-எழுத்து வழக்கு எண்).',
    te: '📋 దయచేసి మీ *CNR నంబర్* పంపండి (eCourts నుండి 16-అక్షరాల కేస్ నంబర్).',
  },
  cnrInvalid: {
    en: '❌ That doesn\'t look like a valid CNR number. CNR format: 2 letters + 2 digits + 6 digits + 4-digit year (e.g. DLHC010012342024). Please try again or type *menu*.',
    hi: '❌ यह सही CNR नंबर नहीं लगता। प्रारूप: 2 अक्षर + 2 अंक + 6 अंक + 4-अंकों का वर्ष (जैसे DLHC010012342024)। पुनः प्रयास करें या *menu* टाइप करें।',
    bn: '❌ এটি একটি বৈধ CNR নম্বরের মতো দেখাচ্ছে না। পুনরায় চেষ্টা করুন বা *menu* টাইপ করুন।',
    mr: '❌ हे वैध CNR क्रमांकासारखे दिसत नाही. पुन्हा प्रयत्न करा किंवा *menu* टाइप करा.',
    ta: '❌ அது சரியான CNR எண் போல் தெரியவில்லை. மீண்டும் முயற்சிக்கவும் அல்லது *menu* என தட்டச்சு செய்யவும்.',
    te: '❌ ఇది చెల్లుబాటు అయ్యే CNR నంబర్ లాగా కనిపించడం లేదు. మళ్లీ ప్రయత్నించండి లేదా *menu* అని టైప్ చేయండి.',
  },
  lawyerSearchPrompt: {
    en: '🔍 Lawyer search is available on the website: *nyayasetu.in/lawyers*\n\nYou can filter by city, specialisation and budget there. Type *menu* to return.',
    hi: '🔍 वकील खोज वेबसाइट पर उपलब्ध है: *nyayasetu.in/lawyers*\n\nवहाँ आप शहर, विशेषज्ञता और बजट से फ़िल्टर कर सकते हैं। वापस आने के लिए *menu* टाइप करें।',
    bn: '🔍 আইনজীবী অনুসন্ধান ওয়েবসাইটে উপলব্ধ: *nyayasetu.in/lawyers*',
    mr: '🔍 वकील शोध वेबसाइटवर उपलब्ध आहे: *nyayasetu.in/lawyers*',
    ta: '🔍 வழக்கறிஞர் தேடல் இணையதளத்தில் கிடைக்கிறது: *nyayasetu.in/lawyers*',
    te: '🔍 న్యాయవాది శోధన వెబ్‌సైట్‌లో అందుబాటులో ఉంది: *nyayasetu.in/lawyers*',
  },
};

const CNR_REGEX = /^[A-Z]{2}\d{2}\d{6}\d{4}$/;

function L(key, lang) {
  const node = COPY[key];
  if (!node) return '';
  if (typeof node === 'string') return node;
  return node[lang] || node.en;
}

function normalisePhone(twilioFrom) {
  if (!twilioFrom) return null;
  let p = String(twilioFrom).replace(/^whatsapp:/, '').trim();
  p = p.replace(/[\s\-()]/g, '');
  if (!p.startsWith('+')) p = `+${p}`;
  return p;
}

/* ---------------------------------------------------------------------------
 *                        TWILIO WEBHOOK ENTRY POINT
 * ------------------------------------------------------------------------ */

const handleIncoming = asyncHandler(async (req, res) => {
  const fromAddress = req.body.From || req.body.from;
  const bodyText = (req.body.Body || req.body.body || '').trim();
  const numMedia = parseInt(req.body.NumMedia || '0', 10);

  const phone = normalisePhone(fromAddress);
  if (!phone) {
    logger.warn('[whatsapp.controller] Missing From in webhook', { body: req.body });
    return res.type('text/xml').send(buildTwiMLResponse(''));
  }

  logger.info('[whatsapp.controller] Incoming WhatsApp message', {
    from: phone,
    body: bodyText.substring(0, 120),
    hasMedia: numMedia > 0,
  });

  let user;
  try {
    user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        phone,
        persona: 'citizen',
        registrationSource: 'whatsapp',
        whatsappOptIn: true,
        whatsappNumber: phone,
        preferredLanguage: 'en',
        whatsappSessionData: {
          phase: 'WELCOME',
          activeSessionId: null,
          activeCategorySlug: null,
          templateChoices: [],
          categoryChoices: [],
          lastDocumentId: null,
          updatedAt: new Date(),
        },
      });
      logger.info('[whatsapp.controller] Auto-created user from WhatsApp', { userId: user._id, phone });
    } else if (!user.whatsappSessionData || !user.whatsappSessionData.phase) {
      user.whatsappSessionData = {
        phase: 'WELCOME',
        activeSessionId: null,
        activeCategorySlug: null,
        templateChoices: [],
        categoryChoices: [],
        lastDocumentId: null,
        updatedAt: new Date(),
      };
      await user.save();
    }
  } catch (err) {
    logger.error('[whatsapp.controller] Failed to load/create user', { phone, error: err.message });
    return res.type('text/xml').send(buildTwiMLResponse('⚠️ A server error occurred. Please try again in a moment.'));
  }

  const lowered = bodyText.toLowerCase();
  if (['menu', 'मेनू', 'হোম', 'home', 'start', 'restart'].includes(lowered)) {
    await setPhase(user, 'MAIN_MENU');
    const reply = L('mainMenu', user.preferredLanguage);
    return res.type('text/xml').send(buildTwiMLResponse(reply));
  }

  let result;
  try {
    result = await processStateMachine(user, bodyText);
  } catch (err) {
    logger.error('[whatsapp.controller] processStateMachine threw', {
      userId: user._id,
      phase: user.whatsappSessionData && user.whatsappSessionData.phase,
      error: err.message,
      stack: err.stack,
    });
    result = {
      reply: '⚠️ Something went wrong. Please type *menu* to start again.',
      mediaUrl: null,
    };
  }

  if (!result || !result.reply) {
    return res.type('text/xml').send(buildTwiMLResponse(''));
  }

  return res.type('text/xml').send(buildTwiMLResponse(result.reply, result.mediaUrl));
});

/* ---------------------------------------------------------------------------
 *                          STATE MACHINE CORE
 * ------------------------------------------------------------------------ */

async function processStateMachine(user, message) {
  const phase = (user.whatsappSessionData && user.whatsappSessionData.phase) || 'WELCOME';
  const lang = user.preferredLanguage || 'en';

  logger.debug('[whatsapp.controller] State machine tick', {
    userId: user._id,
    phase,
    lang,
    inboundLen: (message || '').length,
  });

  switch (phase) {
    case 'WELCOME':
      return handleWelcome(user);
    case 'LANGUAGE_SELECT':
      return handleLanguageSelect(user, message);
    case 'MAIN_MENU':
      return handleMainMenu(user, message);
    case 'SELECT_TEMPLATE':
      return handleSelectTemplate(user, message);
    case 'CHAT_FLOW':
      return handleChatFlow(user, message);
    case 'GENERATING':
      return { reply: L('generating', lang), mediaUrl: null };
    case 'DOCUMENT_READY':
      return handleDocumentReady(user, message);
    case 'CASE_MENU':
      return handleCaseMenu(user, message);
    case 'CNR_INPUT':
      return handleCnrInput(user, message);
    default:
      await setPhase(user, 'WELCOME');
      return handleWelcome(user);
  }
}

/* ----------------------------- PHASE HANDLERS ----------------------------- */

async function handleWelcome(user) {
  const lang = user.preferredLanguage || 'en';
  await setPhase(user, 'MAIN_MENU');
  return { reply: L('welcome', lang), mediaUrl: null };
}

async function handleLanguageSelect(user, message) {
  const trimmed = (message || '').trim();
  const opt = LANGUAGE_OPTIONS.find(o => o.num === trimmed);
  if (!opt) {
    return { reply: COPY.languageSelect, mediaUrl: null };
  }
  user.preferredLanguage = opt.code;
  await user.save();
  await setPhase(user, 'MAIN_MENU');
  return { reply: L('mainMenu', opt.code), mediaUrl: null };
}

async function handleMainMenu(user, message) {
  const lang = user.preferredLanguage || 'en';
  const choice = (message || '').trim();

  switch (choice) {
    case '1':
      return showCategoryList(user);
    case '2':
      await setPhase(user, 'CASE_MENU');
      return handleCaseMenu(user, '');
    case '3':
      return { reply: L('lawyerSearchPrompt', lang), mediaUrl: null };
    case '4':
      await setPhase(user, 'LANGUAGE_SELECT');
      return { reply: COPY.languageSelect, mediaUrl: null };
    default:
      return { reply: `${L('unknownInput', lang)}\n\n${L('mainMenu', lang)}`, mediaUrl: null };
  }
}

async function showCategoryList(user) {
  const lang = user.preferredLanguage || 'en';

  let categories;
  try {
    categories = await DocumentTemplate.distinct('category', { isActive: { $ne: false } });
  } catch (err) {
    logger.error('[whatsapp.controller] Failed to fetch categories', { error: err.message });
    return { reply: '⚠️ Could not load categories. Type *menu* to try again.', mediaUrl: null };
  }

  categories = (categories || []).slice(0, 9);
  if (categories.length === 0) {
    return { reply: '⚠️ No document categories are available right now.', mediaUrl: null };
  }

  const categoryChoices = categories.map((slug, idx) => ({ number: String(idx + 1), slug }));

  user.whatsappSessionData.activeCategorySlug = null;
  user.whatsappSessionData.categoryChoices = categoryChoices;
  user.whatsappSessionData.templateChoices = [];
  user.whatsappSessionData.phase = 'SELECT_TEMPLATE';
  user.whatsappSessionData.updatedAt = new Date();
  user.markModified('whatsappSessionData');
  await user.save();

  const heading = lang === 'hi'
    ? '📂 *श्रेणी चुनें:*'
    : '📂 *Choose a category:*';
  const list = categoryChoices.map(c => `${c.number}️⃣ ${prettyCategory(c.slug)}`).join('\n');
  const footer = lang === 'hi'
    ? '\n\nनंबर के साथ जवाब दें, या *menu* टाइप करें।'
    : '\n\nReply with the number, or type *menu*.';
  return { reply: `${heading}\n\n${list}${footer}`, mediaUrl: null };
}

async function handleSelectTemplate(user, message) {
  const lang = user.preferredLanguage || 'en';
  const choice = (message || '').trim();
  const session = user.whatsappSessionData || {};

  // Phase A: choosing a CATEGORY
  if (!session.activeCategorySlug && Array.isArray(session.categoryChoices) && session.categoryChoices.length > 0) {
    const cat = session.categoryChoices.find(c => c.number === choice);
    if (!cat) {
      return { reply: L('unknownInput', lang), mediaUrl: null };
    }

    let templates;
    try {
      templates = await DocumentTemplate.find({ category: cat.slug, isActive: { $ne: false } })
        .select('slug name nameTranslations complexity pricePayPerDoc requiredPlan')
        .limit(9)
        .lean();
    } catch (err) {
      logger.error('[whatsapp.controller] Failed to fetch templates', { error: err.message });
      return { reply: '⚠️ Could not load templates. Type *menu* to try again.', mediaUrl: null };
    }

    if (!templates.length) {
      return { reply: '⚠️ No templates available in this category. Type *menu* to try again.', mediaUrl: null };
    }

    const templateChoices = templates.map((t, idx) => ({ number: String(idx + 1), slug: t.slug }));
    user.whatsappSessionData.activeCategorySlug = cat.slug;
    user.whatsappSessionData.templateChoices = templateChoices;
    user.whatsappSessionData.updatedAt = new Date();
    user.markModified('whatsappSessionData');
    await user.save();

    const heading = `📄 *${prettyCategory(cat.slug)}*`;
    const list = templates.map((t, idx) => {
      const name = pickName(t, lang);
      const price = t.pricePayPerDoc === 0 ? '🆓' : `₹${(t.pricePayPerDoc / 100).toFixed(0)}`;
      return `${idx + 1}️⃣ ${name}  ${price}`;
    }).join('\n');
    const footer = '\n\nReply with the number, or type *menu*.';
    return { reply: `${heading}\n\n${list}${footer}`, mediaUrl: null };
  }

  // Phase B: choosing a TEMPLATE
  const tplChoice = (session.templateChoices || []).find(t => t.number === choice);
  if (!tplChoice) {
    return { reply: L('unknownInput', lang), mediaUrl: null };
  }

  let template;
  try {
    template = await DocumentTemplate.findOne({ slug: tplChoice.slug, isActive: { $ne: false } });
  } catch (err) {
    logger.error('[whatsapp.controller] Failed to load chosen template', { error: err.message });
    return { reply: '⚠️ Could not load that template. Type *menu* to try again.', mediaUrl: null };
  }
  if (!template) {
    return { reply: '⚠️ That template is no longer available. Type *menu* to try again.', mediaUrl: null };
  }

  let chatSession;
  try {
    chatSession = await ChatSession.create({
      user: user._id,
      template: template._id,
      messages: [],
      collectedData: new Map(),
      status: 'active',
      progressPercent: 0,
      source: 'whatsapp',
      whatsappPhase: 'CHAT_FLOW',
      language: user.preferredLanguage || 'en',
    });
  } catch (err) {
    logger.error('[whatsapp.controller] Failed to create ChatSession', { error: err.message });
    return { reply: '⚠️ Could not start the conversation. Type *menu* to try again.', mediaUrl: null };
  }

  user.whatsappSessionData.activeSessionId = chatSession._id;
  user.whatsappSessionData.phase = 'CHAT_FLOW';
  user.whatsappSessionData.updatedAt = new Date();
  user.markModified('whatsappSessionData');
  await user.save();

  let aiResponse;
  try {
    aiResponse = await questionEngine.getNextQuestion({
      session: chatSession,
      template,
      userMessage: '',
      language: user.preferredLanguage || 'en',
      streaming: false,
    });
  } catch (err) {
    logger.error('[whatsapp.controller] questionEngine failed on session start', { error: err.message });
    aiResponse = {
      text: `Let's create your *${pickName(template, user.preferredLanguage)}*. Please describe your situation in your own words.`,
      dataComplete: false,
    };
  }

  const tplName = pickName(template, user.preferredLanguage);
  const intro = `📝 *${tplName}*\n\n${aiResponse.text}`;
  return { reply: intro, mediaUrl: null };
}

async function handleChatFlow(user, message) {
  const lang = user.preferredLanguage || 'en';
  const sessionId = user.whatsappSessionData && user.whatsappSessionData.activeSessionId;

  if (!sessionId) {
    await setPhase(user, 'MAIN_MENU');
    return { reply: '⚠️ No active conversation. Returning to menu.\n\n' + L('mainMenu', lang), mediaUrl: null };
  }

  const chatSession = await ChatSession.findById(sessionId);
  if (!chatSession || chatSession.status === 'completed' || chatSession.status === 'abandoned') {
    await setPhase(user, 'MAIN_MENU');
    return { reply: '⚠️ That conversation has ended.\n\n' + L('mainMenu', lang), mediaUrl: null };
  }

  const template = await DocumentTemplate.findById(chatSession.template);
  if (!template) {
    await setPhase(user, 'MAIN_MENU');
    return { reply: '⚠️ Template no longer available.\n\n' + L('mainMenu', lang), mediaUrl: null };
  }

  let aiResponse;
  try {
    aiResponse = await questionEngine.getNextQuestion({
      session: chatSession,
      template,
      userMessage: message,
      language: lang,
      streaming: false,
    });
  } catch (err) {
    logger.error('[whatsapp.controller] questionEngine failed mid-flow', {
      sessionId: chatSession._id.toString(),
      error: err.message,
    });
    return { reply: '⚠️ The assistant had trouble responding. Please try again, or type *menu*.', mediaUrl: null };
  }

  if (aiResponse.dataComplete) {
    chatSession.status = 'generating';
    chatSession.whatsappPhase = 'GENERATING';
    chatSession.progressPercent = 100;
    await chatSession.save();

    try {
      await documentQueue.enqueueGenerateDocument({
        sessionId: chatSession._id,
        userId: user._id,
        templateId: template._id,
        source: 'whatsapp',
      });
    } catch (err) {
      logger.error('[whatsapp.controller] Failed to enqueue document generation', { error: err.message });
      chatSession.status = 'active';
      chatSession.whatsappPhase = 'CHAT_FLOW';
      await chatSession.save();
      return { reply: '⚠️ Could not queue your document. Please type *menu* and try again.', mediaUrl: null };
    }

    await setPhase(user, 'GENERATING');
    return { reply: L('generating', lang), mediaUrl: null };
  }

  return { reply: aiResponse.text, mediaUrl: null };
}

async function handleDocumentReady(user) {
  const lang = user.preferredLanguage || 'en';
  await setPhase(user, 'MAIN_MENU');
  return { reply: L('mainMenu', lang), mediaUrl: null };
}

async function handleCaseMenu(user, message) {
  const lang = user.preferredLanguage || 'en';
  const trimmed = (message || '').trim();

  if (!trimmed) {
    const heading = lang === 'hi'
      ? '⚖️ *कोर्ट केस ट्रैकिंग*\n\n1️⃣ नया केस ट्रैक करें (CNR से)\n2️⃣ मेरे ट्रैक किए गए केस देखें\n3️⃣ मुख्य मेनू पर लौटें'
      : '⚖️ *Case Tracking*\n\n1️⃣ Track a new case (by CNR)\n2️⃣ View my tracked cases\n3️⃣ Back to main menu';
    return { reply: heading, mediaUrl: null };
  }

  if (trimmed === '1') {
    await setPhase(user, 'CNR_INPUT');
    return { reply: L('cnrAsk', lang), mediaUrl: null };
  }

  if (trimmed === '2') {
    const cases = await CaseTracker.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    if (!cases.length) {
      return {
        reply: (lang === 'hi'
          ? 'आपने अभी तक कोई केस ट्रैक नहीं किया है।\n\n*menu* टाइप करें।'
          : 'You haven\'t tracked any cases yet.\n\nType *menu* to go back.'),
        mediaUrl: null,
      };
    }
    const lines = cases.map((c, i) => {
      const next = c.nextHearingDate ? new Date(c.nextHearingDate).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';
      return `${i + 1}. *${c.caseTitle || c.cnrNumber}*\n   CNR: \`${c.cnrNumber}\`\n   Next hearing: ${next}`;
    }).join('\n\n');
    return { reply: `📋 *Your Cases*\n\n${lines}\n\nType *menu* to go back.`, mediaUrl: null };
  }

  if (trimmed === '3') {
    await setPhase(user, 'MAIN_MENU');
    return { reply: L('mainMenu', lang), mediaUrl: null };
  }

  return { reply: L('unknownInput', lang), mediaUrl: null };
}

async function handleCnrInput(user, message) {
  const lang = user.preferredLanguage || 'en';
  const cnr = (message || '').trim().toUpperCase().replace(/\s+/g, '');

  if (!CNR_REGEX.test(cnr)) {
    return { reply: L('cnrInvalid', lang), mediaUrl: null };
  }

  let caseData;
  try {
    caseData = await ecourtsService.fetchCaseByCNR(cnr);
  } catch (err) {
    logger.error('[whatsapp.controller] eCourts fetch failed', { cnr, error: err.message });
    return { reply: '⚠️ Could not reach the eCourts service right now. Please try again later, or type *menu*.', mediaUrl: null };
  }

  if (!caseData || !caseData.cnrNumber) {
    return { reply: `❌ No case found for CNR \`${cnr}\`. Please check the number and try again, or type *menu*.`, mediaUrl: null };
  }

  const tracked = await CaseTracker.countDocuments({ user: user._id });
  const plan = (user.subscription && user.subscription.plan) || 'free';
  const caseLimit = plan === 'free' ? 1 : plan === 'basic' ? 5 : Infinity;
  if (tracked >= caseLimit) {
    return {
      reply: `🔒 You've reached your case-tracking limit (${tracked}/${caseLimit === Infinity ? '∞' : caseLimit}).\n\nUpgrade at *nyayasetu.in/pricing* to track more cases.\n\nType *menu* to go back.`,
      mediaUrl: null,
    };
  }

  try {
    await CaseTracker.findOneAndUpdate(
      { user: user._id, cnrNumber: cnr },
      {
        user: user._id,
        cnrNumber: cnr,
        caseTitle: caseData.caseTitle,
        court: caseData.court,
        state: caseData.state,
        district: caseData.district,
        hearings: caseData.hearings || [],
        nextHearingDate: caseData.nextHearingDate,
        alertDaysBefore: 2,
        alertChannels: { whatsapp: true, email: !!user.email },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    logger.error('[whatsapp.controller] Failed to save CaseTracker', { error: err.message });
    return { reply: '⚠️ Could not save the case. Please try again, or type *menu*.', mediaUrl: null };
  }

  const next = caseData.nextHearingDate
    ? new Date(caseData.nextHearingDate).toLocaleDateString('en-IN', { dateStyle: 'full', timeZone: 'Asia/Kolkata' })
    : '—';
  await setPhase(user, 'MAIN_MENU');
  return {
    reply: `✅ *Case tracked!*\n\n*${caseData.caseTitle || cnr}*\nCourt: ${caseData.court || '—'}\nNext hearing: *${next}*\n\nI'll send you a WhatsApp reminder 2 days before each hearing.\n\n${L('mainMenu', lang)}`,
    mediaUrl: null,
  };
}

/* ---------------------------------------------------------------------------
 *                EXTERNAL TRIGGERS (called from the worker)
 * ------------------------------------------------------------------------ */

async function notifyDocumentReady({ userId, documentId }) {
  const [user, doc] = await Promise.all([
    User.findById(userId),
    Document.findById(documentId).populate('template', 'slug name nameTranslations'),
  ]);

  if (!user || !doc) {
    logger.warn('[whatsapp.controller] notifyDocumentReady: missing user or doc', { userId, documentId });
    return;
  }

  if (!user.whatsappOptIn || !user.whatsappNumber) {
    logger.info('[whatsapp.controller] User has not opted in to WhatsApp; skipping', { userId });
    return;
  }

  const lang = user.preferredLanguage || 'en';
  const plan = (user.subscription && user.subscription.plan) || 'free';
  const isPaid = plan === 'basic' || plan === 'pro' || doc.isPaid === true;

  const tplName = doc.template ? pickName(doc.template, lang) : doc.title || 'Your document';
  const summaryLines = [];
  summaryLines.push(`✅ *${tplName}* is ready!`);
  if (doc.legalCitations && doc.legalCitations.length) {
    summaryLines.push('');
    summaryLines.push('📚 *Legal basis:*');
    doc.legalCitations.slice(0, 3).forEach(c => {
      summaryLines.push(`• ${c.act}, ${c.section}`);
    });
  }
  if (doc.nextSteps && doc.nextSteps.length) {
    summaryLines.push('');
    summaryLines.push('📋 *Next steps:*');
    doc.nextSteps.slice(0, 3).forEach(s => {
      summaryLines.push(`${s.step}. ${s.instruction}`);
    });
  }

  user.whatsappSessionData.phase = 'DOCUMENT_READY';
  user.whatsappSessionData.lastDocumentId = doc._id;
  user.whatsappSessionData.updatedAt = new Date();
  user.markModified('whatsappSessionData');
  await user.save();

  try {
    if (isPaid && doc.pdfUrl) {
      const caption = summaryLines.join('\n') + '\n\n📎 PDF attached below.';
      await whatsappService.sendMediaMessage(user.whatsappNumber, caption, doc.pdfUrl);
    } else {
      const reply = summaryLines.join('\n') + '\n\n' + L('freePdfLocked', lang);
      await whatsappService.sendMessage(user.whatsappNumber, reply);
    }
    logger.info('[whatsapp.controller] notifyDocumentReady sent', { userId, documentId, isPaid });
  } catch (err) {
    logger.error('[whatsapp.controller] notifyDocumentReady send failed', { userId, error: err.message });
  }
}

/* ---------------------------------------------------------------------------
 *                                HELPERS
 * ------------------------------------------------------------------------ */

async function setPhase(user, phase) {
  if (!user.whatsappSessionData) {
    user.whatsappSessionData = {};
  }
  user.whatsappSessionData.phase = phase;
  user.whatsappSessionData.updatedAt = new Date();
  user.markModified('whatsappSessionData');
  await user.save();
}

function prettyCategory(slug) {
  if (!slug) return '';
  return String(slug)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function pickName(templateLike, lang) {
  if (!templateLike) return '';
  const tx = templateLike.nameTranslations;
  if (tx && typeof tx === 'object' && tx[lang]) return tx[lang];
  if (tx && typeof tx.get === 'function') {
    const v = tx.get(lang);
    if (v) return v;
  }
  return templateLike.name || templateLike.slug || '';
}

function buildTwiMLResponse(message, mediaUrl = null) {
  const response = new TwilioTwiml.MessagingResponse();
  if (!message && !mediaUrl) {
    return response.toString();
  }
  const msg = response.message(message || '');
  if (mediaUrl) {
    msg.media(mediaUrl);
  }
  return response.toString();
}

async function sendWhatsAppMessage(to, message, mediaUrl = null) {
  if (mediaUrl) {
    return whatsappService.sendMediaMessage(to, message || '', mediaUrl);
  }
  return whatsappService.sendMessage(to, message);
}

module.exports = {
  handleIncoming,
  processStateMachine,
  sendWhatsAppMessage,
  buildTwiMLResponse,
  notifyDocumentReady,
};

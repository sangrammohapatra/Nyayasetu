const aiProvider = require('./aiProvider');
const { getLegalAidCenter, NALSA_HELPLINE } = require('../../data/legalAidCenters');
const logger = require('../../utils/logger');

// Maps AI-returned category strings to NyayaSetu template slugs
const CATEGORY_TEMPLATE_MAP = {
  'Domestic Violence':      'domestic-violence-complaint',
  'Criminal':               'police-complaint',
  'Consumer':               'consumer-complaint',
  'Property':               'property-dispute',
  'Tenant':                 'tenant-notice',
  'Employment':             'employment-termination',
  'Family/Matrimonial':     null,
  'Cybercrime':             'police-complaint',
  'Financial Fraud':        'police-complaint',
  'Land Acquisition':       'property-dispute',
  'Human Rights':           'police-complaint',
  'Other':                  null,
};

const SYSTEM_PROMPT = `You are NyayaSetu's Legal Emergency Triage AI — a specialized assistant for Indian law.

Your role: analyze a person's description of a legal emergency (written in ANY language — Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, Urdu, or English) and return a structured triage response in English JSON.

OUTPUT — return ONLY valid JSON, no markdown, no explanation:
{
  "urgency": "CRITICAL" | "URGENT" | "MODERATE",
  "detectedLanguage": "<ISO-639-1 code: hi | en | bn | mr | ta | te | gu | kn | ml | pa | ur>",
  "legalCategory": "<exactly one of: Criminal | Domestic Violence | Property | Consumer | Employment | Tenant | Family/Matrimonial | Cybercrime | Financial Fraud | Land Acquisition | Human Rights | Other>",
  "summary": "<2-sentence plain-English summary of the situation>",
  "applicableLaws": [
    {
      "name": "<Full Act name, e.g. Bharatiya Nyaya Sanhita 2023 (BNS)>",
      "section": "<section number, or null>",
      "relevance": "<one sentence why this applies>"
    }
  ],
  "immediateSteps": [
    {
      "order": 1,
      "action": "<imperative sentence — exactly what to DO right now>",
      "deadline": "<time constraint, e.g. 'within 24 hours', or null>",
      "channel": "<where: 'Nearest Police Station' | 'Magistrate Court' | 'Consumer Forum' | 'NALSA Helpline 1516' | 'High Court' | 'Labour Commissioner' | 'Protection Officer' | etc.>"
    }
  ],
  "importantDeadlines": [
    {
      "description": "<what must be done>",
      "timeframe": "<e.g. 'within 30 days of incident'>"
    }
  ],
  "recommendedTemplateSlug": "<one of: domestic-violence-complaint | police-complaint | consumer-complaint | property-dispute | tenant-notice | employment-termination | null>",
  "templateReason": "<one sentence why this template helps, or null>"
}

URGENCY RULES:
- CRITICAL: life at risk, active crime in progress, domestic violence with physical harm, kidnapping, immediate physical threat
- URGENT: legal deadline within 7 days, ongoing harassment, crime within last 48h, eviction notice, wrongful termination effective immediately
- MODERATE: civil dispute, process-heavy situations, ongoing harassment without immediate physical risk

APPLICABLE LAWS — cite real Indian statutes only:
- Criminal matters: BNS 2023 (replaces IPC), BNSS 2023 (replaces CrPC)
- Domestic violence: Protection of Women from Domestic Violence Act 2005 (PWDVA)
- Consumer: Consumer Protection Act 2019
- Property/Land: Transfer of Property Act 1882, Land Acquisition Act 2013
- Employment: Industrial Disputes Act 1947, Payment of Wages Act 1936, POSH Act 2013
- Tenant/Rent: Rent Control Act (state-specific), Transfer of Property Act 1882
- Cybercrime: IT Act 2000, BNS 2023
- Financial fraud: BNS 2023, Prevention of Money Laundering Act 2002

STEPS: Max 5 steps. Make each actionable within hours or days.
DEADLINES: Only include if legally mandated (FIR within 24h for cognizable offences, consumer complaint within 2 years, etc.)
TEMPLATE SLUG: Pick the most relevant or return null.
LANGUAGE DETECTION: Identify language from script/vocabulary even if mixed with English.`;

class AITriageService {
  /**
   * Analyze a legal emergency description and return structured triage.
   * @param {Object} params
   * @param {string} params.description  User's situation in any language
   * @param {string} params.stateCode    Indian state code, e.g. 'MH', 'DL'
   * @param {string} params.language     Hint language ('en', 'hi', etc.)
   * @returns {Promise<Object>}          Triage result with legal aid center
   */
  async analyze({ description, stateCode, language = 'en' }) {
    const userPrompt = `Analyze this legal situation (possibly in ${language} or another Indian language):\n\n"""\n${description}\n"""\n\nReturn the JSON triage response.`;

    let parsed;
    try {
      // Use chat() so SYSTEM_PROMPT is placed in the provider's native system role
      // (Anthropic `system` param / Gemini `systemInstruction`). The user description
      // is in the user message — structurally isolated and unable to override the
      // system instructions regardless of what the user writes.
      const raw = await aiProvider.chat(
        [{ role: 'user', content: userPrompt }],
        SYSTEM_PROMPT,
        false, // stream
        true   // jsonMode — Gemini sets responseMimeType; Claude relies on system prompt
      );
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      logger.error('[AITriageService] AI call or parse failed:', err.message);
      throw err;
    }

    const legalAidCenter = getLegalAidCenter(stateCode);

    // Resolve template slug — prefer AI suggestion, fall back to category map
    const templateSlug =
      parsed.recommendedTemplateSlug ||
      CATEGORY_TEMPLATE_MAP[parsed.legalCategory] ||
      null;

    return {
      urgency:             parsed.urgency             || 'MODERATE',
      detectedLanguage:    parsed.detectedLanguage    || language,
      legalCategory:       parsed.legalCategory       || 'Other',
      summary:             parsed.summary             || '',
      applicableLaws:      Array.isArray(parsed.applicableLaws) ? parsed.applicableLaws : [],
      immediateSteps:      Array.isArray(parsed.immediateSteps) ? parsed.immediateSteps : [],
      importantDeadlines:  Array.isArray(parsed.importantDeadlines) ? parsed.importantDeadlines : [],
      recommendedTemplate: templateSlug
        ? { slug: templateSlug, reason: parsed.templateReason || null }
        : null,
      legalAidCenter,
      nalsaHelpline: NALSA_HELPLINE,
    };
  }
}

module.exports = new AITriageService();

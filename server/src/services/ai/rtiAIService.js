'use strict';

const aiProvider = require('./aiProvider');
const { CENTRAL_MINISTRIES, searchMinistries } = require('../../data/rtiMinistries');
const logger = require('../../utils/logger');

const SYSTEM_PROMPT = `You are NyayaSetu's RTI Assistant — an expert in the Right to Information Act, 2005 (India).

Your job: Given a citizen's plain-language description of what information they need from the government, generate a precise, legally-formatted RTI application.

OUTPUT — return ONLY valid JSON, no markdown, no explanation:
{
  "title": "<short descriptive title for this RTI, e.g. 'Status of PF withdrawal application'>",
  "suggestedMinistryId": "<ID from the ministry list, or null if state-level>",
  "suggestedMinistryName": "<Full ministry/department name>",
  "govLevel": "central" | "state",
  "stateName": "<state name if govLevel is state, else null>",
  "subjects": [
    "<RTI Question 1 — specific, factual, clearly worded>",
    "<RTI Question 2>",
    ...
  ],
  "feeAmount": 10,
  "applicableSections": [
    "<e.g. Section 6(1) of RTI Act, 2005 — Application>",
    "<e.g. Section 7(1) — 30-day response obligation>"
  ],
  "tipsForUser": "<1-2 sentences of advice for this specific RTI, e.g. what documents to attach, which office to address>",
  "urgencyNote": "<null or short note if there's a special 48-hour provision (life/liberty cases)>"
}

RULES FOR RTI QUESTIONS:
1. Questions must be SPECIFIC and FACTUAL — ask for records, files, decisions, dates, amounts
2. Never ask for opinions — RTI is for existing records, not new analysis
3. Each question should be self-contained and numbered implicitly
4. Max 8-10 questions — too many dilutes focus
5. Use formal language: "Please provide...", "Kindly furnish...", "Please share certified copies of..."
6. Standard questions to always include where relevant:
   - The action taken / current status of [specific matter]
   - Copies of all file notings, orders, communications related to [matter]
   - Names and designations of officials responsible
   - Timeline/dates of each step taken
7. For delayed government actions, always include: "Reasons for delay in processing [matter]"

MINISTRY SELECTION RULES:
- Central Government: Choose from the provided ministry list
- State matters (municipal, police, RTO, school, hospital, RERA property issues, land records): govLevel = "state"
- PF/EPF: Ministry of Labour & Employment (EPFO)
- Passport: Ministry of External Affairs
- Income Tax: Ministry of Finance (CBDT)
- GST: Ministry of Finance (CBIC)
- NREGA/Rural Development: Ministry of Rural Development
- Aadhaar: MeitY / UIDAI
- Bank Nationalised: Ministry of Finance
- Railways: Ministry of Railways
- Postal: Ministry of Communications

IMPORTANT DEADLINES (mention in urgencyNote if applicable):
- Standard: 30 days to respond
- Life/Liberty issues: 48 hours
- Third-party information: 40 days
- Transferred applications: 30 days from transfer

Available Ministry IDs: ${CENTRAL_MINISTRIES.map((m) => `${m.id} (${m.name})`).join(', ')}`;

class RTIAIService {
  /**
   * Draft an RTI application from a plain-language description.
   * @param {Object} params
   * @param {string} params.description — what the citizen wants to find out
   * @param {string} params.language — hint language ('en', 'hi', etc.)
   * @param {Object} params.applicantDetails — name, address, phone
   * @returns {Promise<Object>} — structured RTI draft
   */
  async draftApplication({ description, language = 'en', applicantDetails = {} }) {
    const userPrompt = `Citizen's request (may be in any Indian language — respond in English JSON):
"""
${description}
"""

Generate a precise RTI application with specific questions to obtain the information they need.`;

    let parsed;
    try {
      // Use chat() so SYSTEM_PROMPT is placed in the provider's native system role
      // (Anthropic `system` param / Gemini `systemInstruction`), structurally isolated
      // from the citizen's free-text description — instead of concatenating both into
      // a single generate() prompt, which gives prompt-injection text no barrier.
      const raw = await aiProvider.chat(
        [{ role: 'user', content: userPrompt }],
        SYSTEM_PROMPT,
        false, // stream
        true   // jsonMode
      );
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      logger.error('[RTIAIService] AI call or parse failed:', err.message);
      throw err;
    }

    // Enrich with ministry details from our data
    const ministryData = parsed.suggestedMinistryId
      ? CENTRAL_MINISTRIES.find((m) => m.id === parsed.suggestedMinistryId)
      : null;

    return {
      title:               parsed.title || 'RTI Application',
      govLevel:            parsed.govLevel || 'central',
      stateName:           parsed.stateName || null,
      ministry:            ministryData?.name || parsed.suggestedMinistryName || '',
      ministryId:          parsed.suggestedMinistryId || null,
      pioDesignation:      ministryData?.pioDesignation || 'Public Information Officer',
      pioAddress:          ministryData?.address || '',
      pioEmail:            ministryData?.email || '',
      subjects:            Array.isArray(parsed.subjects) ? parsed.subjects : [],
      feeAmount:           parsed.feeAmount || 10,
      applicableSections:  Array.isArray(parsed.applicableSections) ? parsed.applicableSections : [],
      tipsForUser:         parsed.tipsForUser || null,
      urgencyNote:         parsed.urgencyNote || null,
      aiDrafted:           true,
    };
  }

  /**
   * Generate a First Appeal letter when PIO has not responded or responded unsatisfactorily.
   * @param {Object} rti — the RTI application document
   * @returns {Promise<Object>} — first appeal content
   */
  async draftFirstAppeal(rti) {
    const prompt = `You are an RTI expert. Generate a First Appeal letter under Section 19(1) of the RTI Act, 2005.

RTI Application Details:
- Ministry/Department: ${rti.ministry}
- PIO Address: ${rti.pioAddress}
- Filed Date: ${rti.filedDate ? new Date(rti.filedDate).toLocaleDateString('en-IN') : 'Unknown'}
- Reference Number: ${rti.referenceNumber || 'Not yet received'}
- Questions asked: ${rti.subjects.join('; ')}
- Situation: ${rti.responseDate ? 'Response received but unsatisfactory' : 'No response received within 30 days'}
${rti.responseText ? `- PIO Response Summary: ${rti.responseText.substring(0, 500)}` : ''}

Return ONLY valid JSON:
{
  "appealBody": "<Full formal first appeal letter text, properly formatted, citing Section 19(1) of RTI Act 2005>",
  "groundsOfAppeal": ["<ground 1>", "<ground 2>", ...],
  "reliefSought": "<what the appellant wants the FAA to order>"
}`;

    try {
      const raw = await aiProvider.generate(prompt, true);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        appealBody:      parsed.appealBody || '',
        groundsOfAppeal: Array.isArray(parsed.groundsOfAppeal) ? parsed.groundsOfAppeal : [],
        reliefSought:    parsed.reliefSought || 'Direct PIO to provide all requested information within 15 days',
      };
    } catch (err) {
      logger.error('[RTIAIService] First appeal draft failed:', err.message);
      throw err;
    }
  }

  /**
   * Generate a Second Appeal / CIC complaint letter.
   * @param {Object} rti — the RTI application document
   * @returns {Promise<Object>} — CIC appeal content
   */
  async draftCICAppeal(rti) {
    const prompt = `You are an RTI expert. Generate a Second Appeal complaint to the Central Information Commission (CIC) under Section 19(3) of the RTI Act, 2005.

RTI Application Details:
- Ministry/Department: ${rti.ministry}
- RTI Reference: ${rti.referenceNumber || 'N/A'}
- Filed Date: ${rti.filedDate ? new Date(rti.filedDate).toLocaleDateString('en-IN') : 'Unknown'}
- First Appeal Date: ${rti.firstAppealFiledDate ? new Date(rti.firstAppealFiledDate).toLocaleDateString('en-IN') : 'N/A'}
- First Appeal Reference: ${rti.firstAppealReferenceNumber || 'N/A'}
- First Appeal Result: ${rti.firstAppealDecisionText || 'No decision / unsatisfactory'}
- Questions asked: ${rti.subjects.join('; ')}

Return ONLY valid JSON:
{
  "complaintBody": "<Full formal CIC appeal text citing Section 19(3), summarizing facts, grounds, and relief>",
  "groundsForCIC": ["<ground 1>", "<ground 2>", ...],
  "reliefFromCIC": "<what the appellant wants CIC to direct>"
}`;

    try {
      const raw = await aiProvider.generate(prompt, true);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return {
        complaintBody:  parsed.complaintBody || '',
        groundsForCIC:  Array.isArray(parsed.groundsForCIC) ? parsed.groundsForCIC : [],
        reliefFromCIC:  parsed.reliefFromCIC || 'Direct the CPIO to provide complete information and impose penalty under Section 20 of RTI Act',
      };
    } catch (err) {
      logger.error('[RTIAIService] CIC appeal draft failed:', err.message);
      throw err;
    }
  }
}

module.exports = new RTIAIService();

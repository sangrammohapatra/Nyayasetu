const aiProvider = require('./aiProvider');
const logger     = require('../../utils/logger');

// ─── Indian Kanoon URL builder ────────────────────────────────────────────────

const INDIAN_KANOON_BASE = 'https://indiankanoon.org/search/?formInput=';

/**
 * buildKanoonUrl — construct a search URL for a given act + section.
 * Used in legalCitations so users can verify every cited law.
 *
 * @param {string} actName    — e.g. "Consumer Protection Act, 2019"
 * @param {string} section    — e.g. "Section 35"
 */
function buildKanoonUrl(actName, section) {
  const query = section
    ? `${section} ${actName}`
    : actName;
  return `${INDIAN_KANOON_BASE}${encodeURIComponent(query)}`;
}

// ─── System prompt builder ────────────────────────────────────────────────────

/**
 * buildUserDataMessage — the citizen-controlled free text collected via the
 * chat session. Kept structurally separate from buildDocumentSystemPrompt's
 * instructions (own user-role message, not concatenated into the instruction
 * string) so prompt-injection text typed into a question answer has no
 * structural path to being treated as an instruction.
 *
 * @param {object} session   — ChatSession (has collectedData)
 * @param {object} template  — DocumentTemplate (for question labels)
 */
function buildUserDataMessage(session, template) {
  const collectedData = session.toCollectedDataObject
    ? session.toCollectedDataObject()
    : (session.collectedData instanceof Map
        ? Object.fromEntries(session.collectedData)
        : session.collectedData || {});

  const dataContext = Object.entries(collectedData)
    .map(([k, v]) => {
      const question = (template.questionFlow || []).find((q) => q.key === k);
      const label    = question?.label || k.replace(/_/g, ' ');
      return `  ${label}: ${v}`;
    })
    .join('\n');

  return `=== USER INFORMATION (collected via conversation) ===
${dataContext || '(No data collected)'}

Generate the document JSON now, following the system instructions exactly.`;
}

/**
 * buildDocumentSystemPrompt — constructs the full document generation
 * instructions (jurisdiction, applicable laws, output format/quality rules).
 * Contains no citizen-supplied free text — see buildUserDataMessage for that.
 *
 * This is the most important prompt in NyayaSetu — it must produce a
 * jurisdiction-aware, citation-rich, professionally formatted legal document.
 *
 * @param {object} session           — ChatSession (has userState, userLanguage)
 * @param {object} template          — DocumentTemplate
 * @param {object} jurisdictionRule  — JurisdictionRule for state+docType (may be null)
 * @param {Array}  legalActSections  — Array of { act, sections[] } from LegalAct
 */
function buildDocumentSystemPrompt(session, template, jurisdictionRule, legalActSections) {
  const state    = session.userState    || 'India';
  const language = session.userLanguage || 'en';
  const today    = new Date().toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  // ── Jurisdiction context ─────────────────────────────────────────────────
  const filingAuthority = jurisdictionRule?.filingAuthority
    ? `${jurisdictionRule.filingAuthority.name}${jurisdictionRule.filingAuthority.address ? `, ${jurisdictionRule.filingAuthority.address}` : ''}`
    : `Appropriate authority in ${state}`;

  const filingFeeText = jurisdictionRule?.filingFee?.notes
    || (jurisdictionRule?.filingFee?.amount
        ? `₹${jurisdictionRule.filingFee.amount / 100}`
        : 'As applicable');

  const limitationText = jurisdictionRule?.limitationPeriod?.days
    ? `${jurisdictionRule.limitationPeriod.days} days from ${jurisdictionRule.limitationPeriod.fromEvent || 'the incident'}`
    : 'As per applicable law';

  const courtHierarchy = jurisdictionRule?.courtHierarchy?.length
    ? jurisdictionRule.courtHierarchy
        .sort((a, b) => a.level - b.level)
        .map((c) => `  Level ${c.level}: ${c.name} (${c.jurisdiction || 'general jurisdiction'})`)
        .join('\n')
    : `  District court system in ${state}`;

  // ── Applicable acts and sections ─────────────────────────────────────────
  const actsContext = (legalActSections || []).map((actData) => {
    const act      = actData.act || actData;
    const sections = actData.sections || act.sections || [];

    const sectionText = sections.slice(0, 8).map((s) =>
      `  Section ${s.number}${s.title ? ` — ${s.title}` : ''}: ${(s.text || '').slice(0, 400)}${s.text?.length > 400 ? '…' : ''}`
    ).join('\n');

    return `ACT: ${act.fullName || act.shortName} (${act.year || 'Year N/A'})
Type: ${act.type === 'state' ? `State Act (${act.applicableState})` : 'Central Act'}
Relevant Sections:
${sectionText || '  (No specific sections loaded)'}`;
  }).join('\n\n---\n\n');

  // ── Document language instruction ─────────────────────────────────────────
  const langInstruction = language !== 'en'
    ? `\n\nLANGUAGE: The document text must be in formal English (standard for Indian courts), but clauseExplanations and nextSteps[].instruction should be provided in BOTH English AND the user's language (${language}). Use simple, clear language in explanations.`
    : '';

  // ── Additional template-specific instructions ─────────────────────────────
  const templateAddendum = template.systemPromptAddendum
    ? `\n\nTEMPLATE-SPECIFIC INSTRUCTIONS:\n${template.systemPromptAddendum}`
    : '';

  return `You are NyayaSetu's legal document drafting engine. Generate a complete, professional, jurisdiction-aware Indian legal document.

=== DOCUMENT TYPE ===
${template.name}
Category: ${template.category}
Complexity: ${template.complexity}

=== JURISDICTION ===
State/UT: ${state}
Filing Authority: ${filingAuthority}
Filing Fee: ${filingFeeText}
Limitation Period: ${limitationText}
Court Hierarchy:
${courtHierarchy}

=== APPLICABLE LAWS AND SECTIONS ===
${actsContext || '(No specific acts loaded — apply general Indian law principles)'}

=== DOCUMENT DATE ===
${today}

${template.outputFormat?.includeWitnesses ? '=== FORMAT: Include space for 2 witnesses ===' : ''}
${template.outputFormat?.includeNotary ? '=== FORMAT: Include notary attestation section ===' : ''}
${langInstruction}${templateAddendum}

=== CRITICAL OUTPUT REQUIREMENTS ===
Respond with ONLY a valid JSON object in this EXACT structure (no markdown, no explanation):

{
  "documentText": "The complete formal legal document as a single string. Use \\n for line breaks. Include proper salutation, body paragraphs citing specific law sections, prayer/relief sought, and signature block. Must be ready to print and file.",
  "legalCitations": [
    {
      "act": "Full name of the act",
      "section": "Section number and title",
      "description": "One sentence explaining why this section is relevant to this specific case",
      "url": "Indian Kanoon search URL for this section"
    }
  ],
  "clauseExplanations": [
    {
      "clauseIndex": 0,
      "clauseText": "First ~100 characters of the paragraph this explains",
      "explanation": "Plain English explanation of what this clause means for the user",
      "explanationHi": "Same explanation in Hindi (Devanagari script)"
    }
  ],
  "nextSteps": [
    {
      "step": 1,
      "instruction": "Exact actionable instruction",
      "authority": "Name of the office/court to approach",
      "fee": "Exact fee if known, otherwise 'As applicable'",
      "timelineExpected": "Realistic timeline",
      "onlineLink": "Official government portal URL if available, otherwise null"
    }
  ]
}

DOCUMENT QUALITY STANDARDS:
- Cite SPECIFIC sections (e.g. "Section 35(1)(a) of the Consumer Protection Act, 2019")
- Use the user's actual names, dates, amounts — not placeholders
- The prayer/relief section must request SPECIFIC remedies with INR amounts where applicable
- Tone: formal, authoritative, professional — this will be filed with an Indian court or authority
- clauseExplanations: cover every substantive paragraph (minimum 5, maximum 15)
- nextSteps: provide 3–7 concrete, actionable steps specific to ${state}
- legalCitations: minimum 3 citations, maximum 10`;
}

// ─── JSON validation ───────────────────────────────────────────────────────────

/**
 * validateDocumentJson — checks that the AI response has all required fields
 * and sensible lengths. Throws a descriptive error if validation fails.
 */
function validateDocumentJson(parsed) {
  const errors = [];

  if (typeof parsed.documentText !== 'string' || parsed.documentText.length < 200) {
    errors.push('documentText is missing or too short (min 200 chars)');
  }

  if (!Array.isArray(parsed.legalCitations) || parsed.legalCitations.length === 0) {
    errors.push('legalCitations must be a non-empty array');
  }

  if (!Array.isArray(parsed.clauseExplanations) || parsed.clauseExplanations.length === 0) {
    errors.push('clauseExplanations must be a non-empty array');
  }

  if (!Array.isArray(parsed.nextSteps) || parsed.nextSteps.length === 0) {
    errors.push('nextSteps must be a non-empty array');
  }

  if (errors.length > 0) {
    throw new Error(`Document JSON validation failed: ${errors.join('; ')}`);
  }
}

// ─── Post-process citations ────────────────────────────────────────────────────

/**
 * enrichCitations — add Indian Kanoon URLs where the AI didn't provide one.
 */
function enrichCitations(citations) {
  return (citations || []).map((c) => ({
    ...c,
    url: c.url || buildKanoonUrl(c.act, c.section),
  }));
}

// ─── generateDocument ─────────────────────────────────────────────────────────

/**
 * generateDocument — the primary function called by the document controller.
 *
 * Builds the prompt, calls the AI in JSON mode, validates the output,
 * and returns the enriched document structure.
 *
 * @param {object} session           — ChatSession document
 * @param {object} template          — DocumentTemplate document
 * @param {object} jurisdictionRule  — JurisdictionRule (may be null)
 * @param {Array}  legalActSections  — Relevant LegalAct documents with sections
 * @returns {Promise<{
 *   documentText:       string,
 *   legalCitations:     Array,
 *   clauseExplanations: Array,
 *   nextSteps:          Array,
 * }>}
 */
async function generateDocument(session, template, jurisdictionRule, legalActSections) {
  const systemPrompt = buildDocumentSystemPrompt(session, template, jurisdictionRule, legalActSections);
  const userMessage  = buildUserDataMessage(session, template);

  logger.info(`[documentEngine] Generating document: ${template.slug}, state: ${session.userState}, session: ${session._id}`);
  logger.debug(`[documentEngine] System prompt length: ${systemPrompt.length} chars`);

  // Use chat() so systemPrompt is placed in the provider's native system role,
  // structurally isolated from the citizen's collected answers in userMessage —
  // instead of concatenating both into a single generate() prompt, which gives
  // prompt-injection text in a question answer no structural barrier.
  const callAI = async (extraInstruction = '') => {
    const content = extraInstruction ? `${userMessage}\n\n${extraInstruction}` : userMessage;
    const raw = await aiProvider.chat(
      [{ role: 'user', content }],
      systemPrompt,
      false, // stream
      true   // jsonMode
    );
    const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
    const cleaned = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    return JSON.parse(cleaned);
  };

  // ── First attempt ─────────────────────────────────────────────────────────
  let parsed;

  try {
    parsed = await callAI();
    validateDocumentJson(parsed);
  } catch (firstErr) {
    logger.warn(`[documentEngine] First attempt failed: ${firstErr.message}. Retrying with stricter prompt…`);

    // ── Retry with a stricter, more explicit reminder ──────────────────────
    const reminder = `REMINDER: Your previous response could not be parsed as valid JSON.
You MUST respond with ONLY a raw JSON object.
DO NOT include any text before the opening { or after the closing }.
DO NOT use markdown code fences.
DO NOT include comments.
The response must be directly parseable by JSON.parse() with zero modifications.`;

    try {
      parsed = await callAI(reminder);
      validateDocumentJson(parsed);
    } catch (secondErr) {
      logger.error(`[documentEngine] Both attempts failed for session ${session._id}`, {
        firstError:  firstErr.message,
        secondError: secondErr.message,
        templateSlug: template.slug,
      });
      throw new Error(
        `Document generation failed after 2 attempts. Last error: ${secondErr.message}`
      );
    }
  }

  // ── Enrich citations with Indian Kanoon URLs ───────────────────────────────
  parsed.legalCitations = enrichCitations(parsed.legalCitations);

  // ── Normalise nextSteps ───────────────────────────────────────────────────
  parsed.nextSteps = (parsed.nextSteps || []).map((step, i) => ({
    step:             step.step ?? i + 1,
    instruction:      step.instruction || '',
    authority:        step.authority || '',
    fee:              step.fee || 'As applicable',
    timelineExpected: step.timelineExpected || 'Varies',
    onlineLink:       step.onlineLink || null,
  }));

  logger.info(`[documentEngine] Document generated successfully: ${parsed.documentText.length} chars, ${parsed.legalCitations.length} citations, ${parsed.nextSteps.length} next steps`);

  return {
    documentText:       parsed.documentText,
    legalCitations:     parsed.legalCitations,
    clauseExplanations: parsed.clauseExplanations,
    nextSteps:          parsed.nextSteps,
  };
}

// ─── Pass 2: Self-review prompt ───────────────────────────────────────────────

/**
 * buildReviewPrompt — constructs the review prompt for Pass 2.
 * The reviewer AI sees the generated document and checks it against the
 * user's submitted data and jurisdiction context.
 */
function buildReviewPrompt(documentText, session, template, jurisdictionRule) {
  const collectedData = session.toCollectedDataObject
    ? session.toCollectedDataObject()
    : (session.collectedData instanceof Map
        ? Object.fromEntries(session.collectedData)
        : session.collectedData || {});

  const state = session.userState || 'India';

  const filingAuthority = jurisdictionRule?.filingAuthority
    ? `${jurisdictionRule.filingAuthority.name}${jurisdictionRule.filingAuthority.address ? `, ${jurisdictionRule.filingAuthority.address}` : ''}`
    : `Appropriate authority in ${state}`;

  const limitationText = jurisdictionRule?.limitationPeriod?.days
    ? `${jurisdictionRule.limitationPeriod.days} days from ${jurisdictionRule.limitationPeriod.fromEvent || 'the incident'}`
    : 'As per applicable law';

  const dataContext = Object.entries(collectedData)
    .map(([k, v]) => {
      const question = (template.questionFlow || []).find((q) => q.key === k);
      const label    = question?.label || k.replace(/_/g, ' ');
      return `  ${label}: ${v}`;
    })
    .join('\n');

  return `You are a senior Indian legal document reviewer. Review the AI-generated document below for quality issues. Do NOT rewrite or rephrase it — only identify problems.

=== DOCUMENT TYPE ===
${template.name} (${template.category})

=== USER'S SUBMITTED DATA ===
${dataContext || '(No data collected)'}

=== JURISDICTION ===
State/UT: ${state}
Filing Authority: ${filingAuthority}
Limitation Period: ${limitationText}

=== GENERATED DOCUMENT ===
${documentText}

=== REVIEW CHECKLIST ===
1. COMPLETENESS — Are all required sections present?
   Parties (complainant + respondent with full details), statement of facts, legal grounds, specific relief/prayer, date, place, signature block.

2. JURISDICTION ACCURACY — Is the document correct for ${state}?
   Named filing authority matches this state and document type. Cited courts are appropriate. Limitation period is correctly applied. State-specific procedural rules followed.

3. MISSING DETAILS — Are any fields still generic or unfilled?
   Look for placeholder text like [NAME], [DATE], [AMOUNT], ___, "Insert here", "your name", or generic values that should have been replaced with the user's actual submitted data.

4. UNCERTAIN LEGAL POSITIONS — Are there claims that:
   May be contested or hard to prove, cite sections out of context, overstate the remedy, or a layperson might misread as a guaranteed outcome?

Respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "passed": true,
  "overallConfidence": "high",
  "summary": "One-sentence overall quality assessment",
  "issues": [
    {
      "category": "completeness|jurisdiction|missing_details|uncertain",
      "severity": "critical|warning|info",
      "description": "Specific description — mention the exact section or phrase if possible",
      "suggestion": "Actionable suggestion to fix this issue"
    }
  ]
}

RULES:
- "passed": false only when critical issues are present (placeholder text, wrong jurisdiction, missing required section)
- "critical" = document should not be filed as-is
- "warning" = recommend review before filing
- "info" = minor awareness note
- Maximum 8 issues total — flag the most impactful ones only
- If no issues found, return "passed": true, "issues": [], "overallConfidence": "high"`;
}

/**
 * validateReviewJson — minimal validation of the review AI response.
 */
function validateReviewJson(parsed) {
  if (typeof parsed.passed !== 'boolean') {
    throw new Error('Review JSON missing "passed" boolean');
  }
  if (!['high', 'medium', 'low'].includes(parsed.overallConfidence)) {
    throw new Error('Review JSON missing valid "overallConfidence"');
  }
  if (!Array.isArray(parsed.issues)) {
    throw new Error('Review JSON missing "issues" array');
  }
}

// ─── reviewDocument ────────────────────────────────────────────────────────────

/**
 * reviewDocument — Pass 2 of the generation pipeline.
 *
 * Makes a second AI call to self-review the generated document against the
 * user's submitted data and jurisdiction context. Returns structured issues
 * (completeness, jurisdiction, missing details, uncertain positions) or null
 * if the review call itself fails (non-blocking).
 *
 * @param {string} documentText      — The Pass 1 generated document text
 * @param {object} session           — ChatSession (collectedData, userState)
 * @param {object} template          — DocumentTemplate
 * @param {object} jurisdictionRule  — JurisdictionRule (may be null)
 * @returns {Promise<object|null>}
 */
async function reviewDocument(documentText, session, template, jurisdictionRule) {
  const prompt = buildReviewPrompt(documentText, session, template, jurisdictionRule);

  logger.info(`[documentEngine] Pass 2 review: ${template.slug}, session: ${session._id}`);

  try {
    const parsed = await aiProvider.generate(prompt, true);
    validateReviewJson(parsed);

    const validCategories = ['completeness', 'jurisdiction', 'missing_details', 'uncertain'];
    const validSeverities = ['critical', 'warning', 'info'];

    const result = {
      passed:            parsed.passed,
      overallConfidence: parsed.overallConfidence,
      summary:           String(parsed.summary || '').slice(0, 300),
      issues: (parsed.issues || [])
        .filter((issue) =>
          validCategories.includes(issue.category) &&
          validSeverities.includes(issue.severity)
        )
        .slice(0, 8)
        .map((issue) => ({
          category:    issue.category,
          severity:    issue.severity,
          description: String(issue.description || '').slice(0, 500),
          suggestion:  String(issue.suggestion  || '').slice(0, 300),
        })),
      reviewedAt: new Date(),
    };

    logger.info(`[documentEngine] Review done: passed=${result.passed}, issues=${result.issues.length}, confidence=${result.overallConfidence}`);
    return result;

  } catch (err) {
    // Review is a best-effort pass — failure must never block document delivery
    logger.warn(`[documentEngine] Pass 2 review failed (non-blocking): ${err.message}`);
    return null;
  }
}

module.exports = {
  generateDocument,
  reviewDocument,
  buildDocumentSystemPrompt,
  buildUserDataMessage,
  buildKanoonUrl,
};

/**
 * AI Chat Service — generates contextual AI responses for legal Q&A
 * Provider-agnostic abstraction: Gemini (dev) or Claude (prod)
 * Features:
 * - Jurisdiction-aware responses using JurisdictionRule
 * - Case/document context injection
 * - Real Indian law citations with links
 * - Plain language + legal language in same response
 * - Language-aware response formatting
 */

const aiProvider = require('./aiProvider');
const JurisdictionRule = require('../models/JurisdictionRule');
const LegalAct = require('../models/LegalAct');
const logger = require('../../utils/logger');

class AIChatService {
  /**
   * Generate response for citizen/lawyer query
   * @param {Object} params
   * @param {String} params.userQuery - the user's question
   * @param {String} params.jurisdiction - state code (e.g., 'DL', 'MH')
   * @param {String} params.language - 'en', 'hi', etc.
   * @param {String} params.persona - 'citizen' or 'lawyer'
   * @param {Object} params.context - { linkedDocuments, linkedCases, chatHistory }
   * @returns {Promise<{ response, citations, suggestions, nextQuestions }>}
   */
  async generateChatResponse(params) {
    const {
      userQuery,
      jurisdiction,
      language = 'en',
      persona = 'citizen',
      context = {},
    } = params;

    try {
      // 1. Build system prompt with jurisdiction context
      const systemPrompt = await this.buildSystemPrompt({
        jurisdiction,
        language,
        persona,
        context,
      });

      // 2. Call AI provider with streaming support
      const aiResponse = await aiProvider.chat(
        [{ role: 'user', content: userQuery }],
        systemPrompt
      );

      // 3. Parse AI response for citations & suggestions
      const parsed = this.parseAIResponse(aiResponse, language);

      // 4. Fetch real Indian law citations if mentioned
      const citations = await this.enrichWithLegalCitations(parsed.mentionedActs, jurisdiction);

      // 5. Generate follow-up questions for deeper engagement
      const nextQuestions = await this.generateFollowUpQuestions(userQuery, language, persona);

      logger.info('Chat response generated', {
        userId: context.userId,
        jurisdiction,
        tokenCount: aiResponse.length,
      });

      return {
        response: parsed.mainResponse,
        plainLanguageExplanation: parsed.plainLanguageExplanation,
        citations,
        nextQuestions,
        suggestedDocuments: parsed.suggestedDocumentTemplates,
      };
    } catch (error) {
      logger.error('AI chat generation failed', { error: error.message, userQuery });
      throw new Error('Failed to generate response. Please try again.');
    }
  }

  /**
   * Build jurisdiction-aware system prompt
   */
  async buildSystemPrompt(params) {
    const { jurisdiction, language, persona, context } = params;

    // Fetch applicable laws for this jurisdiction
    const jurisdictionRules = await JurisdictionRule.find({ state: jurisdiction }).limit(5);
    const applicableActs = [...new Set(jurisdictionRules.flatMap((r) => r.applicableActs))];

    // Fetch full text of these acts
    const acts = await LegalAct.find({ _id: { $in: applicableActs } });

    const actSummaries = acts.map((a) => `${a.shortName} (${a.year})`).join(', ');

    const isHindi = language === 'hi';

    const basePrompt = `You are NyayaSetu, an expert legal assistant for Indian law. 
Your role is to help ${persona === 'citizen' ? 'ordinary citizens' : 'legal professionals'} understand their rights under Indian law.

JURISDICTION: ${jurisdiction} (State laws + Central laws)
APPLICABLE LAWS: ${actSummaries}

CRITICAL RULES:
1. ALWAYS cite specific Indian law sections (e.g., "Section 138, Negotiable Instruments Act 1881")
2. ALWAYS explain complex legal terms in PLAIN LANGUAGE (even if responding in ${language})
3. Include court precedents from Indian Kanoon when relevant
4. For ${persona === 'citizen' ? 'procedural steps, suggest filing authority, fees, and expected timelines' : 'case analysis, provide legal precedents and statute references'}
5. Format citations as: [ACT_NAME Section XX](https://indiankanoon.org/...) with full working URL
6. NEVER provide definitive legal advice; always suggest consulting a local lawyer
7. If query involves sensitive personal data (names, addresses), respond generically with "[SENSITIVE_DATA]"
8. For Rupee amounts, always show both numbers and figures (e.g., "Rupees five thousand (₹5,000)")

${isHindi ? 'कृपया हिंदी में जवाब दें। कानूनी शब्दों को सरल हिंदी में समझाएं।' : ''}

CONTEXT FROM USER PROFILE:
${context.linkedDocuments?.length ? `- User has generated ${context.linkedDocuments.length} documents on NyayaSetu` : '- First-time user'}
${context.linkedCases?.length ? `- User is tracking ${context.linkedCases.length} court case(s)` : ''}
${context.recentQuestions?.length ? `- Recent questions: ${context.recentQuestions.slice(0, 3).join('; ')}` : ''}

Respond in JSON format with these exact keys:
{
  "mainResponse": "primary answer with legal citations",
  "plainLanguageExplanation": "ELI5 version without legal jargon",
  "mentionedActs": ["act_id_1", "act_id_2"],
  "suggestedDocumentTemplates": ["template_slug_1", "template_slug_2"],
  "followUpPrompt": "optional: if user should provide more info for accurate answer"
}`;

    return basePrompt;
  }

  /**
   * Parse AI response (expect JSON)
   */
  parseAIResponse(aiResponse, language) {
    try {
      // Try to extract JSON if wrapped in markdown
      let jsonStr = aiResponse;
      const jsonMatch = aiResponse.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      return {
        mainResponse: parsed.mainResponse || aiResponse,
        plainLanguageExplanation: parsed.plainLanguageExplanation || '',
        mentionedActs: parsed.mentionedActs || [],
        suggestedDocumentTemplates: parsed.suggestedDocumentTemplates || [],
      };
    } catch (e) {
      // Fallback: treat entire response as main response
      logger.warn('Failed to parse AI JSON response, treating as plain text', {
        preview: aiResponse.slice(0, 100),
      });
      return {
        mainResponse: aiResponse,
        plainLanguageExplanation: '',
        mentionedActs: [],
        suggestedDocumentTemplates: [],
      };
    }
  }

  /**
   * Enrich response with real Indian law citations
   */
  async enrichWithLegalCitations(actIds, jurisdiction) {
    if (!actIds || actIds.length === 0) {
      return [];
    }

    try {
      const acts = await LegalAct.find({ shortName: { $in: actIds } });

      const citations = [];
      for (const act of acts) {
        citations.push({
          act: act.shortName,
          year: act.year,
          fullName: act.fullName,
          url: `https://indiankanoon.org/act/${act._id}`,
          type: act.type, // 'central' or 'state'
        });
      }

      return citations;
    } catch (error) {
      logger.error('Failed to enrich citations', { error: error.message });
      return [];
    }
  }

  /**
   * Generate follow-up questions to deepen engagement
   */
  async generateFollowUpQuestions(userQuery, language, persona) {
    // Hardcoded follow-ups based on query context
    // In production, could use AI to generate these dynamically

    const followUps = {
      en: {
        citizen: [
          'What is the timeline for filing this complaint?',
          'Are there any court fees I need to pay?',
          'Can I request legal aid if I cannot afford a lawyer?',
          'What documents do I need to submit?',
        ],
        lawyer: [
          'What is the applicable statute of limitations?',
          'Are there precedents from this court?',
          'What is the procedural history?',
          'What compensation can be claimed?',
        ],
      },
      hi: {
        citizen: [
          'इस शिकायत को दर्ज करने के लिए कितना समय लगता है?',
          'मुझे अदालत की फीस देनी होगी?',
          'क्या मैं कानूनी सहायता का अनुरोध कर सकता हूं?',
          'मुझे कौन से दस्तावेज जमा करने हैं?',
        ],
        lawyer: [
          'लागू सीमा अवधि क्या है?',
          'इस अदालत के पूर्वज हैं?',
          'प्रक्रियात्मक इतिहास क्या है?',
          'क्षतिपूर्ति की मांग की जा सकती है?',
        ],
      },
    };

    const questionsForLanguage = followUps[language] || followUps.en;
    const questionsForPersona = questionsForLanguage[persona] || questionsForLanguage.citizen;

    // Return 3 random questions
    return questionsForPersona.sort(() => 0.5 - Math.random()).slice(0, 3);
  }

  /**
   * Generate response as SSE stream (for real-time UI updates)
   * @param {AsyncIterable} streamResponse from AI provider
   * @param {Response} res Express response object
   */
  async streamChatResponse(streamResponse, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      let buffer = '';

      for await (const chunk of streamResponse) {
        buffer += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      // Send final parsed response
      const parsed = this.parseAIResponse(buffer, 'en');
      res.write(
        `data: ${JSON.stringify({ complete: true, parsed })}\n\n`
      );
    } catch (error) {
      res.write(
        `data: ${JSON.stringify({ error: error.message })}\n\n`
      );
    } finally {
      res.end();
    }
  }

  /**
   * Generate contextual suggestions for document templates
   */
  async suggestDocuments(userQuery, jurisdiction, persona) {
    const keywords = userQuery.toLowerCase();
    const DocumentTemplate = require('../models/DocumentTemplate');

    try {
      let matchedTemplates = [];

      if (keywords.includes('notice') || keywords.includes('landlord')) {
        matchedTemplates = await DocumentTemplate.find({ slug: /notice|eviction/ });
      } else if (keywords.includes('consumer')) {
        matchedTemplates = await DocumentTemplate.find({ slug: /consumer/ });
      } else if (keywords.includes('rti')) {
        matchedTemplates = await DocumentTemplate.find({ slug: /rti/ });
      } else if (keywords.includes('employment') || keywords.includes('termination')) {
        matchedTemplates = await DocumentTemplate.find({
          slug: /employment|labour/,
        });
      } else if (keywords.includes('divorce') || keywords.includes('maintenance')) {
        matchedTemplates = await DocumentTemplate.find({ slug: /divorce|family/ });
      }

      return matchedTemplates.map((t) => ({
        slug: t.slug,
        title: t.title,
        category: t.category,
        complexity: t.complexity,
        price: t.pricePayPerDoc,
      }));
    } catch (error) {
      logger.error('Failed to suggest documents', { error: error.message });
      return [];
    }
  }
}

module.exports = new AIChatService();

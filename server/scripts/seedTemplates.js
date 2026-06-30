/**
 * scripts/seedTemplates.js
 *
 * Seeds 21 DocumentTemplate records.
 * Run: node scripts/seedTemplates.js
 * Safe to re-run — skips slugs that already exist.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const DocumentTemplate = require('../src/models/DocumentTemplate.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nyayasetu';

/* ---------------------------------------------------------------------------
 * Template definitions
 * ------------------------------------------------------------------------ */

const TEMPLATES = [
  // ── 1 ──────────────────────────────────────────────────────────────────────
  {
    slug: 'legal_notice_landlord',
    name: 'Legal Notice to Landlord',
    nameTranslations: {
      hi: 'मकान मालिक को कानूनी नोटिस',
      mr: 'मालकाला कायदेशीर नोटीस',
      bn: 'বাড়িওয়ালাকে আইনি নোটিস',
    },
    category: 'property',
    complexity: 'simple',
    pricePayPerDoc: 4900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    isFeatured: true,
    applicableActs: [
      { shortName: 'Transfer of Property Act 1882', sections: ['106', '108'] },
      { shortName: 'Rent Control Act', sections: ['state-specific'] },
    ],
    systemPromptAddendum: `You are drafting a formal legal notice under the Transfer of Property Act 1882 and applicable State Rent Control legislation.
The notice must cite Section 106 (termination of lease) and any relevant state-specific rent control provisions.
Use formal legal language. Include a 15/30-day compliance period. Reference consequences of non-compliance including civil suit.`,
    questionFlow: [
      { key: 'sender_name',        question: 'What is your full name?',                                                      type: 'text',   required: true },
      { key: 'sender_address',     question: 'What is your current address?',                                                type: 'text',   required: true },
      { key: 'landlord_name',      question: "What is the landlord's full name?",                                            type: 'text',   required: true },
      { key: 'landlord_address',   question: "What is the landlord's address for service of notice?",                        type: 'text',   required: true },
      { key: 'property_address',   question: 'What is the complete address of the rented property?',                         type: 'text',   required: true },
      { key: 'tenancy_start_date', question: 'When did your tenancy begin? (DD/MM/YYYY)',                                    type: 'date',   required: true },
      {
        key: 'issue_type',
        question: 'What is the primary issue with the landlord? Please select: (1) Unlawfully withholding security deposit (2) Refusing necessary repairs (3) Illegal/forcible eviction (4) Other',
        type: 'choice',
        choices: ['security_deposit', 'repairs', 'illegal_eviction', 'other'],
        required: true,
      },
      { key: 'issue_details',      question: 'Please describe the issue in detail — dates, amounts involved, any prior communications.',  type: 'textarea', required: true },
    ],
    estimatedTime: '5–10 min',
    availableStates: [],
  },

  // ── 2 ──────────────────────────────────────────────────────────────────────
  {
    slug: 'consumer_complaint',
    name: 'Consumer Complaint',
    nameTranslations: {
      hi: 'उपभोक्ता शिकायत',
      mr: 'ग्राहक तक्रार',
      bn: 'ভোক্তা অভিযোগ',
      ta: 'நுகர்வோர் புகார்',
    },
    category: 'consumer',
    complexity: 'moderate',
    pricePayPerDoc: 9900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    isFeatured: true,
    applicableActs: [
      { shortName: 'Consumer Protection Act 2019', sections: ['2(1)(d)', '35', '38', '69'] },
    ],
    systemPromptAddendum: `Draft a consumer complaint under the Consumer Protection Act, 2019.
Cite Section 2(1)(d) for consumer definition, Section 35 for complaint filing, Section 38 for procedure.
Identify the appropriate Consumer Commission level (District/State/National) based on claim amount.
Include prayer clause with specific reliefs: compensation, replacement/refund, and punitive damages if applicable.
Mention limitation period under Section 69 (2 years from cause of action).`,
    questionFlow: [
      { key: 'complainant_name',    question: 'What is your full name (Complainant)?',              type: 'text',   required: true },
      { key: 'complainant_address', question: 'What is your complete address?',                      type: 'text',   required: true },
      { key: 'opposite_party_name', question: 'What is the name of the company/seller (Opposite Party)?', type: 'text', required: true },
      { key: 'op_address',          question: "What is the Opposite Party's registered address?",   type: 'text',   required: true },
      { key: 'product_service',     question: 'What product or service was purchased?',              type: 'text',   required: true },
      { key: 'purchase_date',       question: 'When was the purchase made? (DD/MM/YYYY)',            type: 'date',   required: true },
      { key: 'purchase_amount',     question: 'What was the total amount paid (in ₹)?',              type: 'number', required: true },
      { key: 'defect_description',  question: 'Describe the defect, deficiency in service, or unfair trade practice in detail.', type: 'textarea', required: true },
      { key: 'relief_sought',       question: 'What relief are you seeking? (e.g., full refund, replacement, compensation for mental agony)', type: 'textarea', required: true },
    ],
    estimatedTime: '10–20 min',
    availableStates: [],
  },

  // ── 3 ──────────────────────────────────────────────────────────────────────
  {
    slug: 'rti_application',
    name: 'RTI Application',
    nameTranslations: {
      hi: 'RTI आवेदन (सूचना का अधिकार)',
      mr: 'RTI अर्ज',
      bn: 'তথ্য অধিকার আবেদন',
    },
    category: 'rti',
    complexity: 'simple',
    pricePayPerDoc: 0,
    requiredPlan: { citizen: 'free', lawyer: 'free' },
    isFeatured: true,
    applicableActs: [
      { shortName: 'Right to Information Act 2005', sections: ['6', '7', '8', '19'] },
    ],
    systemPromptAddendum: `Draft an RTI application under Section 6 of the Right to Information Act, 2005.
The application must be addressed to the Public Information Officer (PIO) of the relevant public authority.
Include: specific information sought, time period of records, preferred format (certified copies/inspection/diskette).
Mention the ₹10 application fee. Note the 30-day response timeline under Section 7.
Add a clause about first appeal under Section 19(1) if information is not provided.`,
    questionFlow: [
      { key: 'applicant_name',             question: 'What is your full name?',                                           type: 'text',   required: true },
      { key: 'applicant_address',          question: 'What is your complete postal address?',                             type: 'text',   required: true },
      { key: 'public_authority_name',      question: 'Which public authority / government department are you filing with?', type: 'text', required: true },
      { key: 'public_authority_address',   question: 'What is the address of this public authority?',                    type: 'text',   required: true },
      { key: 'information_sought',         question: 'What specific information are you seeking? Be precise — list each item separately.', type: 'textarea', required: true },
      { key: 'time_period',                question: 'For which time period do you require this information? (e.g., April 2022 to March 2023)', type: 'text', required: false },
    ],
    estimatedTime: '5–10 min',
    availableStates: [],
  },

  // ── 4 ──────────────────────────────────────────────────────────────────────
  {
    slug: 'employment_termination',
    name: 'Employment Termination Notice',
    nameTranslations: {
      hi: 'नौकरी समाप्ति नोटिस',
      mr: 'रोजगार समाप्ती नोटीस',
    },
    category: 'employment',
    complexity: 'moderate',
    pricePayPerDoc: 9900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    applicableActs: [
      { shortName: 'Industrial Disputes Act 1947', sections: ['25F', '25G', '25N'] },
      { shortName: 'Payment of Gratuity Act 1972', sections: ['4'] },
    ],
    systemPromptAddendum: `Draft a legal notice challenging unlawful employment termination.
Cite relevant provisions of the Industrial Disputes Act 1947, specifically Section 25F (conditions precedent to retrenchment).
Include claims for: retrenchment compensation (15 days wages per completed year), notice pay, pending wages, gratuity if applicable.
Demand reinstatement or compensation in lieu. Set 15-day compliance period before legal proceedings.`,
    questionFlow: [
      { key: 'employee_name',        question: 'What is your full name?',                                           type: 'text',   required: true },
      { key: 'employee_address',     question: 'What is your address?',                                             type: 'text',   required: true },
      { key: 'employer_name',        question: "What is the employer's company name?",                              type: 'text',   required: true },
      { key: 'employer_address',     question: "What is the employer's registered address?",                        type: 'text',   required: true },
      { key: 'designation',          question: 'What was your designation and department?',                         type: 'text',   required: true },
      { key: 'joining_date',         question: 'When did you join the company? (DD/MM/YYYY)',                       type: 'date',   required: true },
      { key: 'termination_date',     question: 'When were you terminated? (DD/MM/YYYY)',                            type: 'date',   required: true },
      { key: 'last_salary',          question: 'What was your last drawn monthly salary (₹)?',                      type: 'number', required: true },
      { key: 'termination_reason',   question: 'What reason (if any) was given for termination?',                  type: 'textarea', required: false },
      { key: 'dues_pending',         question: 'What dues are pending? (e.g., notice pay, salary, gratuity, PF)',  type: 'textarea', required: true },
    ],
    estimatedTime: '10–20 min',
    availableStates: [],
  },

  // ── 5 ──────────────────────────────────────────────────────────────────────
  {
    slug: 'bail_application',
    name: 'Bail Application',
    nameTranslations: {
      hi: 'जमानत आवेदन',
      mr: 'जामीन अर्ज',
    },
    category: 'criminal',
    complexity: 'complex',
    pricePayPerDoc: 19900,
    requiredPlan: { citizen: 'pro', lawyer: 'free' },
    applicableActs: [
      { shortName: 'Code of Criminal Procedure 1973', sections: ['436', '437', '438', '439'] },
      { shortName: 'Bharatiya Nagarik Suraksha Sanhita 2023', sections: ['478', '479', '480', '483'] },
    ],
    systemPromptAddendum: `Draft a bail application under the Code of Criminal Procedure 1973 / BNSS 2023.
Identify the correct section (regular bail u/s 437, anticipatory bail u/s 438, or bail by Sessions/HC u/s 439).
Arguments must include: nature of offence, antecedents, roots in community, risk of flight, no tampering with evidence.
Cite relevant Supreme Court and High Court precedents on bail principles (Arnesh Kumar, Sanjay Chandra).
This document should be reviewed by a lawyer before filing.`,
    questionFlow: [
      { key: 'accused_name',        question: "What is the accused person's full name?",              type: 'text',   required: true },
      { key: 'accused_address',     question: "What is the accused's permanent address?",             type: 'text',   required: true },
      { key: 'fir_number',          question: 'What is the FIR number and police station?',           type: 'text',   required: true },
      { key: 'offence_sections',    question: 'Under which IPC/BNS sections is the case registered?', type: 'text',  required: true },
      { key: 'arrest_date',         question: 'When was the accused arrested? (DD/MM/YYYY)',           type: 'date',   required: true },
      { key: 'court_name',          question: 'Which court is this bail application being filed in?', type: 'text',   required: true },
      { key: 'bail_type',           question: 'Type of bail: (1) Regular bail (2) Anticipatory bail', type: 'choice', choices: ['regular', 'anticipatory'], required: true },
      { key: 'grounds_for_bail',    question: 'What are the grounds for seeking bail? (e.g., medical condition, elderly, no prior criminal record, false implication)', type: 'textarea', required: true },
      { key: 'surety_details',      question: 'What surety arrangement can be provided?',             type: 'text',   required: false },
    ],
    estimatedTime: '20–40 min',
    availableStates: [],
  },

  // ── 6 ──────────────────────────────────────────────────────────────────────
  {
    slug: 'divorce_petition',
    name: 'Divorce Petition (Mutual Consent)',
    nameTranslations: {
      hi: 'तलाक याचिका (आपसी सहमति)',
      mr: 'घटस्फोट याचिका (परस्पर संमती)',
    },
    category: 'family',
    complexity: 'complex',
    pricePayPerDoc: 19900,
    requiredPlan: { citizen: 'pro', lawyer: 'free' },
    applicableActs: [
      { shortName: 'Hindu Marriage Act 1955', sections: ['13B'] },
      { shortName: 'Special Marriage Act 1954', sections: ['28'] },
    ],
    systemPromptAddendum: `Draft a joint petition for divorce by mutual consent under Section 13-B of the Hindu Marriage Act 1955.
The petition must include: marriage details, separation period (minimum 1 year), mutual settlement terms (alimony/maintenance, child custody, property).
Cite grounds: living separately for one year or more, inability to live together, mutual agreement.
This is a complex family law matter — strongly recommend legal consultation before filing.`,
    questionFlow: [
      { key: 'husband_name',          question: "What is the husband's full name?",                         type: 'text',   required: true },
      { key: 'husband_address',       question: "What is the husband's current address?",                   type: 'text',   required: true },
      { key: 'wife_name',             question: "What is the wife's full name?",                            type: 'text',   required: true },
      { key: 'wife_address',          question: "What is the wife's current address?",                      type: 'text',   required: true },
      { key: 'marriage_date',         question: 'When was the marriage solemnised? (DD/MM/YYYY)',            type: 'date',   required: true },
      { key: 'marriage_place',        question: 'Where was the marriage solemnised?',                       type: 'text',   required: true },
      { key: 'separation_date',       question: 'From when are both parties living separately? (DD/MM/YYYY)', type: 'date', required: true },
      { key: 'children',              question: 'Are there any children? If yes, provide names and ages.',  type: 'text',   required: false },
      { key: 'custody_arrangement',   question: 'What is the agreed custody arrangement for children (if any)?', type: 'textarea', required: false },
      { key: 'alimony_terms',         question: 'What are the agreed alimony/maintenance terms? (amount, duration, or "nil")', type: 'textarea', required: true },
      { key: 'property_settlement',   question: 'What is the agreed property settlement?',                  type: 'textarea', required: false },
    ],
    estimatedTime: '20–40 min',
    availableStates: [],
  },

  // ── 7 ──────────────────────────────────────────────────────────────────────
  {
    slug: 'property_sale_agreement',
    name: 'Property Sale Agreement',
    nameTranslations: {
      hi: 'संपत्ति बिक्री समझौता',
      mr: 'मालमत्ता विक्री करार',
    },
    category: 'property',
    complexity: 'complex',
    pricePayPerDoc: 19900,
    requiredPlan: { citizen: 'pro', lawyer: 'free' },
    applicableActs: [
      { shortName: 'Transfer of Property Act 1882', sections: ['54', '55'] },
      { shortName: 'Registration Act 1908', sections: ['17'] },
      { shortName: 'Indian Contract Act 1872', sections: ['10', '11'] },
    ],
    systemPromptAddendum: `Draft a property sale agreement (Agreement to Sell) under the Transfer of Property Act 1882.
Must include: detailed property description, total consideration, token amount paid, balance payment schedule, possession date, title verification clause, indemnity for encumbrances, default clause (forfeiture/return with interest), registration timeline.
Remind parties this agreement must be registered under Registration Act 1908 for transactions above ₹100.`,
    questionFlow: [
      { key: 'seller_name',        question: "What is the seller's full name?",                       type: 'text',   required: true },
      { key: 'seller_address',     question: "What is the seller's address?",                         type: 'text',   required: true },
      { key: 'buyer_name',         question: "What is the buyer's full name?",                        type: 'text',   required: true },
      { key: 'buyer_address',      question: "What is the buyer's address?",                          type: 'text',   required: true },
      { key: 'property_description', question: 'Describe the property (survey number, area in sq ft/sq m, location, complete address).', type: 'textarea', required: true },
      { key: 'sale_consideration', question: 'What is the total sale consideration in ₹?',            type: 'number', required: true },
      { key: 'token_amount',       question: 'What is the token/advance amount already paid (₹)?',    type: 'number', required: true },
      { key: 'balance_payment_date', question: 'By when must the balance be paid? (DD/MM/YYYY)',     type: 'date',   required: true },
      { key: 'possession_date',    question: 'When will possession be handed over? (DD/MM/YYYY)',     type: 'date',   required: true },
      { key: 'special_conditions', question: 'Any special conditions or encumbrances to disclose?',  type: 'textarea', required: false },
    ],
    estimatedTime: '20–40 min',
    availableStates: [],
  },

  // ── 8 ──────────────────────────────────────────────────────────────────────
  {
    slug: 'power_of_attorney',
    name: 'Power of Attorney (General)',
    nameTranslations: {
      hi: 'मुख्तारनामा (सामान्य)',
      mr: 'मुखत्यारपत्र (सामान्य)',
    },
    category: 'civil',
    complexity: 'moderate',
    pricePayPerDoc: 9900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    applicableActs: [
      { shortName: 'Powers of Attorney Act 1882', sections: ['1A', '2'] },
      { shortName: 'Registration Act 1908', sections: ['17', '32'] },
    ],
    systemPromptAddendum: `Draft a General Power of Attorney under the Powers of Attorney Act 1882.
Include: principal and agent details, scope of authority (specific or general), duration, revocation clause.
Note: POA relating to immovable property must be registered under Registration Act 1908.
Include standard witnessing requirements (two witnesses).`,
    questionFlow: [
      { key: 'principal_name',    question: "What is the principal's (grantor's) full name?",        type: 'text',   required: true },
      { key: 'principal_address', question: "What is the principal's complete address?",             type: 'text',   required: true },
      { key: 'agent_name',        question: "What is the agent's (attorney's) full name?",           type: 'text',   required: true },
      { key: 'agent_address',     question: "What is the agent's complete address?",                 type: 'text',   required: true },
      { key: 'agent_relationship',question: "What is the agent's relationship to the principal?",   type: 'text',   required: false },
      { key: 'powers_granted',    question: 'What specific powers are being granted? (e.g., manage bank accounts, sell property, appear in court)', type: 'textarea', required: true },
      { key: 'duration',          question: 'Is this POA for a specific period or until revoked?',  type: 'text',   required: true },
    ],
    estimatedTime: '10–20 min',
    availableStates: [],
  },

  // ── 9 ──────────────────────────────────────────────────────────────────────
  {
    slug: 'cheque_bounce_notice',
    name: 'Cheque Bounce Legal Notice',
    nameTranslations: {
      hi: 'चेक अनादर कानूनी नोटिस',
      mr: 'धनादेश अनादर कायदेशीर नोटीस',
    },
    category: 'financial',
    complexity: 'simple',
    pricePayPerDoc: 4900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    isFeatured: true,
    applicableActs: [
      { shortName: 'Negotiable Instruments Act 1881', sections: ['138', '141', '142', '143A'] },
    ],
    systemPromptAddendum: `Draft a statutory notice under Section 138 of the Negotiable Instruments Act 1881.
CRITICAL: Notice must be sent within 30 days of receiving memo of return from bank (dishonour memo).
Demand must be made for: cheque amount + interest @ 18% p.a. + costs of notice.
Give 15-day demand period before filing criminal complaint.
Include cheque details: number, date, amount, drawee bank, reason for dishonour.
Non-compliance leads to criminal prosecution punishable with imprisonment up to 2 years or fine up to twice the cheque amount.`,
    questionFlow: [
      { key: 'complainant_name',    question: 'What is your full name (payee/complainant)?',              type: 'text',   required: true },
      { key: 'complainant_address', question: 'What is your complete address?',                            type: 'text',   required: true },
      { key: 'drawer_name',         question: "What is the drawer's (accused's) full name?",              type: 'text',   required: true },
      { key: 'drawer_address',      question: "What is the drawer's address?",                            type: 'text',   required: true },
      { key: 'cheque_number',       question: 'What is the cheque number?',                               type: 'text',   required: true },
      { key: 'cheque_date',         question: 'What is the date on the cheque? (DD/MM/YYYY)',              type: 'date',   required: true },
      { key: 'cheque_amount',       question: 'What is the cheque amount in ₹?',                          type: 'number', required: true },
      { key: 'drawee_bank',         question: 'Which bank and branch was the cheque drawn on?',           type: 'text',   required: true },
      { key: 'dishonour_date',      question: 'When was the cheque dishonoured? (DD/MM/YYYY)',            type: 'date',   required: true },
      { key: 'dishonour_reason',    question: 'What was the reason given for dishonour (as per bank memo)?', type: 'text', required: true },
      { key: 'underlying_liability', question: 'Why was the cheque issued? (e.g., loan repayment, business transaction)', type: 'text', required: true },
    ],
    estimatedTime: '5–10 min',
    availableStates: [],
  },

  // ── 10 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'labour_dispute',
    name: 'Labour Dispute Application',
    nameTranslations: {
      hi: 'श्रम विवाद आवेदन',
      mr: 'कामगार वाद अर्ज',
    },
    category: 'labour',
    complexity: 'moderate',
    pricePayPerDoc: 9900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    applicableActs: [
      { shortName: 'Industrial Disputes Act 1947', sections: ['2(k)', '10', '25F'] },
      { shortName: 'Factories Act 1948', sections: ['79'] },
    ],
    systemPromptAddendum: `Draft an application to the Labour Court / Industrial Tribunal under the Industrial Disputes Act 1947.
Cite Section 2(k) (definition of industrial dispute), Section 10 (reference of disputes).
Cover: illegal retrenchment, non-payment of wages, wrongful suspension, breach of service conditions.
Mention conciliation proceedings (if any). Seek reinstatement with back wages or compensation in lieu.`,
    questionFlow: [
      { key: 'worker_name',        question: 'What is your full name?',                                    type: 'text',   required: true },
      { key: 'worker_address',     question: 'What is your address?',                                      type: 'text',   required: true },
      { key: 'employer_name',      question: "What is the employer's name / establishment name?",          type: 'text',   required: true },
      { key: 'employer_address',   question: "What is the employer's address?",                            type: 'text',   required: true },
      { key: 'nature_of_work',     question: 'What work did you perform? (designation/nature of employment)', type: 'text', required: true },
      { key: 'dispute_type',       question: 'What is the nature of the dispute? (1) Illegal retrenchment (2) Unpaid wages (3) Wrongful suspension (4) Other', type: 'choice', choices: ['retrenchment', 'unpaid_wages', 'suspension', 'other'], required: true },
      { key: 'dispute_details',    question: 'Describe the dispute in detail with dates and amounts.', type: 'textarea', required: true },
      { key: 'relief_sought',      question: 'What relief are you seeking?',                              type: 'textarea', required: true },
    ],
    estimatedTime: '10–20 min',
    availableStates: [],
  },

  // ── 11 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'startup_founders_agreement',
    name: "Founders' Agreement",
    nameTranslations: {
      hi: 'संस्थापक समझौता',
    },
    category: 'startup',
    complexity: 'complex',
    pricePayPerDoc: 19900,
    requiredPlan: { citizen: 'pro', lawyer: 'free' },
    applicableActs: [
      { shortName: 'Indian Contract Act 1872', sections: ['10', '11', '23'] },
      { shortName: 'Companies Act 2013', sections: ['2(68)', '89'] },
    ],
    systemPromptAddendum: `Draft a comprehensive Founders' Agreement for an Indian startup.
Cover: equity split and vesting schedule (4-year vesting with 1-year cliff is standard), roles and responsibilities, IP assignment to company, non-compete (12 months post-departure), non-solicitation, decision-making process, deadlock resolution, exit provisions, drag-along/tag-along rights.
This is a complex commercial document. Professional legal review is strongly recommended.`,
    questionFlow: [
      { key: 'company_name',          question: 'What is the company/startup name?',                        type: 'text',   required: true },
      { key: 'business_description',  question: 'Describe the business in 2–3 sentences.',                  type: 'textarea', required: true },
      { key: 'founders',              question: 'List all founders: name, equity %, role (one per line)',   type: 'textarea', required: true },
      { key: 'vesting_schedule',      question: 'What vesting schedule is agreed? (e.g., 4-year with 1-year cliff)', type: 'text', required: true },
      { key: 'decision_making',       question: 'How will major decisions be made? (e.g., unanimous, majority vote)', type: 'text', required: true },
      { key: 'ip_assignment',         question: 'Confirm all founders assign IP to the company? (yes/no)',   type: 'text',   required: true },
      { key: 'non_compete_period',    question: 'What is the non-compete period after departure? (months)', type: 'number', required: true },
      { key: 'dispute_resolution',    question: 'How should disputes be resolved? (Arbitration/Courts — which city?)', type: 'text', required: true },
    ],
    estimatedTime: '20–40 min',
    availableStates: [],
  },

  // ── 12 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'domestic_violence_complaint',
    name: 'Domestic Violence Complaint',
    nameTranslations: {
      hi: 'घरेलू हिंसा शिकायत',
      mr: 'घरगुती हिंसाचार तक्रार',
      bn: 'গার্হস্থ্য হিংসার অভিযোগ',
      ta: 'குடும்ப வன்முறை புகார்',
    },
    category: 'family',
    complexity: 'simple',
    pricePayPerDoc: 0,
    requiredPlan: { citizen: 'free', lawyer: 'free' },
    isFeatured: true,
    applicableActs: [
      { shortName: 'Protection of Women from Domestic Violence Act 2005', sections: ['3', '12', '17', '18', '19', '20'] },
    ],
    systemPromptAddendum: `Draft an application under Section 12 of the Protection of Women from Domestic Violence Act, 2005.
This is a SOCIAL GOOD template — always FREE for all users.
Address application to the appropriate Magistrate. Seek protection orders under Section 18, residence orders under Section 19, monetary relief under Section 20.
Be sensitive and compassionate in tone. Include safety planning note. Provide Rashtriya Mahila Aayog helpline: 7827170170.
This document should be filed with support of a Protection Officer (PO) or registered NGO.`,
    questionFlow: [
      { key: 'aggrieved_name',       question: 'What is your name? (This information is kept strictly confidential)', type: 'text', required: true },
      { key: 'aggrieved_address',    question: 'What is your safe address for correspondence?',               type: 'text',   required: true },
      { key: 'respondent_name',      question: "What is the respondent's (abuser's) name?",                  type: 'text',   required: true },
      { key: 'relationship',         question: 'What is your relationship to the respondent?',                type: 'text',   required: true },
      { key: 'shared_residence',     question: 'What is the shared household address?',                       type: 'text',   required: true },
      { key: 'abuse_type',           question: 'What types of domestic violence have you faced? (Physical / Emotional / Sexual / Economic — select all that apply)', type: 'textarea', required: true },
      { key: 'incidents',            question: 'Describe recent incidents with dates (most recent first).',   type: 'textarea', required: true },
      { key: 'reliefs_sought',       question: 'What reliefs are you seeking? (e.g., protection order, residence order, monetary relief, custody)', type: 'textarea', required: true },
      { key: 'children',             question: 'Are there children involved? If yes, their names and ages.', type: 'text',   required: false },
    ],
    estimatedTime: '5–10 min',
    availableStates: [],
  },

  // ── 13 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'police_complaint',
    name: 'Police Complaint / FIR Draft',
    nameTranslations: {
      hi: 'पुलिस शिकायत / FIR प्रारूप',
      mr: 'पोलीस तक्रार / FIR मसुदा',
      bn: 'পুলিশ অভিযোগ / FIR খসড়া',
    },
    category: 'criminal',
    complexity: 'simple',
    pricePayPerDoc: 0,
    requiredPlan: { citizen: 'free', lawyer: 'free' },
    isFeatured: true,
    applicableActs: [
      { shortName: 'Code of Criminal Procedure 1973', sections: ['154', '155', '156'] },
      { shortName: 'Bharatiya Nagarik Suraksha Sanhita 2023', sections: ['173', '174'] },
    ],
    systemPromptAddendum: `Draft a First Information Report (FIR) / police complaint under Section 154 CrPC / Section 173 BNSS.
This is a SOCIAL GOOD template — always FREE for all users.
Include all factual details required for a complete FIR. Cite relevant IPC/BNS sections.
Note: If police refuses to register FIR, complainant can send complaint by post to Superintendent of Police (Section 154(3) CrPC) or approach Magistrate u/s 156(3).`,
    questionFlow: [
      { key: 'complainant_name',     question: 'What is your full name?',                                     type: 'text',   required: true },
      { key: 'complainant_address',  question: 'What is your address and phone number?',                       type: 'text',   required: true },
      { key: 'police_station',       question: 'Which police station is this complaint addressed to?',         type: 'text',   required: true },
      { key: 'incident_date',        question: 'When did the incident occur? (date and time)',                 type: 'text',   required: true },
      { key: 'incident_place',       question: 'Where did the incident occur? (complete address)',             type: 'text',   required: true },
      { key: 'accused_details',      question: "Who are the accused? (Name, address if known, or 'unknown person')", type: 'textarea', required: true },
      { key: 'offence_type',         question: 'What type of offence? (e.g., theft, fraud, assault, cheating, harassment)', type: 'text', required: true },
      { key: 'incident_description', question: 'Describe the incident in chronological order with all relevant facts.', type: 'textarea', required: true },
      { key: 'witnesses',            question: 'Any witnesses? Provide names and contact details if available.', type: 'text', required: false },
      { key: 'evidence',             question: 'What evidence do you have? (documents, photos, videos, etc.)', type: 'text', required: false },
    ],
    estimatedTime: '5–10 min',
    availableStates: [],
  },

  // ── 14 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'insurance_claim',
    name: 'Insurance Claim Dispute Notice',
    nameTranslations: {
      hi: 'बीमा दावा विवाद नोटिस',
      mr: 'विमा दावा वाद नोटीस',
    },
    category: 'consumer',
    complexity: 'moderate',
    pricePayPerDoc: 9900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    applicableActs: [
      { shortName: 'Consumer Protection Act 2019', sections: ['2(1)(d)', '35'] },
      { shortName: 'Insurance Regulatory and Development Authority Act 1999', sections: ['14'] },
    ],
    systemPromptAddendum: `Draft a dispute notice for wrongful rejection/short settlement of insurance claim.
Address to insurance company's grievance officer (IRDA mandated). Also mention IRDA Ombudsman as escalation.
Cite Consumer Protection Act 2019 and IRDAI (Protection of Policyholders' Interest) Regulations 2017.
Include policy details, claim details, ground of rejection, legal basis for challenging rejection.`,
    questionFlow: [
      { key: 'policyholder_name',   question: 'What is your full name (policyholder)?',                     type: 'text',   required: true },
      { key: 'policyholder_address',question: 'What is your complete address?',                              type: 'text',   required: true },
      { key: 'insurance_company',   question: 'Which insurance company is this against?',                    type: 'text',   required: true },
      { key: 'policy_number',       question: 'What is the policy number?',                                  type: 'text',   required: true },
      { key: 'policy_type',         question: 'What type of insurance? (Life/Health/Motor/Home/Other)',      type: 'text',   required: true },
      { key: 'claim_date',          question: 'When was the claim filed? (DD/MM/YYYY)',                      type: 'date',   required: true },
      { key: 'claim_amount',        question: 'What was the claim amount in ₹?',                             type: 'number', required: true },
      { key: 'rejection_reason',    question: 'What reason did the insurance company give for rejection/short settlement?', type: 'textarea', required: true },
      { key: 'grounds_of_dispute',  question: 'On what grounds do you dispute the rejection? (Why is the rejection unjustified?)', type: 'textarea', required: true },
    ],
    estimatedTime: '10–20 min',
    availableStates: [],
  },

  // ── 15 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'landlord_eviction',
    name: 'Eviction Notice to Tenant',
    nameTranslations: {
      hi: 'किरायेदार को बेदखली नोटिस',
      mr: 'भाडेकरूला निष्कासन नोटीस',
    },
    category: 'property',
    complexity: 'simple',
    pricePayPerDoc: 4900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    applicableActs: [
      { shortName: 'Transfer of Property Act 1882', sections: ['106', '111', '114A'] },
    ],
    systemPromptAddendum: `Draft a formal eviction notice under Section 106 of the Transfer of Property Act 1882.
Cite specific grounds for eviction: non-payment of rent / lease expiry / breach of tenancy terms / personal requirement.
For residential property: 15-day notice. For agricultural/manufacturing: 6-month notice.
Note: Landlord cannot forcibly evict. Eviction requires court order after notice period. Mention applicable State Rent Control Act.`,
    questionFlow: [
      { key: 'landlord_name',       question: "What is the landlord's full name?",                          type: 'text',   required: true },
      { key: 'landlord_address',    question: "What is the landlord's address?",                            type: 'text',   required: true },
      { key: 'tenant_name',         question: "What is the tenant's full name?",                            type: 'text',   required: true },
      { key: 'property_address',    question: 'What is the complete address of the rented property?',       type: 'text',   required: true },
      { key: 'tenancy_start_date',  question: 'When did the tenancy begin? (DD/MM/YYYY)',                   type: 'date',   required: true },
      { key: 'monthly_rent',        question: 'What is the monthly rent in ₹?',                             type: 'number', required: true },
      { key: 'eviction_reason',     question: 'What is the reason for eviction? (1) Non-payment of rent (2) Lease expiry (3) Personal requirement (4) Subletting without consent (5) Other', type: 'choice', choices: ['non_payment', 'lease_expiry', 'personal_requirement', 'subletting', 'other'], required: true },
      { key: 'arrears_amount',      question: 'If non-payment: how many months of rent are due and total amount (₹)?', type: 'text', required: false },
      { key: 'vacate_by_date',      question: 'By when must the tenant vacate? (DD/MM/YYYY)',               type: 'date',   required: true },
    ],
    estimatedTime: '5–10 min',
    availableStates: [],
  },

  // ── 16 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'rent_agreement',
    name: 'Leave & License / Residential Rent Agreement',
    nameTranslations: {
      hi: 'लीव और लाइसेंस / किराया अनुबंध',
      mr: 'परवाना करार / भाडे करार',
      bn: 'লিভ ও লাইসেন্স / ভাড়া চুক্তি',
      ta: 'குத்தகை ஒப்பந்தம்',
      te: 'అద్దె ఒప్పందం',
    },
    category: 'property',
    complexity: 'moderate',
    pricePayPerDoc: 7900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    isFeatured: true,
    applicableActs: [
      { shortName: 'Transfer of Property Act 1882', sections: ['105', '106', '107'] },
      { shortName: 'Indian Stamp Act 1899', sections: ['2(16)', '35'] },
      { shortName: 'Registration Act 1908', sections: ['17', '49'] },
    ],
    systemPromptAddendum: `You are drafting a Leave and License / Residential Rent Agreement under the Transfer of Property Act 1882 and applicable state stamp and registration laws.
Include: licensor and licensee details, property description, monthly license fee/rent amount, security deposit, tenure (typically 11 months for Leave & License), lock-in period if any, notice period, maintenance obligations, prohibited activities, and termination conditions.
Remind the parties that agreements above 11 months require compulsory registration under Section 17 of Registration Act 1908. Use formal legal language. Add witnesses and execution details.`,
    questionFlow: [
      { key: 'licensor_name',        question: "What is the landlord's / licensor's full name?",                         type: 'text',    required: true },
      { key: 'licensor_address',     question: "What is the licensor's permanent address?",                               type: 'text',    required: true },
      { key: 'licensee_name',        question: "What is the tenant's / licensee's full name?",                            type: 'text',    required: true },
      { key: 'licensee_address',     question: "What is the licensee's current address?",                                 type: 'text',    required: true },
      { key: 'property_address',     question: 'What is the complete address of the property being rented?',              type: 'text',    required: true },
      { key: 'property_description', question: 'Briefly describe the property (e.g., 2BHK flat, 3rd floor, approx. 850 sq.ft.)',  type: 'textarea', required: true },
      { key: 'monthly_rent',         question: 'What is the monthly rent / license fee amount in ₹?',                    type: 'number',  required: true },
      { key: 'security_deposit',     question: 'What is the security deposit amount in ₹?',                               type: 'number',  required: true },
      { key: 'commencement_date',    question: 'From what date does the agreement commence? (DD/MM/YYYY)',                 type: 'date',    required: true },
      { key: 'tenure_months',        question: 'What is the tenure of the agreement in months? (typically 11)',            type: 'number',  required: true },
      { key: 'notice_period',        question: 'What is the notice period required for termination? (e.g., 30 days, 1 month)', type: 'text', required: true },
      { key: 'state',                question: 'In which state is the property located?',                                  type: 'text',    required: true },
      {
        key: 'registration_required',
        question: 'Will you be registering this agreement at the Sub-Registrar\'s office?',
        type: 'choice',
        choices: ['yes', 'no'],
        required: true,
      },
    ],
    estimatedTime: '8–12 min',
    availableStates: [],
  },

  // ── 17 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'legal_heir_certificate',
    name: 'Legal Heir Certificate Application',
    nameTranslations: {
      hi: 'कानूनी उत्तराधिकारी प्रमाणपत्र आवेदन',
      mr: 'कायदेशीर वारस प्रमाणपत्र अर्ज',
      bn: 'আইনি উত্তরাধিকার সনদ আবেদন',
      ta: 'சட்டப்பூர்வ வாரிசு சான்றிதழ் விண்ணப்பம்',
      te: 'చట్టపరమైన వారసుడు ధృవీకరణ పత్రం దరఖాస్తు',
    },
    category: 'family',
    complexity: 'moderate',
    pricePayPerDoc: 5900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    isFeatured: false,
    applicableActs: [
      { shortName: 'Hindu Succession Act 1956', sections: ['8', '10', '14', '15'] },
      { shortName: 'Indian Succession Act 1925', sections: ['370', '371', '372'] },
      { shortName: 'Code of Civil Procedure 1908', sections: ['Order VII Rule 1'] },
    ],
    systemPromptAddendum: `You are drafting an application for a Legal Heir Certificate to be submitted to the Revenue Department / Tehsildar / SDM of the concerned district.
Include: details of the deceased (name, date of death, address, occupation), applicant's relationship to deceased, list of all surviving legal heirs with their names, ages, addresses and relationship to deceased, purpose of the certificate (e.g., to claim provident fund, bank accounts, pension, property transfer), and declaration of truthfulness.
Reference the Hindu Succession Act 1956 or Indian Succession Act 1925 as applicable based on religion. Request the certificate urgently for the stated purpose.`,
    questionFlow: [
      { key: 'applicant_name',      question: 'What is your full name (the person applying for the certificate)?',       type: 'text',   required: true },
      { key: 'applicant_address',   question: 'What is your current residential address?',                                type: 'text',   required: true },
      { key: 'applicant_relation',  question: 'What is your relationship to the deceased? (e.g., son, daughter, spouse, mother)', type: 'text', required: true },
      { key: 'deceased_name',       question: 'What was the full name of the deceased?',                                  type: 'text',   required: true },
      { key: 'deceased_dob',        question: "What was the deceased's date of birth? (DD/MM/YYYY)",                      type: 'date',   required: true },
      { key: 'deceased_dod',        question: 'What was the date of death? (DD/MM/YYYY)',                                 type: 'date',   required: true },
      { key: 'deceased_address',    question: "What was the deceased's last residential address?",                         type: 'text',   required: true },
      { key: 'deceased_occupation', question: "What was the deceased's occupation?",                                      type: 'text',   required: false },
      { key: 'legal_heirs',         question: 'List all surviving legal heirs (name, age, relationship, address for each person — one per line)',  type: 'textarea', required: true },
      { key: 'purpose',             question: 'What is the purpose for which you need the Legal Heir Certificate? (e.g., bank account transfer, PF claim, property mutation)',  type: 'textarea', required: true },
      {
        key: 'religion',
        question: 'What was the religion of the deceased?',
        type: 'choice',
        choices: ['hindu', 'muslim', 'christian', 'other'],
        required: true,
      },
      { key: 'district',            question: 'In which district and state did the deceased reside?',                     type: 'text',   required: true },
    ],
    estimatedTime: '8–12 min',
    availableStates: [],
  },

  // ── 18 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'affidavit_general',
    name: 'General Purpose Affidavit',
    nameTranslations: {
      hi: 'सामान्य शपथपत्र',
      mr: 'सर्वसाधारण प्रतिज्ञापत्र',
      bn: 'সাধারণ হলফনামা',
      ta: 'பொதுவான உறுதிமொழி',
      te: 'సాధారణ అఫిడవిట్',
    },
    category: 'civil',
    complexity: 'simple',
    pricePayPerDoc: 2900,
    requiredPlan: { citizen: 'free', lawyer: 'free' },
    isFeatured: false,
    applicableActs: [
      { shortName: 'Code of Civil Procedure 1908', sections: ['Order XIX'] },
      { shortName: 'Oaths Act 1969', sections: ['4', '5'] },
      { shortName: 'Indian Evidence Act 1872', sections: ['3', '59'] },
    ],
    systemPromptAddendum: `You are drafting a general purpose sworn affidavit to be executed before a Notary Public or Magistrate.
The affidavit must include: deponent's full details (name, age, address, occupation), clear statement of facts being sworn to, declaration that the statements are true to the best of deponent's knowledge and belief, consequences of false statement (perjury), place and date of execution, signature/thumb impression, and space for notary attestation.
Ensure formal language. Clearly number each paragraph. Avoid ambiguity.`,
    questionFlow: [
      { key: 'deponent_name',     question: 'What is your full name (the person making the affidavit)?',                  type: 'text',   required: true },
      { key: 'deponent_age',      question: 'What is your age?',                                                          type: 'number', required: true },
      { key: 'deponent_address',  question: 'What is your full residential address?',                                     type: 'text',   required: true },
      { key: 'deponent_occupation', question: 'What is your occupation?',                                                 type: 'text',   required: true },
      { key: 'purpose',           question: 'For what purpose is this affidavit being made? (e.g., passport application, address proof, lost document declaration, name change)',  type: 'text', required: true },
      { key: 'facts',             question: 'State the facts you are swearing to — be detailed, specific and truthful (each fact will become a numbered paragraph):',  type: 'textarea', required: true },
      { key: 'place',             question: 'At which city/town is this affidavit being executed?',                       type: 'text',   required: true },
      {
        key: 'language',
        question: 'In which language should the affidavit be executed?',
        type: 'choice',
        choices: ['english', 'hindi', 'marathi', 'bengali', 'tamil'],
        required: true,
      },
    ],
    estimatedTime: '5–8 min',
    availableStates: [],
  },

  // ── 19 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'cybercrime_complaint',
    name: 'Cybercrime Complaint',
    nameTranslations: {
      hi: 'साइबर अपराध शिकायत',
      mr: 'सायबर गुन्हा तक्रार',
      bn: 'সাইবার অপরাধ অভিযোগ',
      ta: 'இணையவழி குற்ற புகார்',
      te: 'సైబర్ నేర ఫిర్యాదు',
    },
    category: 'criminal',
    complexity: 'moderate',
    pricePayPerDoc: 7900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    isFeatured: true,
    applicableActs: [
      { shortName: 'Information Technology Act 2000', sections: ['66', '66C', '66D', '67', '72', '79'] },
      { shortName: 'Indian Penal Code 1860', sections: ['419', '420', '463', '465', '468'] },
      { shortName: 'Bharatiya Nyaya Sanhita 2023', sections: ['318', '319', '338', '340'] },
    ],
    systemPromptAddendum: `You are drafting a cybercrime complaint to be filed with the Cybercrime Cell / Police Station or online at cybercrime.gov.in.
Cite the relevant sections of the Information Technology Act 2000 (Sections 66, 66C, 66D for identity theft, phishing, impersonation; Section 67 for obscene content; Section 72 for privacy breach) and the applicable IPC/BNS sections for fraud, forgery.
Include: complainant details, details of the accused (if known), chronological narrative of the incident with dates/times/amounts, digital evidence available (screenshots, emails, transaction IDs), financial loss suffered, any prior complaints made, and relief sought. Request immediate registration of FIR, freezing of fraudulent accounts, and recovery of money.`,
    questionFlow: [
      { key: 'complainant_name',     question: 'What is your full name?',                                                 type: 'text',     required: true },
      { key: 'complainant_address',  question: 'What is your address?',                                                   type: 'text',     required: true },
      { key: 'complainant_phone',    question: 'What is your mobile number linked to the incident?',                      type: 'text',     required: true },
      { key: 'complainant_email',    question: 'What is your email address?',                                             type: 'text',     required: true },
      {
        key: 'crime_type',
        question: 'What type of cybercrime occurred?',
        type: 'choice',
        choices: ['online_fraud', 'identity_theft', 'phishing', 'social_media_abuse', 'ransomware', 'upi_fraud', 'other'],
        required: true,
      },
      { key: 'incident_date',        question: 'When did the incident occur? (DD/MM/YYYY)',                               type: 'date',     required: true },
      { key: 'incident_description', question: 'Describe exactly what happened — be as detailed as possible (chronological order):',  type: 'textarea', required: true },
      { key: 'financial_loss',       question: 'What is the total financial loss in ₹? (Enter 0 if no financial loss)',   type: 'number',   required: true },
      { key: 'accused_details',      question: "Any details about the accused? (name, phone number, email, bank account, UPI ID — enter 'Unknown' if not known)", type: 'textarea', required: true },
      { key: 'evidence',             question: 'What digital evidence do you have? (e.g., screenshots, email headers, transaction IDs, chat logs)', type: 'textarea', required: true },
      { key: 'previous_complaint',   question: 'Have you previously filed any complaint about this incident? If yes, provide details (complaint number, date, police station):', type: 'textarea', required: false },
    ],
    estimatedTime: '10–15 min',
    availableStates: [],
  },

  // ── 20 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'msme_recovery_notice',
    name: 'MSME Payment Recovery Notice',
    nameTranslations: {
      hi: 'MSME भुगतान वसूली नोटिस',
      mr: 'MSME देयक वसुली नोटीस',
      bn: 'MSME পেমেন্ট রিকভারি নোটিস',
      ta: 'MSME கட்டண வசூல் நோட்டீஸ்',
      te: 'MSME చెల్లింపు రికవరీ నోటీసు',
    },
    category: 'financial',
    complexity: 'moderate',
    pricePayPerDoc: 8900,
    requiredPlan: { citizen: 'basic', lawyer: 'free' },
    isFeatured: false,
    applicableActs: [
      { shortName: 'Micro, Small and Medium Enterprises Development Act 2006', sections: ['15', '16', '17', '18'] },
      { shortName: 'Interest on Delayed Payments to Small Scale & Ancillary Industrial Undertakings Act 1993', sections: ['3', '4', '5'] },
    ],
    systemPromptAddendum: `You are drafting a formal payment recovery notice under the MSMED Act 2006 on behalf of a Micro, Small or Medium Enterprise.
Cite Section 15 (obligation of buyer to make payment within 45 days), Section 16 (interest on delayed payment at 3× bank rate compounded monthly), Section 17 (recovery of amount due) and Section 18 (reference to Micro and Small Enterprises Facilitation Council — MSEFC).
Include: supplier's MSME registration details (Udyam Registration Number), buyer's details, invoice particulars (invoice number, date, amount, goods/services supplied), amount outstanding, days overdue, interest calculation, and demand for immediate payment with a 15-day deadline before MSEFC reference and/or civil suit.`,
    questionFlow: [
      { key: 'supplier_name',        question: 'What is the full name / business name of your enterprise (the MSME)?',   type: 'text',    required: true },
      { key: 'supplier_address',     question: 'What is your business address?',                                          type: 'text',    required: true },
      { key: 'udyam_number',         question: 'What is your Udyam Registration Number (e.g., UDYAM-MH-01-0012345)?',    type: 'text',    required: true },
      { key: 'msme_category',        question: 'What is your MSME category?',                                             type: 'choice',  choices: ['micro', 'small', 'medium'], required: true },
      { key: 'buyer_name',           question: "What is the buyer's / debtor's full name or company name?",              type: 'text',    required: true },
      { key: 'buyer_address',        question: "What is the buyer's address?",                                            type: 'text',    required: true },
      { key: 'invoice_details',      question: 'List all unpaid invoices (invoice number, date, amount for each):',       type: 'textarea', required: true },
      { key: 'total_outstanding',    question: 'What is the total outstanding amount in ₹?',                              type: 'number',  required: true },
      { key: 'goods_services',       question: 'What goods or services were supplied under these invoices?',               type: 'textarea', required: true },
      { key: 'supply_date',          question: 'When were the goods/services supplied or accepted? (DD/MM/YYYY)',          type: 'date',    required: true },
      { key: 'payment_terms',        question: 'What were the agreed payment terms? (e.g., 30 days from invoice, 45 days net)', type: 'text', required: true },
      { key: 'prior_reminders',      question: 'Have you sent prior payment reminders? If yes, briefly describe (dates, response received):', type: 'textarea', required: false },
    ],
    estimatedTime: '10–15 min',
    availableStates: [],
  },

  // ── 21 ─────────────────────────────────────────────────────────────────────
  {
    slug: 'will_testament',
    name: 'Last Will and Testament',
    nameTranslations: {
      hi: 'अंतिम वसीयतनामा',
      mr: 'मृत्युपत्र / इच्छापत्र',
      bn: 'শেষ উইল ও উইলনামা',
      ta: 'இறுதி விருப்பப்படி உயில்',
      te: 'చివరి వీలునామా',
    },
    category: 'family',
    complexity: 'complex',
    pricePayPerDoc: 14900,
    requiredPlan: { citizen: 'pro', lawyer: 'free' },
    isFeatured: false,
    applicableActs: [
      { shortName: 'Indian Succession Act 1925', sections: ['57', '58', '59', '63', '68', '69', '74'] },
      { shortName: 'Hindu Succession Act 1956', sections: ['30'] },
    ],
    systemPromptAddendum: `You are drafting a Last Will and Testament under the Indian Succession Act 1925 and the Hindu Succession Act 1956 Section 30 (for Hindus).
The Will must include: testator's full details and declaration of sound mind; revocation of all prior wills; specific bequests of properties (immovable and movable) to named beneficiaries; executor appointment; residuary clause (for undistributed assets); conditions attached to bequests if any; and attestation by two witnesses (who are not beneficiaries) in the testator's presence.
Important notices to include: (1) Will must be signed by testator in presence of two witnesses who must also sign. (2) Registration is optional but strongly recommended. (3) For Muslims: use Islamic succession rules — a Will (Wasiyat) cannot dispose of more than 1/3 of estate without heirs' consent. Flag if testator is Muslim.`,
    questionFlow: [
      { key: 'testator_name',       question: 'What is your full legal name (the person making the Will)?',               type: 'text',    required: true },
      { key: 'testator_age',        question: 'What is your age? (Must be above 21 years)',                               type: 'number',  required: true },
      { key: 'testator_address',    question: 'What is your permanent residential address?',                               type: 'text',    required: true },
      { key: 'testator_occupation', question: 'What is your occupation?',                                                 type: 'text',    required: false },
      {
        key: 'religion',
        question: 'What is your religion? (This affects applicable succession law)',
        type: 'choice',
        choices: ['hindu', 'muslim', 'christian', 'parsi', 'other'],
        required: true,
      },
      { key: 'executor_name',       question: "Who do you appoint as executor of your Will? (Provide their full name and relationship to you)", type: 'text', required: true },
      { key: 'executor_address',    question: "What is the executor's address?",                                          type: 'text',    required: true },
      { key: 'immovable_assets',    question: 'List your immovable properties to be included in the Will (property address, survey/registration number, current market value approximately):', type: 'textarea', required: false },
      { key: 'movable_assets',      question: 'List your movable assets (bank accounts, FDs, investments, jewellery, vehicles — with approximate values):', type: 'textarea', required: false },
      { key: 'bequests',            question: 'How do you wish to distribute your assets? Specify: asset → beneficiary (full name, relationship, address) — one bequest per line:', type: 'textarea', required: true },
      { key: 'residuary_beneficiary', question: 'Who should receive any assets not specifically mentioned in the Will (the residuary beneficiary)?', type: 'text', required: true },
      { key: 'conditions',          question: 'Are there any conditions attached to any bequest? (e.g., beneficiary must attain age 25, must complete education — enter "None" if no conditions)', type: 'textarea', required: true },
      { key: 'witness_1_name',      question: 'Full name of Witness 1 (must NOT be a beneficiary):',                     type: 'text',    required: true },
      { key: 'witness_1_address',   question: "Witness 1's address:",                                                    type: 'text',    required: true },
      { key: 'witness_2_name',      question: 'Full name of Witness 2 (must NOT be a beneficiary):',                     type: 'text',    required: true },
      { key: 'witness_2_address',   question: "Witness 2's address:",                                                    type: 'text',    required: true },
      { key: 'place',               question: 'At which city/town is this Will being executed?',                          type: 'text',    required: true },
    ],
    estimatedTime: '15–20 min',
    availableStates: [],
  },
];

/* ---------------------------------------------------------------------------
 * Normalise seed data → model field names
 * ------------------------------------------------------------------------ */

function normalizeTemplate(tmpl) {
  const { nameTranslations, estimatedTime, questionFlow, applicableActs, ...rest } = tmpl;

  // nameTranslations { hi, mr, bn, ta } → individual flat fields
  const langFields = {};
  if (nameTranslations) {
    if (nameTranslations.hi) langFields.nameHi = nameTranslations.hi;
    if (nameTranslations.mr) langFields.nameMr = nameTranslations.mr;
    if (nameTranslations.bn) langFields.nameBn = nameTranslations.bn;
    if (nameTranslations.ta) langFields.nameTa = nameTranslations.ta;
    if (nameTranslations.te) langFields.nameTe = nameTranslations.te;
  }

  // estimatedTime '5–10 min' → estimatedMinutes (take the lower bound)
  let estimatedMinutes = 10;
  if (estimatedTime) {
    const m = estimatedTime.match(/(\d+)/);
    if (m) estimatedMinutes = parseInt(m[1], 10);
  }

  // question entries: rename fields + add required order & label
  const normalizedFlow = (questionFlow || []).map((q, i) => {
    const { question, type, choices, required, ...qRest } = q;
    return {
      ...qRest,
      order: i + 1,
      label: q.key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      questionText: question,
      inputType: (type === 'choice' ? 'select' : type) || 'text',
      ...(choices ? { options: choices } : {}),
      isRequired: required !== undefined ? required : true,
    };
  });

  return { ...rest, ...langFields, estimatedMinutes, questionFlow: normalizedFlow };
}

/* ---------------------------------------------------------------------------
 * Seed function
 * ------------------------------------------------------------------------ */

async function main() {
  console.log('🌱 NyayaSetu — Seeding DocumentTemplates');
  console.log('   MongoDB:', MONGO_URI.replace(/:\/\/[^@]+@/, '://***@'));

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected\n');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;

  for (const tmpl of TEMPLATES) {
    const existing = await DocumentTemplate.findOne({ slug: tmpl.slug });
    if (existing) {
      console.log(`   ⏭  Skipped (already exists): ${tmpl.slug}`);
      skipped++;
      continue;
    }

    await DocumentTemplate.create(normalizeTemplate({ ...tmpl, isActive: true }));
    console.log(`   ✅ Inserted: ${tmpl.slug} — ${tmpl.name}`);
    inserted++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Skipped  : ${skipped}`);
  console.log(`   Total    : ${TEMPLATES.length}`);

  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

/**
 * scripts/seedTemplates.js
 *
 * Seeds 15 DocumentTemplate records.
 * Run: node scripts/seedTemplates.js
 * Safe to re-run — skips slugs that already exist.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const DocumentTemplate = require('../src/models/DocumentTemplate');

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
];

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

    await DocumentTemplate.create({ ...tmpl, isActive: true });
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

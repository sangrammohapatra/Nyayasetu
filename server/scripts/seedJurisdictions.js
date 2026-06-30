/**
 * scripts/seedJurisdictions.js
 *
 * Seeds 15 JurisdictionRule records: 5 states × 3 document types.
 * States  : Maharashtra, Delhi, West Bengal, Tamil Nadu, Karnataka
 * DocTypes: consumer_complaint, rti_application, legal_notice_landlord
 *
 * Run: node scripts/seedJurisdictions.js
 * Safe to re-run — unique compound index on {state, documentType} prevents duplicates.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const JurisdictionRule = require('../src/models/JurisdictionRule.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nyayasetu';

/* ---------------------------------------------------------------------------
 * Data
 * ------------------------------------------------------------------------ */

const JURISDICTIONS = [

  // ═══════════════════════════════════════════════════════════
  // MAHARASHTRA
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Maharashtra',
    documentType: 'consumer_complaint',
    applicableActs: [
      { actShortName: 'Consumer Protection Act, 2019', sectionNumbers: ['2(1)(d)', '34', '35', '38', '69'], notes: 'Applicable across India. State Commission has pecuniary jurisdiction up to ₹1 crore.' },
      { actShortName: 'Maharashtra Consumer Protection Rules, 2020', sectionNumbers: ['4', '5'], notes: 'Prescribes procedure for filing complaints in Maharashtra.' },
    ],
    filingAuthority: {
      name: 'District Consumer Disputes Redressal Commission, Mumbai (Suburban)',
      address: 'Ground Floor, New Administrative Building, Near CST Station, Mumbai – 400001',
      website: 'https://consumer.maharashtra.gov.in',
      phone: '022-22620285',
      email: 'dcdrc.mumbaisuburban@maharashtra.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'FREE for claims up to ₹5,00,000. ₹200 for claims ₹5,00,001–₹10,00,000. ₹400 for claims above ₹10,00,000 up to ₹50,00,000. State Commission: ₹2,000 for claims ₹50L–₹1Cr. National Commission: ₹5,000 for claims above ₹1Cr.',
      feeSlabs: [
        { claimUpTo: 500000,   fee: 0 },
        { claimUpTo: 1000000,  fee: 200 },
        { claimUpTo: 5000000,  fee: 400 },
        { claimUpTo: 10000000, fee: 2000 },
      ],
    },
    limitationPeriod: {
      days: 730,
      fromEvent: 'date of cause of action',
      notes: 'Section 69 of Consumer Protection Act 2019 — 2 years from the date on which the cause of action arises. Court has discretion to condone delay for sufficient cause.',
    },
    courtHierarchy: [
      { level: 1, name: 'District Consumer Disputes Redressal Commission', jurisdiction: '₹50,00,000' },
      { level: 2, name: 'Maharashtra State Consumer Disputes Redressal Commission, Mumbai', jurisdiction: '₹50,00,001 – ₹2,00,00,000' },
      { level: 3, name: 'National Consumer Disputes Redressal Commission, New Delhi', jurisdiction: 'Above ₹2,00,00,000' },
    ],
    additionalContext: 'For online filing, visit consumerhelpline.gov.in. Keep original purchase receipt, warranty card, and all correspondence. File in the district where opposite party resides OR where cause of action arose.',
  },

  {
    state: 'Maharashtra',
    documentType: 'rti_application',
    applicableActs: [
      { actShortName: 'Right to Information Act, 2005', sectionNumbers: ['6', '7', '8', '9', '11', '18', '19', '20'], notes: 'Central Act applicable to all state and central public authorities.' },
      { actShortName: 'Maharashtra Right to Information Rules, 2005', sectionNumbers: ['3', '4'], notes: 'State-specific procedural rules for filing RTI applications to Maharashtra government bodies.' },
    ],
    filingAuthority: {
      name: 'Public Information Officer of the concerned Public Authority',
      address: 'Varies by department. General Directorate — General Administration Department, Mantralaya, Madame Cama Road, Mumbai – 400032',
      website: 'https://rti.maharashtra.gov.in',
      phone: '022-22793584',
      email: 'rtionline@maharashtra.gov.in',
    },
    filingFee: {
      amount: 10,
      currency: 'INR',
      notes: 'Application fee: ₹10 (by cash, demand draft, or online). Additional charges: ₹2 per page for photocopies. Inspection of records: ₹5 per hour. BPL cardholders: free (with proof).',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'N/A — RTI applications have no limitation period',
      notes: 'RTI applications can be filed at any time. However, information relating to events more than 20 years old may have been destroyed per record retention policy.',
    },
    courtHierarchy: [
      { level: 1, name: 'Public Information Officer (PIO)', jurisdiction: 'Initial application' },
      { level: 2, name: 'First Appellate Authority (FAA) — senior officer in same department', jurisdiction: '30 days after PIO reply or deemed refusal' },
      { level: 3, name: 'Maharashtra Information Commission (MIC), Mumbai (for State bodies)', jurisdiction: 'Second appeal or complaint' },
      { level: 4, name: 'Central Information Commission (CIC), New Delhi (for Central bodies)', jurisdiction: 'Second appeal or complaint' },
    ],
    additionalContext: 'Submit application online at rtionline.gov.in or by post. If PIO fails to reply within 30 days, file first appeal within 30 days with FAA. Second appeal to Information Commission within 90 days of FAA order.',
  },

  {
    state: 'Maharashtra',
    documentType: 'legal_notice_landlord',
    applicableActs: [
      { actShortName: 'Transfer of Property Act, 1882', sectionNumbers: ['105', '106', '108', '111', '114A'], notes: 'Sections 105-108 govern leases; Section 106 sets notice period for termination.' },
      { actShortName: 'Maharashtra Rent Control Act, 1999', sectionNumbers: ['7', '16', '26', '28'], notes: 'State-specific rent control legislation. Governs rent, eviction, and tenant rights in Maharashtra.' },
    ],
    filingAuthority: {
      name: 'Court of Small Causes, Mumbai / Competent Rent Court',
      address: 'Old Custom House Building, Shahid Bhagat Singh Road, Fort, Mumbai – 400001',
      website: 'https://districts.ecourts.gov.in/mumbai',
      phone: '022-22694801',
      email: 'cs-bombay@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal notice itself has no filing fee. Court fee payable only if suit is filed: ad valorem based on claim amount. For small claims, nominal court fee of ₹200–₹500.',
    },
    limitationPeriod: {
      days: 1095,
      fromEvent: 'date of cause of action (breach of tenancy terms)',
      notes: 'Section 3 of Limitation Act 1963: 3 years for recovery of money. Notice under Section 106 TPA must be given 15 days (residential) before suit. Rent recovery suit: 3 years.',
    },
    courtHierarchy: [
      { level: 1, name: 'Competent Rent Authority / Rent Controller (Maharashtra Rent Control Act cases)', jurisdiction: 'All rent disputes' },
      { level: 2, name: 'Court of Small Causes, Mumbai (for Mumbai City/Suburbs)', jurisdiction: 'Up to ₹50,000' },
      { level: 3, name: 'City Civil Court, Mumbai', jurisdiction: 'Up to ₹10,00,000' },
      { level: 4, name: 'Bombay High Court', jurisdiction: 'Above ₹10,00,000 or constitutional/fundamental rights' },
    ],
    additionalContext: 'Notice must be sent by Registered Post AD and Speed Post to create a rebuttable presumption of service. Keep postal receipts. In Mumbai, most rent disputes are governed by Maharashtra Rent Control Act 1999, not TPA.',
  },

  // ═══════════════════════════════════════════════════════════
  // DELHI
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Delhi',
    documentType: 'consumer_complaint',
    applicableActs: [
      { actShortName: 'Consumer Protection Act, 2019', sectionNumbers: ['2(1)(d)', '34', '35', '38', '69'], notes: 'Central legislation applicable in Delhi.' },
      { actShortName: 'Delhi Consumer Protection Rules, 2020', sectionNumbers: ['4'], notes: 'Delhi-specific procedural rules.' },
    ],
    filingAuthority: {
      name: 'District Consumer Disputes Redressal Commission, Central Delhi',
      address: 'Kashmere Gate, Near Delhi Gate, Delhi – 110006',
      website: 'https://dcdrc-delhi.gov.in',
      phone: '011-23869099',
      email: 'dcdrc-central@delhi.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'FREE for claims up to ₹5,00,000. ₹200 for ₹5L–₹10L. ₹400 for ₹10L–₹50L. Delhi State Commission: ₹2,000 for ₹50L–₹2Cr. National Commission: ₹5,000 for above ₹2Cr.',
    },
    limitationPeriod: {
      days: 730,
      fromEvent: 'date of cause of action',
      notes: '2 years under Section 69, Consumer Protection Act 2019.',
    },
    courtHierarchy: [
      { level: 1, name: 'District Consumer Disputes Redressal Commission (11 districts in Delhi)', jurisdiction: 'Up to ₹50,00,000' },
      { level: 2, name: 'Delhi State Consumer Disputes Redressal Commission, Delhi', jurisdiction: '₹50L – ₹2Cr' },
      { level: 3, name: 'National Consumer Disputes Redressal Commission, Janpath, New Delhi', jurisdiction: 'Above ₹2Cr' },
    ],
    additionalContext: 'File complaint in the district where the opposite party resides, carries on business, or where cause of action arose. Online filing: edaakhil.nic.in.',
  },

  {
    state: 'Delhi',
    documentType: 'rti_application',
    applicableActs: [
      { actShortName: 'Right to Information Act, 2005', sectionNumbers: ['6', '7', '8', '19', '20'], notes: 'Central Act.' },
      { actShortName: 'Delhi Right to Information (Amendment) Rules, 2018', sectionNumbers: ['3', '4'], notes: 'Delhi GNCT-specific procedural rules.' },
    ],
    filingAuthority: {
      name: 'Public Information Officer, concerned Delhi Government Department',
      address: 'Delhi Secretariat, I.P. Estate, New Delhi – 110002 (for state bodies)',
      website: 'https://rti.delhi.gov.in',
      phone: '011-23392004',
      email: 'rtidelhi@gmail.com',
    },
    filingFee: {
      amount: 10,
      currency: 'INR',
      notes: '₹10 application fee for GNCT departments. Free for Central Government departments via rtionline.gov.in. BPL applicants are exempt.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period',
      notes: 'RTI has no limitation period. PIO must respond within 30 days (48 hours if life/liberty involved).',
    },
    courtHierarchy: [
      { level: 1, name: 'Public Information Officer (PIO)', jurisdiction: 'Initial application' },
      { level: 2, name: 'First Appellate Authority (FAA)', jurisdiction: '30 days after PIO reply' },
      { level: 3, name: 'Delhi Information Commission (DIC) for State bodies', jurisdiction: 'Second appeal' },
      { level: 4, name: 'Central Information Commission (CIC) for Central bodies', jurisdiction: 'Second appeal' },
    ],
    additionalContext: 'For online RTI to Central Government: rtionline.gov.in. For Delhi government: delhigateway.nic.in. Include BPL card number if applicable for fee exemption.',
  },

  {
    state: 'Delhi',
    documentType: 'legal_notice_landlord',
    applicableActs: [
      { actShortName: 'Transfer of Property Act, 1882', sectionNumbers: ['105', '106', '108', '111'], notes: 'Primary legislation for leases.' },
      { actShortName: 'Delhi Rent Control Act, 1958', sectionNumbers: ['6', '14', '25A', '37'], notes: 'Governs rent, eviction from premises with monthly rent below ₹3,500. Premises above ₹3,500 rent are not covered.' },
    ],
    filingAuthority: {
      name: 'Additional Rent Controller / Rent Controller, Delhi',
      address: 'Tis Hazari Courts Complex, Rohini Courts, Delhi – 110054 (for civil matters)',
      website: 'https://delhicourts.nic.in',
      phone: '011-27041023',
      email: 'hc-del@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal notice: no fee. Court fee for filing suit is payable on claim amount as per Delhi Court Fees Act.',
    },
    limitationPeriod: {
      days: 1095,
      fromEvent: 'breach of tenancy terms',
      notes: '3 years for recovery suits. Notice under Section 106 TPA: 15 days for residential. Delhi Rent Control Act may prescribe different notice periods for covered premises.',
    },
    courtHierarchy: [
      { level: 1, name: 'Rent Controller (for DRCA-covered premises — rent below ₹3,500)', jurisdiction: 'All rent disputes under DRCA' },
      { level: 2, name: 'Delhi District Courts / Small Causes Court (for non-DRCA premises)', jurisdiction: 'Up to ₹3 crore' },
      { level: 3, name: 'Delhi High Court', jurisdiction: 'Above ₹3 crore or extraordinary jurisdiction' },
    ],
    additionalContext: 'Delhi Rent Control Act 1958 only covers premises with monthly rent below ₹3,500. Most modern properties fall under TPA 1882. Notice by Registered Post AD is legally required.',
  },

  // ═══════════════════════════════════════════════════════════
  // WEST BENGAL
  // ═══════════════════════════════════════════════════════════

  {
    state: 'West Bengal',
    documentType: 'consumer_complaint',
    applicableActs: [
      { actShortName: 'Consumer Protection Act, 2019', sectionNumbers: ['2(1)(d)', '34', '35', '38', '69'], notes: 'Central Act applicable in West Bengal.' },
      { actShortName: 'West Bengal Consumer Protection Rules, 2020', sectionNumbers: ['3', '4'], notes: 'WB-specific procedural rules.' },
    ],
    filingAuthority: {
      name: 'District Consumer Disputes Redressal Commission, Kolkata (North)',
      address: 'Block D, 4th Floor, Gariahat Road (South), Dhakuria, Kolkata – 700031',
      website: 'https://wb.gov.in/consumer',
      phone: '033-24147000',
      email: 'cdrc-kol-north@wb.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'FREE for claims up to ₹5,00,000. Same national fee structure applies: ₹200, ₹400, ₹2,000, ₹5,000 for higher slabs.',
    },
    limitationPeriod: {
      days: 730,
      fromEvent: 'date of cause of action',
      notes: '2 years under Section 69 of Consumer Protection Act, 2019.',
    },
    courtHierarchy: [
      { level: 1, name: 'District Consumer Disputes Redressal Commission, Kolkata (North/South)', jurisdiction: 'Up to ₹50,00,000' },
      { level: 2, name: 'West Bengal State Consumer Disputes Redressal Commission, Kolkata', jurisdiction: '₹50L – ₹2Cr' },
      { level: 3, name: 'National Consumer Disputes Redressal Commission, New Delhi', jurisdiction: 'Above ₹2Cr' },
    ],
    additionalContext: 'Online filing available at edaakhil.nic.in. For Kolkata, file in the district where the cause of action arose or where the opposite party is located.',
  },

  {
    state: 'West Bengal',
    documentType: 'rti_application',
    applicableActs: [
      { actShortName: 'Right to Information Act, 2005', sectionNumbers: ['6', '7', '8', '19', '20'], notes: 'Central Act.' },
      { actShortName: 'West Bengal Right to Information Act, 2005', sectionNumbers: ['2', '5', '6'], notes: 'WB has its own RTI Act (predating Central Act). Central RTI Act supersedes for central bodies; WB RTI Act applies to State bodies.' },
    ],
    filingAuthority: {
      name: 'Public Information Officer, Concerned West Bengal Government Department',
      address: 'Nabanna (State Secretariat), 325, Sarat Chatterjee Road, Shibpur, Howrah – 711102',
      website: 'https://wbrti.gov.in',
      phone: '033-22140808',
      email: 'wbrti@wbgov.in',
    },
    filingFee: {
      amount: 10,
      currency: 'INR',
      notes: '₹10 application fee for WB government bodies (cash/IPO). Central bodies: ₹10 via rtionline.gov.in. BPL applicants exempt.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period',
      notes: 'RTI has no limitation period. Response must be given within 30 days (or 48 hours if life/liberty involved).',
    },
    courtHierarchy: [
      { level: 1, name: 'Public Information Officer (PIO)', jurisdiction: 'Initial application' },
      { level: 2, name: 'First Appellate Authority (FAA)', jurisdiction: '30 days after PIO deadline' },
      { level: 3, name: 'West Bengal Information Commission (WBIC)', jurisdiction: 'Second appeal for State bodies' },
      { level: 4, name: 'Central Information Commission (CIC)', jurisdiction: 'Second appeal for Central bodies' },
    ],
    additionalContext: 'Note: West Bengal has its own RTI Act (2005) that is still in operation. For WB government departments, use the WB RTI Act procedure. Complaints about inaction go to WBIC.',
  },

  {
    state: 'West Bengal',
    documentType: 'legal_notice_landlord',
    applicableActs: [
      { actShortName: 'Transfer of Property Act, 1882', sectionNumbers: ['105', '106', '108', '111'], notes: 'Governs tenancy agreements and notice requirements.' },
      { actShortName: 'West Bengal Premises Tenancy Act, 1997', sectionNumbers: ['3', '5', '6', '16', '18', '19'], notes: 'Applies to premises in West Bengal. Governs fair rent, repairs, and eviction grounds.' },
    ],
    filingAuthority: {
      name: 'Rent Controller (Additional District Judge), Alipore',
      address: 'City Civil Court Complex, Alipore, Kolkata – 700027',
      website: 'https://wb.ecourts.gov.in',
      phone: '033-24798000',
      email: 'hc-calcutta@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal notice: no fee. Court fee for filing rent suit is payable as per WB Court Fees Act. Ad valorem fees apply to claim amount.',
    },
    limitationPeriod: {
      days: 1095,
      fromEvent: 'breach of tenancy terms / cause of action',
      notes: '3 years for recovery of money. WBPTA may have specific limitation provisions for eviction proceedings.',
    },
    courtHierarchy: [
      { level: 1, name: 'Rent Controller (for premises covered under WBPTA 1997)', jurisdiction: 'All premises covered by WB Premises Tenancy Act' },
      { level: 2, name: 'City Civil Court / District Court, Kolkata', jurisdiction: 'Civil suits' },
      { level: 3, name: 'Calcutta High Court', jurisdiction: 'High-value disputes and revisions' },
    ],
    additionalContext: 'West Bengal Premises Tenancy Act 1997 covers most residential and commercial tenancies in WB. Notice must be served by Registered Post with AD. Keep all receipts.',
  },

  // ═══════════════════════════════════════════════════════════
  // TAMIL NADU
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Tamil Nadu',
    documentType: 'consumer_complaint',
    applicableActs: [
      { actShortName: 'Consumer Protection Act, 2019', sectionNumbers: ['2(1)(d)', '34', '35', '38', '69'], notes: 'Central Act applicable in Tamil Nadu.' },
      { actShortName: 'Tamil Nadu Consumer Protection Rules, 2020', sectionNumbers: ['3', '4'], notes: 'TN-specific procedural rules.' },
    ],
    filingAuthority: {
      name: 'District Consumer Disputes Redressal Commission, Chennai',
      address: 'Arumbakkam, Chennai – 600106, Tamil Nadu',
      website: 'https://consumer.tn.gov.in',
      phone: '044-26161640',
      email: 'dcdrc-chennai@tn.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'FREE for claims up to ₹5,00,000. ₹200 for ₹5L–₹10L. ₹400 for ₹10L–₹50L. TN State Commission: ₹2,000 for ₹50L–₹2Cr.',
    },
    limitationPeriod: {
      days: 730,
      fromEvent: 'date of cause of action',
      notes: '2 years under Section 69, Consumer Protection Act 2019. Court can condone delay for sufficient cause.',
    },
    courtHierarchy: [
      { level: 1, name: 'District Consumer Disputes Redressal Commission (38 districts in TN)', jurisdiction: 'Up to ₹50,00,000' },
      { level: 2, name: 'Tamil Nadu State Consumer Disputes Redressal Commission, Chennai', jurisdiction: '₹50L – ₹2Cr' },
      { level: 3, name: 'National Consumer Disputes Redressal Commission, New Delhi', jurisdiction: 'Above ₹2Cr' },
    ],
    additionalContext: 'Online filing: edaakhil.nic.in. Tamil Nadu has 38 District Commissions — file in your district. Complaint must be signed by the complainant personally.',
  },

  {
    state: 'Tamil Nadu',
    documentType: 'rti_application',
    applicableActs: [
      { actShortName: 'Right to Information Act, 2005', sectionNumbers: ['6', '7', '8', '11', '19', '20'], notes: 'Central Act applicable to all state bodies in Tamil Nadu.' },
    ],
    filingAuthority: {
      name: 'Public Information Officer, Concerned Tamil Nadu Government Department',
      address: 'Secretariat, Fort St. George, Chennai – 600009',
      website: 'https://tnic.tamilnadu.gov.in/rti',
      phone: '044-25670080',
      email: 'rti@tn.gov.in',
    },
    filingFee: {
      amount: 10,
      currency: 'INR',
      notes: '₹10 application fee for TN State departments. Demand draft in favour of the Public Authority. BPL applicants exempt (submit BPL card copy).',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period',
      notes: 'PIO must respond within 30 days. Life/liberty matters: within 48 hours.',
    },
    courtHierarchy: [
      { level: 1, name: 'Public Information Officer (PIO)', jurisdiction: 'Initial application' },
      { level: 2, name: 'First Appellate Authority (FAA)', jurisdiction: '30 days after PIO reply/deemed refusal' },
      { level: 3, name: 'Tamil Nadu Information Commission (TNIC), Chennai', jurisdiction: 'Second appeal for State bodies' },
      { level: 4, name: 'Central Information Commission (CIC), New Delhi', jurisdiction: 'Second appeal for Central bodies' },
    ],
    additionalContext: 'Tamil Nadu has the Tamil Nadu Information Commission with offices in Chennai, Coimbatore and Madurai. Appeals to TNIC must be filed within 90 days of FAA order.',
  },

  {
    state: 'Tamil Nadu',
    documentType: 'legal_notice_landlord',
    applicableActs: [
      { actShortName: 'Transfer of Property Act, 1882', sectionNumbers: ['105', '106', '108', '111', '114A'], notes: 'Governs lease and tenancy.' },
      { actShortName: 'Tamil Nadu Buildings (Lease and Rent Control) Act, 1960', sectionNumbers: ['10', '14', '18', '19', '22'], notes: 'TN state rent control. Applies to buildings in municipalities and town panchayats.' },
    ],
    filingAuthority: {
      name: 'Rent Control Court (Court of the Sub-Judge / District Munsiff), Chennai',
      address: 'City Civil Court Complex, Parry\'s Corner, Chennai – 600001',
      website: 'https://districts.ecourts.gov.in/chennai',
      phone: '044-25217726',
      email: 'cc-chennai@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal notice: no fee. Court fee is payable on the plaint amount when suit is filed. Nominal for eviction suits; ad valorem for money claims.',
    },
    limitationPeriod: {
      days: 1095,
      fromEvent: 'cause of action',
      notes: '3 years for recovery suits under Limitation Act. Section 106 TPA notice: 15 days for residential/commercial monthly tenancies.',
    },
    courtHierarchy: [
      { level: 1, name: 'Rent Controller (RCC) for premises under TN Buildings (L&RC) Act 1960', jurisdiction: 'Buildings in municipalities' },
      { level: 2, name: 'Appellate Authority — District Court', jurisdiction: 'Appeals from RCC' },
      { level: 3, name: 'Madras High Court', jurisdiction: 'Revision and original side jurisdiction' },
    ],
    additionalContext: 'Tamil Nadu rent control applies to buildings in municipal areas. Agricultural/rural land is governed by TPA only. Notice must be sent by Registered Post AD.',
  },

  // ═══════════════════════════════════════════════════════════
  // KARNATAKA
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Karnataka',
    documentType: 'consumer_complaint',
    applicableActs: [
      { actShortName: 'Consumer Protection Act, 2019', sectionNumbers: ['2(1)(d)', '34', '35', '38', '69'], notes: 'Central Act applicable in Karnataka.' },
      { actShortName: 'Karnataka Consumer Protection Rules, 2020', sectionNumbers: ['3', '4'], notes: 'Karnataka-specific procedural rules.' },
    ],
    filingAuthority: {
      name: 'District Consumer Disputes Redressal Commission, Bengaluru (Urban)',
      address: 'No. 1, T.T.M.C. Building, K.H. Road, Shanthinagar, Bengaluru – 560027',
      website: 'https://consumer.karnataka.gov.in',
      phone: '080-22867800',
      email: 'dcdrc-blr-urban@karnataka.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'FREE for claims up to ₹5,00,000. ₹200 for ₹5L–₹10L. ₹400 for ₹10L–₹50L. Karnataka State Commission: ₹2,000 for ₹50L–₹2Cr.',
    },
    limitationPeriod: {
      days: 730,
      fromEvent: 'date of cause of action',
      notes: '2 years under Section 69 of Consumer Protection Act, 2019.',
    },
    courtHierarchy: [
      { level: 1, name: 'District Consumer Disputes Redressal Commission (31 districts)', jurisdiction: 'Up to ₹50,00,000' },
      { level: 2, name: 'Karnataka State Consumer Disputes Redressal Commission, Bengaluru', jurisdiction: '₹50L – ₹2Cr' },
      { level: 3, name: 'National Consumer Disputes Redressal Commission, New Delhi', jurisdiction: 'Above ₹2Cr' },
    ],
    additionalContext: 'Online filing: edaakhil.nic.in. Karnataka has multiple District Commissions including Bengaluru Urban, Bengaluru Rural, Mysuru, Hubballi-Dharwad etc.',
  },

  {
    state: 'Karnataka',
    documentType: 'rti_application',
    applicableActs: [
      { actShortName: 'Right to Information Act, 2005', sectionNumbers: ['6', '7', '8', '11', '19', '20'], notes: 'Central Act applicable to all state bodies in Karnataka.' },
    ],
    filingAuthority: {
      name: 'Public Information Officer, Concerned Karnataka Government Department',
      address: 'Vikasa Soudha, Bengaluru – 560001 (Secretariat)',
      website: 'https://rtionline.karnataka.gov.in',
      phone: '080-22253333',
      email: 'rti@karnataka.gov.in',
    },
    filingFee: {
      amount: 10,
      currency: 'INR',
      notes: '₹10 application fee for Karnataka State departments. Online payment available at rtionline.karnataka.gov.in. BPL applicants: free.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period',
      notes: 'PIO responds within 30 days. Life/liberty: 48 hours. First appeal within 30 days of PIO reply. Second appeal to KIC within 90 days of FAA order.',
    },
    courtHierarchy: [
      { level: 1, name: 'Public Information Officer (PIO)', jurisdiction: 'Initial application' },
      { level: 2, name: 'First Appellate Authority (FAA)', jurisdiction: '30 days after PIO reply' },
      { level: 3, name: 'Karnataka Information Commission (KIC), Bengaluru', jurisdiction: 'Second appeal for State bodies' },
      { level: 4, name: 'Central Information Commission (CIC), New Delhi', jurisdiction: 'Second appeal for Central bodies' },
    ],
    additionalContext: 'Karnataka has an online RTI portal: rtionline.karnataka.gov.in. KIC has jurisdiction over all Karnataka State government bodies and local bodies.',
  },

  {
    state: 'Karnataka',
    documentType: 'legal_notice_landlord',
    applicableActs: [
      { actShortName: 'Transfer of Property Act, 1882', sectionNumbers: ['105', '106', '108', '111', '114A'], notes: 'Governs lease and tenancy.' },
      { actShortName: 'Karnataka Rent Control Act, 2001', sectionNumbers: ['4', '5', '21', '27', '28', '32'], notes: 'Karnataka state rent control. Applies to buildings in urban areas of Karnataka.' },
    ],
    filingAuthority: {
      name: 'Rent Control Court / Additional Munsiff Judge, Bengaluru',
      address: 'City Civil Court, Mayo Hall, Bengaluru – 560001',
      website: 'https://karnatakajudiciary.kar.nic.in',
      phone: '080-22212300',
      email: 'hckarhc@kar.nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal notice: no fee. Court fee payable when suit filed. Nominal court fee for eviction petitions under Karnataka Rent Act.',
    },
    limitationPeriod: {
      days: 1095,
      fromEvent: 'cause of action / breach of tenancy terms',
      notes: '3 years for money recovery suits. Karnataka RCA cases: no specific limitation; however promptness recommended.',
    },
    courtHierarchy: [
      { level: 1, name: 'Rent Control Court (Addl. Small Causes Court / Munsiff Court) for Karnataka RCA premises', jurisdiction: 'Urban area buildings' },
      { level: 2, name: 'Appellate Court — District & Sessions Court or City Civil Court', jurisdiction: 'Appeals from RCC' },
      { level: 3, name: 'Karnataka High Court, Bengaluru', jurisdiction: 'Revisions, original jurisdiction' },
    ],
    additionalContext: 'Karnataka Rent Control Act 2001 applies to buildings in BDA/BBMP and other urban local body areas. Rent < ₹3,500/month in Bengaluru may have enhanced tenant protections. Always send notice by Registered Post AD.',
  },

  // ═══════════════════════════════════════════════════════════
  // GUJARAT
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Gujarat',
    documentType: 'consumer_complaint',
    applicableActs: [
      { actShortName: 'Consumer Protection Act, 2019', sectionNumbers: ['2(1)(d)', '34', '35', '38', '69'], notes: 'Central Act applicable in Gujarat.' },
      { actShortName: 'Gujarat Consumer Protection Rules, 2020', sectionNumbers: ['3', '4'], notes: 'Gujarat-specific procedural rules.' },
    ],
    filingAuthority: {
      name: 'District Consumer Disputes Redressal Commission, Ahmedabad',
      address: 'Old High Court Building, Lal Darwaja, Ahmedabad – 380001',
      website: 'https://consumer.gujarat.gov.in',
      phone: '079-25506527',
      email: 'dcdrc-ahd@gujarat.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'FREE for claims up to ₹5,00,000. ₹200 for ₹5L–₹10L. ₹400 for ₹10L–₹50L. Gujarat State Commission: ₹2,000 for ₹50L–₹2Cr. National Commission: ₹5,000 for above ₹2Cr.',
      feeSlabs: [
        { claimUpTo: 500000, fee: 0 },
        { claimUpTo: 1000000, fee: 200 },
        { claimUpTo: 5000000, fee: 400 },
        { claimUpTo: 10000000, fee: 2000 },
      ],
    },
    limitationPeriod: {
      days: 730,
      fromEvent: 'date of cause of action',
      notes: '2 years under Section 69 of Consumer Protection Act, 2019.',
    },
    courtHierarchy: [
      { level: 1, name: 'District Consumer Disputes Redressal Commission (33 districts in Gujarat)', jurisdiction: 'Up to ₹50,00,000' },
      { level: 2, name: 'Gujarat State Consumer Disputes Redressal Commission, Ahmedabad', jurisdiction: '₹50L – ₹2Cr' },
      { level: 3, name: 'National Consumer Disputes Redressal Commission, New Delhi', jurisdiction: 'Above ₹2Cr' },
    ],
    additionalContext: 'Online filing at edaakhil.nic.in. Gujarat has 33 District Commissions. Ahmedabad Urban and Ahmedabad Rural are separate commissions. File where you reside or where cause of action arose.',
  },

  {
    state: 'Gujarat',
    documentType: 'rti_application',
    applicableActs: [
      { actShortName: 'Right to Information Act, 2005', sectionNumbers: ['6', '7', '8', '11', '19', '20'], notes: 'Central Act applicable to all state bodies in Gujarat.' },
    ],
    filingAuthority: {
      name: 'Public Information Officer, Concerned Gujarat Government Department',
      address: 'Sachivalaya, Gandhinagar – 382010, Gujarat',
      website: 'https://rti.gujarat.gov.in',
      phone: '079-23250000',
      email: 'rti@gujarat.gov.in',
    },
    filingFee: {
      amount: 10,
      currency: 'INR',
      notes: '₹10 application fee for Gujarat State departments. Postal order/IPO/cash. BPL applicants: free with BPL card copy. ₹2 per page for photocopies.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period',
      notes: 'PIO must respond within 30 days. Life/liberty: 48 hours. First appeal within 30 days. Second appeal to GUJIC within 90 days.',
    },
    courtHierarchy: [
      { level: 1, name: 'Public Information Officer (PIO)', jurisdiction: 'Initial application' },
      { level: 2, name: 'First Appellate Authority (FAA)', jurisdiction: '30 days after PIO reply' },
      { level: 3, name: 'Gujarat Information Commission (GUJIC), Gandhinagar', jurisdiction: 'Second appeal for State bodies' },
      { level: 4, name: 'Central Information Commission (CIC), New Delhi', jurisdiction: 'Second appeal for Central bodies' },
    ],
    additionalContext: 'Gujarat Information Commission operates from Gandhinagar. RTI applications to Gujarat government can be filed online at rti.gujarat.gov.in or by post to respective department PIOs.',
  },

  {
    state: 'Gujarat',
    documentType: 'legal_notice_landlord',
    applicableActs: [
      { actShortName: 'Transfer of Property Act, 1882', sectionNumbers: ['105', '106', '108', '111'], notes: 'Primary legislation for leases.' },
      { actShortName: 'Gujarat Rent Control Act, 1947', sectionNumbers: ['4', '13', '14', '28'], notes: 'Applies to premises in municipal areas in Gujarat with rent below a prescribed limit.' },
    ],
    filingAuthority: {
      name: 'Civil Court / Rent Court, Ahmedabad',
      address: 'City Civil & Sessions Court, Law Garden Road, Ahmedabad – 380006',
      website: 'https://districts.ecourts.gov.in/ahmedabad',
      phone: '079-26580100',
      email: 'hc-guj@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal notice: no fee. Court fee payable on filing suit. Ad valorem fees apply. Small Claims Court fee: nominal.',
    },
    limitationPeriod: {
      days: 1095,
      fromEvent: 'cause of action / breach of tenancy',
      notes: '3 years for money recovery suits. Section 106 TPA: 15 days notice for residential tenancies before suit.',
    },
    courtHierarchy: [
      { level: 1, name: 'Rent Control Court for Gujarat Rent Control Act premises', jurisdiction: 'Rent-controlled premises' },
      { level: 2, name: 'Civil Court (Junior Division / City Civil Court)', jurisdiction: 'General tenancy disputes' },
      { level: 3, name: 'Gujarat High Court, Ahmedabad', jurisdiction: 'Revisions and high-value matters' },
    ],
    additionalContext: 'Notice must be sent by Registered Post AD. Gujarat Rent Control Act applies to specific municipal areas. For newer properties and agreements, TPA 1882 generally governs. Always get rent agreement registered.',
  },

  // ═══════════════════════════════════════════════════════════
  // UTTAR PRADESH
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Uttar Pradesh',
    documentType: 'consumer_complaint',
    applicableActs: [
      { actShortName: 'Consumer Protection Act, 2019', sectionNumbers: ['2(1)(d)', '34', '35', '38', '69'], notes: 'Central Act applicable in UP.' },
      { actShortName: 'Uttar Pradesh Consumer Protection Rules, 2020', sectionNumbers: ['3', '4'], notes: 'UP-specific procedural rules.' },
    ],
    filingAuthority: {
      name: 'District Consumer Disputes Redressal Commission, Lucknow',
      address: '8, Sarojini Naidu Marg, Hazratganj, Lucknow – 226001, Uttar Pradesh',
      website: 'https://consumer.up.gov.in',
      phone: '0522-2239213',
      email: 'dcdrc-lucknow@up.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'FREE for claims up to ₹5,00,000. ₹200 for ₹5L–₹10L. ₹400 for ₹10L–₹50L. UP State Commission: ₹2,000 for ₹50L–₹2Cr.',
      feeSlabs: [
        { claimUpTo: 500000, fee: 0 },
        { claimUpTo: 1000000, fee: 200 },
        { claimUpTo: 5000000, fee: 400 },
        { claimUpTo: 10000000, fee: 2000 },
      ],
    },
    limitationPeriod: {
      days: 730,
      fromEvent: 'date of cause of action',
      notes: '2 years under Section 69 of Consumer Protection Act, 2019.',
    },
    courtHierarchy: [
      { level: 1, name: 'District Consumer Disputes Redressal Commission (75 districts in UP)', jurisdiction: 'Up to ₹50,00,000' },
      { level: 2, name: 'UP State Consumer Disputes Redressal Commission, Lucknow', jurisdiction: '₹50L – ₹2Cr' },
      { level: 3, name: 'National Consumer Disputes Redressal Commission, New Delhi', jurisdiction: 'Above ₹2Cr' },
    ],
    additionalContext: 'UP has 75 District Commissions. Online filing at edaakhil.nic.in. File complaint in the district where the opposite party operates or where cause of action arose. Complaint must be in Hindi or English.',
  },

  {
    state: 'Uttar Pradesh',
    documentType: 'rti_application',
    applicableActs: [
      { actShortName: 'Right to Information Act, 2005', sectionNumbers: ['6', '7', '8', '11', '19', '20'], notes: 'Central Act applicable to all UP State bodies.' },
    ],
    filingAuthority: {
      name: 'Public Information Officer, Concerned UP Government Department',
      address: 'UP Secretariat, Vidhan Sabha Marg, Lucknow – 226001',
      website: 'https://information.up.gov.in',
      phone: '0522-2237582',
      email: 'rti@up.gov.in',
    },
    filingFee: {
      amount: 10,
      currency: 'INR',
      notes: '₹10 application fee. Payment by IPO, cash, or UP Treasury challan. BPL cardholders: free. Photocopy charges: ₹2 per page.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period',
      notes: 'PIO must respond in 30 days. Life/liberty: 48 hours. First appeal within 30 days. Second appeal to UPSIC within 90 days of FAA order.',
    },
    courtHierarchy: [
      { level: 1, name: 'Public Information Officer (PIO)', jurisdiction: 'Initial application' },
      { level: 2, name: 'First Appellate Authority (FAA)', jurisdiction: '30 days after PIO reply' },
      { level: 3, name: 'UP State Information Commission (UPSIC), Lucknow', jurisdiction: 'Second appeal for State bodies' },
      { level: 4, name: 'Central Information Commission (CIC), New Delhi', jurisdiction: 'Second appeal for Central bodies' },
    ],
    additionalContext: 'UPSIC has offices in Lucknow. RTI applications to UP government departments should mention the specific file/subject clearly. Applications in Hindi are widely accepted.',
  },

  {
    state: 'Uttar Pradesh',
    documentType: 'legal_notice_landlord',
    applicableActs: [
      { actShortName: 'Transfer of Property Act, 1882', sectionNumbers: ['105', '106', '108', '111'], notes: 'Primary legislation for leases and tenancy.' },
      { actShortName: 'Uttar Pradesh Urban Buildings (Regulation of Letting, Rent and Eviction) Act, 1972', sectionNumbers: ['2', '12', '20', '21', '40'], notes: 'Governs regulated tenancies in urban areas of UP.' },
    ],
    filingAuthority: {
      name: 'Rent Control & Eviction Officer / Civil Judge (Junior Division), Lucknow',
      address: 'District Court Complex, Hazratganj, Lucknow – 226001',
      website: 'https://districts.ecourts.gov.in/lucknow',
      phone: '0522-2620246',
      email: 'hc-allahabad@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal notice: no fee. Court fee payable on filing suit — ad valorem on claim amount as per UP Court Fees Act.',
    },
    limitationPeriod: {
      days: 1095,
      fromEvent: 'cause of action / breach of tenancy',
      notes: '3 years for money recovery. UP Urban Buildings Act cases: specific timelines apply for regulated tenancies. Notice under S.106 TPA: 15 days for residential.',
    },
    courtHierarchy: [
      { level: 1, name: 'Prescribed Authority under UP Urban Buildings Act (for regulated buildings)', jurisdiction: 'Tenancies under UP Urban Buildings Act' },
      { level: 2, name: 'Civil Court (Junior Division / Additional District Judge)', jurisdiction: 'Unregulated tenancies and money recovery' },
      { level: 3, name: 'Allahabad High Court', jurisdiction: 'Revisions, high-value matters, constitutional issues' },
    ],
    additionalContext: 'UP Urban Buildings Act applies to buildings in urban areas (municipalities) allotted before a specific date. Always send notice by Registered Post AD. Keep proof of service for all notices.',
  },

  // ═══════════════════════════════════════════════════════════
  // KERALA
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Kerala',
    documentType: 'consumer_complaint',
    applicableActs: [
      { actShortName: 'Consumer Protection Act, 2019', sectionNumbers: ['2(1)(d)', '34', '35', '38', '69'], notes: 'Central Act applicable in Kerala.' },
      { actShortName: 'Kerala Consumer Protection Rules, 2020', sectionNumbers: ['3', '4'], notes: 'Kerala-specific procedural rules.' },
    ],
    filingAuthority: {
      name: 'District Consumer Disputes Redressal Commission, Thiruvananthapuram',
      address: 'Medical College P.O., Thiruvananthapuram – 695011, Kerala',
      website: 'https://consumer.kerala.gov.in',
      phone: '0471-2554901',
      email: 'dcdrc-tvm@kerala.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'FREE for claims up to ₹5,00,000. ₹200 for ₹5L–₹10L. ₹400 for ₹10L–₹50L. Kerala State Commission: ₹2,000 for ₹50L–₹2Cr.',
      feeSlabs: [
        { claimUpTo: 500000, fee: 0 },
        { claimUpTo: 1000000, fee: 200 },
        { claimUpTo: 5000000, fee: 400 },
        { claimUpTo: 10000000, fee: 2000 },
      ],
    },
    limitationPeriod: {
      days: 730,
      fromEvent: 'date of cause of action',
      notes: '2 years under Section 69 of Consumer Protection Act, 2019.',
    },
    courtHierarchy: [
      { level: 1, name: 'District Consumer Disputes Redressal Commission (14 districts in Kerala)', jurisdiction: 'Up to ₹50,00,000' },
      { level: 2, name: 'Kerala State Consumer Disputes Redressal Commission, Thiruvananthapuram', jurisdiction: '₹50L – ₹2Cr' },
      { level: 3, name: 'National Consumer Disputes Redressal Commission, New Delhi', jurisdiction: 'Above ₹2Cr' },
    ],
    additionalContext: 'Online filing: edaakhil.nic.in. Kerala has 14 District Commissions. Complaints can be filed in Malayalam or English. Kerala consumers are known for high consumer awareness — detailed complaints are preferred.',
  },

  {
    state: 'Kerala',
    documentType: 'rti_application',
    applicableActs: [
      { actShortName: 'Right to Information Act, 2005', sectionNumbers: ['6', '7', '8', '11', '19', '20'], notes: 'Central Act applicable to all Kerala State bodies.' },
    ],
    filingAuthority: {
      name: 'Public Information Officer, Concerned Kerala Government Department',
      address: 'Secretariat, Thiruvananthapuram – 695001, Kerala',
      website: 'https://rti.kerala.gov.in',
      phone: '0471-2327084',
      email: 'rti@kerala.gov.in',
    },
    filingFee: {
      amount: 10,
      currency: 'INR',
      notes: '₹10 by IPO or cash. BPL cardholders: free. Photocopy: ₹2 per page. Inspection of records: ₹5 per hour.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period',
      notes: 'PIO must respond in 30 days. Life/liberty: 48 hours. First appeal to FAA within 30 days. Second appeal to KSIC within 90 days.',
    },
    courtHierarchy: [
      { level: 1, name: 'Public Information Officer (PIO)', jurisdiction: 'Initial application' },
      { level: 2, name: 'First Appellate Authority (FAA)', jurisdiction: '30 days after PIO reply' },
      { level: 3, name: 'Kerala State Information Commission (KSIC), Thiruvananthapuram', jurisdiction: 'Second appeal for State bodies' },
      { level: 4, name: 'Central Information Commission (CIC), New Delhi', jurisdiction: 'Second appeal for Central bodies' },
    ],
    additionalContext: 'Kerala KSIC is accessible and has a good track record of disposing cases. Applications can be made in Malayalam or English. Kerala government departments generally respond well to RTI applications.',
  },

  {
    state: 'Kerala',
    documentType: 'legal_notice_landlord',
    applicableActs: [
      { actShortName: 'Transfer of Property Act, 1882', sectionNumbers: ['105', '106', '108', '111'], notes: 'Governs leases and tenancy agreements.' },
      { actShortName: 'Kerala Buildings (Lease and Rent Control) Act, 1965', sectionNumbers: ['5', '11', '15', '17', '18'], notes: 'Governs rent control and eviction in Kerala. Applies to buildings in municipal areas.' },
    ],
    filingAuthority: {
      name: 'Rent Control Court (Munsiff Court), Thiruvananthapuram',
      address: 'District Court Complex, Thiruvananthapuram – 695001',
      website: 'https://districts.ecourts.gov.in/thiruvananthapuram',
      phone: '0471-2463038',
      email: 'hc-kerala@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal notice: no fee. Court fee on suit filing: as per Kerala Court Fees and Suits Valuation Act. Nominal for eviction petitions.',
    },
    limitationPeriod: {
      days: 1095,
      fromEvent: 'cause of action / breach of tenancy',
      notes: '3 years for money recovery under Limitation Act. Kerala BLRC Act has specific provisions for eviction petitions.',
    },
    courtHierarchy: [
      { level: 1, name: 'Rent Control Court (Munsiff Court) for Kerala BLRC Act premises', jurisdiction: 'Buildings covered under Kerala BLRC Act' },
      { level: 2, name: 'Appellate Authority — District Court', jurisdiction: 'Appeals from Rent Control Court' },
      { level: 3, name: 'Kerala High Court, Ernakulam', jurisdiction: 'Revisions and writ jurisdiction' },
    ],
    additionalContext: 'Kerala BLRC Act 1965 provides strong tenant protections. Eviction is allowed only on specific grounds (non-payment, landlord\'s own use, demolition etc.). Always send notice by Registered Post with AD. Keep all rent receipts.',
  },

  // ═══════════════════════════════════════════════════════════
  // CHEQUE BOUNCE NOTICE — ALL 5 ORIGINAL STATES
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Maharashtra',
    documentType: 'cheque_bounce_notice',
    applicableActs: [
      { actShortName: 'Negotiable Instruments Act, 1881', sectionNumbers: ['138', '139', '141', '142', '142A', '143A', '147'], notes: 'Primary legislation for cheque bounce cases. Section 138 creates the offence; Section 142 prescribes complaint procedure.' },
    ],
    filingAuthority: {
      name: 'Judicial Magistrate First Class (JMFC) / Metropolitan Magistrate, Mumbai',
      address: 'Metropolitan Magistrate\'s Court, 3rd Floor, Mazgaon Court Complex, Mumbai – 400010',
      website: 'https://districts.ecourts.gov.in/mumbai',
      phone: '022-23755555',
      email: 'cs-bombay@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal demand notice: no fee. Court complaint filing fee: nominal (₹200 approximately). Advocate fees separate. Recovery of notice preparation costs also claimable.',
    },
    limitationPeriod: {
      days: 75,
      fromEvent: 'date of dishonour memo from bank',
      notes: 'Strict timeline under Section 142: 30 days to send demand notice after bank memo + 15 days demand period + 30 days to file complaint after demand period expires = 75 days total. Missing ANY deadline may be fatal to case.',
    },
    courtHierarchy: [
      { level: 1, name: 'Metropolitan Magistrate (Mumbai) / JMFC (other Maharashtra cities)', jurisdiction: 'Where payee\'s bank is located or where cheque was presented' },
      { level: 2, name: 'Sessions Court', jurisdiction: 'Appeal from Magistrate' },
      { level: 3, name: 'Bombay High Court', jurisdiction: 'Revision and further appeal' },
    ],
    additionalContext: 'Post-2015 NI Act amendment: complaint must be filed in court where payee\'s bank branch is situated. Always collect bank\'s dishonour memo with specific reason. Demand notice must be sent by registered post AND speed post to create legal presumption of service.',
  },

  {
    state: 'Delhi',
    documentType: 'cheque_bounce_notice',
    applicableActs: [
      { actShortName: 'Negotiable Instruments Act, 1881', sectionNumbers: ['138', '139', '141', '142', '142A', '143A'], notes: 'Central legislation for cheque dishonour. Complaint must be filed in court of area where payee\'s bank branch is situated.' },
    ],
    filingAuthority: {
      name: 'Metropolitan Magistrate, Tis Hazari / Saket / Karkardooma / Rohini Courts, Delhi',
      address: 'Tis Hazari Courts Complex, Delhi – 110054',
      website: 'https://delhicourts.nic.in',
      phone: '011-23916400',
      email: 'hc-del@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Demand notice: no fee. Court complaint: nominal filing fee. Delhi courts have designated cheque bounce courts with faster disposal.',
    },
    limitationPeriod: {
      days: 75,
      fromEvent: 'date of bank dishonour memo',
      notes: 'Section 142 NI Act: 30-day window to send demand notice + 15-day demand period + 30-day complaint window. All three deadlines must be strictly followed.',
    },
    courtHierarchy: [
      { level: 1, name: 'Metropolitan Magistrate (MM), Delhi — file in court area of payee\'s bank', jurisdiction: 'Cheque bounce complaint' },
      { level: 2, name: 'Additional Sessions Judge / Sessions Judge', jurisdiction: 'Appeal' },
      { level: 3, name: 'Delhi High Court', jurisdiction: 'Revision and quashing petitions' },
    ],
    additionalContext: 'Delhi has dedicated cheque bounce courts. Summit/Lok Adalat settlement option available for fast resolution and avoiding criminal record. Consider mediation before proceeding to trial.',
  },

  {
    state: 'Karnataka',
    documentType: 'cheque_bounce_notice',
    applicableActs: [
      { actShortName: 'Negotiable Instruments Act, 1881', sectionNumbers: ['138', '139', '141', '142', '142A', '143A'], notes: 'Central legislation applicable in Karnataka.' },
    ],
    filingAuthority: {
      name: 'Judicial Magistrate First Class (JMFC) / Metropolitan Magistrate, Bengaluru',
      address: 'City Civil and Sessions Court, Mayo Hall, Bengaluru – 560001',
      website: 'https://karnatakajudiciary.kar.nic.in',
      phone: '080-22201500',
      email: 'hckarhc@kar.nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Demand notice: no fee. Court complaint: nominal fee. Bengaluru has JMFC courts with fast-track cheque bounce disposal.',
    },
    limitationPeriod: {
      days: 75,
      fromEvent: 'date of bank dishonour memo',
      notes: 'Strictly follow: 30 days to send demand notice → 15-day demand period → 30 days to file complaint. Total 75-day window.',
    },
    courtHierarchy: [
      { level: 1, name: 'JMFC / Metropolitan Magistrate (file where payee\'s bank is situated)', jurisdiction: 'Cheque bounce complaint' },
      { level: 2, name: 'Sessions Court, Bengaluru', jurisdiction: 'Appeal' },
      { level: 3, name: 'Karnataka High Court, Bengaluru', jurisdiction: 'Revision' },
    ],
    additionalContext: 'Bengaluru courts handle high volumes of cheque bounce cases. Consider Lok Adalat for quicker settlement. Send demand notice to both residential and business address of drawer.',
  },

  {
    state: 'Tamil Nadu',
    documentType: 'cheque_bounce_notice',
    applicableActs: [
      { actShortName: 'Negotiable Instruments Act, 1881', sectionNumbers: ['138', '139', '141', '142', '142A', '143A'], notes: 'Central legislation applicable in Tamil Nadu.' },
    ],
    filingAuthority: {
      name: 'Judicial Magistrate / Metropolitan Magistrate, Chennai',
      address: 'City Civil Court, Parry\'s Corner, Chennai – 600001',
      website: 'https://districts.ecourts.gov.in/chennai',
      phone: '044-25217726',
      email: 'cc-chennai@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Demand notice: no fee. Court complaint: nominal filing fee. Costs of demand notice service are claimable in the complaint.',
    },
    limitationPeriod: {
      days: 75,
      fromEvent: 'date of bank dishonour memo',
      notes: 'Follow Section 142 NI Act timeline strictly: 30 days for demand notice + 15 days demand period + 30 days for complaint.',
    },
    courtHierarchy: [
      { level: 1, name: 'Metropolitan Magistrate (Chennai) or JMFC (other TN cities)', jurisdiction: 'File in court of payee\'s bank area' },
      { level: 2, name: 'Sessions Court', jurisdiction: 'Appeal' },
      { level: 3, name: 'Madras High Court, Chennai', jurisdiction: 'Revision' },
    ],
    additionalContext: 'Tamil Nadu courts accept complaints in Tamil or English. Lok Adalat settlement is available at Magistrate stage for mutual compromise without criminal record.',
  },

  {
    state: 'West Bengal',
    documentType: 'cheque_bounce_notice',
    applicableActs: [
      { actShortName: 'Negotiable Instruments Act, 1881', sectionNumbers: ['138', '139', '141', '142', '142A', '143A'], notes: 'Central legislation applicable in West Bengal.' },
    ],
    filingAuthority: {
      name: 'Judicial Magistrate First Class (JMFC) / Metropolitan Magistrate, Kolkata',
      address: 'Chief Metropolitan Magistrate\'s Court, 3, Bankshall Street, Kolkata – 700001',
      website: 'https://wb.ecourts.gov.in',
      phone: '033-22124649',
      email: 'hc-calcutta@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Demand notice: no fee. Court complaint: nominal filing fee. Recovery of notice costs can be sought in the complaint.',
    },
    limitationPeriod: {
      days: 75,
      fromEvent: 'date of bank dishonour memo',
      notes: 'Section 142 NI Act: 30 days for demand notice + 15-day payment window + 30 days to file complaint.',
    },
    courtHierarchy: [
      { level: 1, name: 'Metropolitan Magistrate (Kolkata) / JMFC (other WB districts)', jurisdiction: 'File where payee\'s bank branch is located' },
      { level: 2, name: 'Sessions Court', jurisdiction: 'Appeal' },
      { level: 3, name: 'Calcutta High Court', jurisdiction: 'Revision' },
    ],
    additionalContext: 'WB courts accept complaints in Bengali or English. Multiple cheques: file a separate complaint for each dishonoured cheque. Lok Adalat settlement option available for quicker resolution.',
  },

  // ═══════════════════════════════════════════════════════════
  // DOMESTIC VIOLENCE COMPLAINT — ALL 5 ORIGINAL STATES
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Maharashtra',
    documentType: 'domestic_violence_complaint',
    applicableActs: [
      { actShortName: 'Protection of Women from Domestic Violence Act, 2005', sectionNumbers: ['3', '4', '5', '12', '17', '18', '19', '20', '21', '22', '23'], notes: 'Primary legislation. Section 12 — application to magistrate; Section 18 — protection orders; Section 19 — residence orders; Section 20 — monetary relief.' },
    ],
    filingAuthority: {
      name: 'Judicial Magistrate First Class (JMFC) / Metropolitan Magistrate, Mumbai',
      address: 'Metropolitan Magistrate Court, Mazgaon Complex, Mumbai – 400010. Alternatively, contact: Maharashtra State Commission for Women, Juhu Road, Santacruz (W), Mumbai – 400054',
      website: 'https://mahilaayog.maharashtra.gov.in',
      phone: '022-26100000 (Maharashtra Women Helpline: 181)',
      email: 'mscw@mahrashtra.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Completely FREE. No court fee or filing charge for DV applications. Protection Officers assist with filing at no cost. Legal aid also available free of charge.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No strict limitation — ongoing domestic violence can be reported anytime',
      notes: 'No fixed limitation period. Applications should be filed as soon as it is safe to do so. Courts are sympathetic to delays caused by safety concerns.',
    },
    courtHierarchy: [
      { level: 1, name: 'Judicial Magistrate First Class (JMFC) / Metropolitan Magistrate — where aggrieved person resides, where respondent resides, or where violence occurred', jurisdiction: 'DV applications and emergency orders' },
      { level: 2, name: 'Sessions Court', jurisdiction: 'Appeal from Magistrate\'s order' },
      { level: 3, name: 'Bombay High Court', jurisdiction: 'Revision and writ petitions' },
    ],
    additionalContext: 'Contact Protection Officer (PO) in your district before filing — they assist with drafting the application and can file it on your behalf. Maharashtra Women Helpline: 181. National Emergency: 112. NCW Helpline: 7827170170. File application in court nearest to where you are staying for safety reasons.',
  },

  {
    state: 'Delhi',
    documentType: 'domestic_violence_complaint',
    applicableActs: [
      { actShortName: 'Protection of Women from Domestic Violence Act, 2005', sectionNumbers: ['3', '4', '5', '12', '17', '18', '19', '20', '21', '22', '23'], notes: 'Central Act. Delhi has dedicated fast-track courts for DV cases.' },
    ],
    filingAuthority: {
      name: 'Metropolitan Magistrate, Tis Hazari / Saket / Karkardooma / Dwarka Courts, Delhi',
      address: 'Protection Officer, Zila Sainik Board Building, 9 Church Road, New Delhi – 110001. Alternatively: Delhi Commission for Women, FC-33, Institutional Area, Karkardooma, Delhi – 110032',
      website: 'https://dcw.delhigovt.nic.in',
      phone: '011-23370557 (Delhi Women Helpline: 181)',
      email: 'dcw@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Completely FREE. Delhi Commission for Women provides legal aid. Protection Officers available in every district.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period for ongoing DV',
      notes: 'No fixed limitation. Emergency orders (ex-parte) can be obtained on the same day in urgent cases.',
    },
    courtHierarchy: [
      { level: 1, name: 'Metropolitan Magistrate, Delhi — file in court nearest to where you reside for safety', jurisdiction: 'DV complaints and protection orders' },
      { level: 2, name: 'Additional Sessions Judge / Sessions Judge, Delhi', jurisdiction: 'Appeals' },
      { level: 3, name: 'Delhi High Court', jurisdiction: 'Revision petitions and writ jurisdiction' },
    ],
    additionalContext: 'Delhi has the most active DCW (Delhi Commission for Women) — call 181 or approach a DCW Shakti Shalini center. Protection Officers in Delhi are generally responsive. For emergency: approach nearest police station (PCR van: 112) or One Stop Centre (Sakhi Centre). File application in ANY court where violence occurred, where you reside, or where respondent resides — whichever is safer.',
  },

  {
    state: 'Karnataka',
    documentType: 'domestic_violence_complaint',
    applicableActs: [
      { actShortName: 'Protection of Women from Domestic Violence Act, 2005', sectionNumbers: ['3', '4', '5', '12', '17', '18', '19', '20', '21', '22', '23'], notes: 'Central Act. Karnataka has Protection Officers in each district.' },
    ],
    filingAuthority: {
      name: 'JMFC / Metropolitan Magistrate, Bengaluru. Contact: Karnataka State Women\'s Development Corporation',
      address: 'No. 1/A, Swarna Bhavana, Richmond Road, Bengaluru – 560025',
      website: 'https://kswdc.karnataka.gov.in',
      phone: '080-22253701 (Karnataka Women Helpline: 181)',
      email: 'kswdc@karnataka.gov.in',
    },
    filingFee: { amount: 0, currency: 'INR', notes: 'Completely FREE.' },
    limitationPeriod: { days: null, fromEvent: 'No limitation period', notes: 'File anytime. Emergency protection orders available the same day.' },
    courtHierarchy: [
      { level: 1, name: 'JMFC / Metropolitan Magistrate', jurisdiction: 'DV applications and orders' },
      { level: 2, name: 'Sessions Court', jurisdiction: 'Appeals' },
      { level: 3, name: 'Karnataka High Court', jurisdiction: 'Revision' },
    ],
    additionalContext: 'Karnataka Women Helpline: 181. Vanitha Sahayavani: 1091. One Stop Centres (Sakhi) in major districts. Protection Officers in each district court complex.',
  },

  {
    state: 'Tamil Nadu',
    documentType: 'domestic_violence_complaint',
    applicableActs: [
      { actShortName: 'Protection of Women from Domestic Violence Act, 2005', sectionNumbers: ['3', '4', '5', '12', '17', '18', '19', '20', '21', '22', '23'], notes: 'Central Act. Tamil Nadu has a strong network of Protection Officers and NGO support.' },
    ],
    filingAuthority: {
      name: 'Judicial Magistrate / Metropolitan Magistrate, Chennai. Contact: Tamil Nadu State Commission for Women',
      address: 'Thalamuthu Natarajan Building, 5th Floor, Omanthooran Salai, Chennai – 600002',
      website: 'https://tamilnaduwomen.org',
      phone: '044-28591750 (TN Women Helpline: 181)',
      email: 'tnwomencommission@gmail.com',
    },
    filingFee: { amount: 0, currency: 'INR', notes: 'Completely FREE. Tamil Nadu Legal Services Authority provides free legal aid to DV victims.' },
    limitationPeriod: { days: null, fromEvent: 'No limitation period', notes: 'File anytime. Interim ex-parte orders available urgently.' },
    courtHierarchy: [
      { level: 1, name: 'Metropolitan Magistrate (Chennai) / JMFC (other TN districts)', jurisdiction: 'DV applications' },
      { level: 2, name: 'Sessions Court', jurisdiction: 'Appeals' },
      { level: 3, name: 'Madras High Court', jurisdiction: 'Revision' },
    ],
    additionalContext: 'TN Women Helpline: 181. Mozhigal Centres in Chennai provide immediate legal support. TANSI (Tamil Nadu Social Insurance) also provides support. Applications accepted in Tamil or English.',
  },

  {
    state: 'West Bengal',
    documentType: 'domestic_violence_complaint',
    applicableActs: [
      { actShortName: 'Protection of Women from Domestic Violence Act, 2005', sectionNumbers: ['3', '4', '5', '12', '17', '18', '19', '20', '21', '22', '23'], notes: 'Central Act. WB has a network of Protection Officers and women\'s organizations.' },
    ],
    filingAuthority: {
      name: 'Judicial Magistrate / Metropolitan Magistrate, Kolkata. Contact: West Bengal Commission for Women',
      address: 'Bikash Bhavan (8th Floor), Salt Lake City, Kolkata – 700091',
      website: 'https://wbcw.gov.in',
      phone: '033-23372020 (WB Women Helpline: 181)',
      email: 'wbcw@wb.gov.in',
    },
    filingFee: { amount: 0, currency: 'INR', notes: 'Completely FREE. WB Legal Services Authority provides free legal representation to DV victims.' },
    limitationPeriod: { days: null, fromEvent: 'No limitation period', notes: 'File anytime. Courts issue ex-parte interim orders in urgent cases on the same day.' },
    courtHierarchy: [
      { level: 1, name: 'Metropolitan Magistrate (Kolkata) / JMFC (other WB districts)', jurisdiction: 'DV applications and protection orders' },
      { level: 2, name: 'Sessions Court', jurisdiction: 'Appeals' },
      { level: 3, name: 'Calcutta High Court', jurisdiction: 'Revision' },
    ],
    additionalContext: 'WB Women Helpline: 181. Ujjawala centres in districts provide shelter and legal support. Protection Officers are available in each district. Applications in Bengali or English are accepted.',
  },

  // ═══════════════════════════════════════════════════════════
  // ODISHA
  // ═══════════════════════════════════════════════════════════

  {
    state: 'Odisha',
    documentType: 'consumer_complaint',
    applicableActs: [
      { actShortName: 'Consumer Protection Act, 2019', sectionNumbers: ['2(1)(d)', '34', '35', '38', '69'], notes: 'Central Act applicable in Odisha.' },
      { actShortName: 'Odisha Consumer Protection Rules, 2020', sectionNumbers: ['3', '4'], notes: 'Odisha-specific procedural rules.' },
    ],
    filingAuthority: {
      name: 'District Consumer Disputes Redressal Commission, Bhubaneswar',
      address: 'Kharavela Nagar, Unit-3, Bhubaneswar – 751001, Odisha',
      website: 'https://consumer.odisha.gov.in',
      phone: '0674-2531628',
      email: 'dcdrc-bbsr@odisha.gov.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'FREE for claims up to ₹5,00,000. ₹200 for ₹5L–₹10L. ₹400 for ₹10L–₹50L. Odisha State Commission: ₹2,000 for ₹50L–₹2Cr. National Commission: ₹5,000 for above ₹2Cr.',
      feeSlabs: [
        { claimUpTo: 500000, fee: 0 },
        { claimUpTo: 1000000, fee: 200 },
        { claimUpTo: 5000000, fee: 400 },
        { claimUpTo: 10000000, fee: 2000 },
      ],
    },
    limitationPeriod: {
      days: 730,
      fromEvent: 'date of cause of action',
      notes: '2 years under Section 69 of Consumer Protection Act, 2019. Condonation of delay possible on showing sufficient cause.',
    },
    courtHierarchy: [
      { level: 1, name: 'District Consumer Disputes Redressal Commission (30 districts in Odisha)', jurisdiction: 'Up to ₹50,00,000' },
      { level: 2, name: 'Odisha State Consumer Disputes Redressal Commission, Cuttack', jurisdiction: '₹50L – ₹2Cr' },
      { level: 3, name: 'National Consumer Disputes Redressal Commission, New Delhi', jurisdiction: 'Above ₹2Cr' },
    ],
    additionalContext: 'Odisha has 30 District Consumer Commissions. Online filing at edaakhil.nic.in. Odisha State Commission is located in Cuttack. Complaints can be filed in Odia or English. File where the opposite party has its office or where the cause of action arose.',
  },

  {
    state: 'Odisha',
    documentType: 'rti_application',
    applicableActs: [
      { actShortName: 'Right to Information Act, 2005', sectionNumbers: ['6', '7', '8', '11', '19', '20'], notes: 'Central Act applicable to all Odisha State bodies.' },
    ],
    filingAuthority: {
      name: 'Public Information Officer, Concerned Odisha Government Department',
      address: 'Odisha Secretariat, Bhubaneswar – 751001, Odisha',
      website: 'https://rtiofficer.odisha.gov.in',
      phone: '0674-2536820',
      email: 'rti@odisha.gov.in',
    },
    filingFee: {
      amount: 10,
      currency: 'INR',
      notes: '₹10 by Indian Postal Order (IPO), cash, or treasury challan. BPL cardholders: free on submission of BPL card copy. Photocopy: ₹2 per page. Floppy/CD: ₹50. Inspection: ₹5 per hour after first hour.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period',
      notes: 'PIO must respond within 30 days. Life/liberty matters: 48 hours. First appeal to FAA within 30 days of PIO reply. Second appeal to Odisha Information Commission (OIC) within 90 days of FAA order.',
    },
    courtHierarchy: [
      { level: 1, name: 'Public Information Officer (PIO)', jurisdiction: 'Initial application — respond within 30 days' },
      { level: 2, name: 'First Appellate Authority (FAA)', jurisdiction: 'First appeal — respond within 30 days' },
      { level: 3, name: 'Odisha Information Commission (OIC), Bhubaneswar', jurisdiction: 'Second appeal / complaint for State bodies' },
      { level: 4, name: 'Central Information Commission (CIC), New Delhi', jurisdiction: 'Second appeal for Central Government bodies' },
    ],
    additionalContext: 'The Odisha Information Commission (OIC) is functional and accepts online complaints. Applications can be filed in Odia or English. RTI applications to panchayati raj institutions should be addressed to the respective Gram Panchayat PIO. Odisha government departments are required to proactively disclose information under Section 4.',
  },

  {
    state: 'Odisha',
    documentType: 'legal_notice_landlord',
    applicableActs: [
      { actShortName: 'Transfer of Property Act, 1882', sectionNumbers: ['105', '106', '108', '111'], notes: 'Primary legislation for leases and tenancies in Odisha.' },
      { actShortName: 'Odisha House Rent Control Act, 1967', sectionNumbers: ['2', '7', '7A', '14', '14A', '22'], notes: 'Governs rent control and eviction in notified urban areas including Bhubaneswar, Cuttack, and other Municipal Corporation / NAC areas.' },
    ],
    filingAuthority: {
      name: 'Rent Controller (Civil Judge) / Rent Control Tribunal, Bhubaneswar / Cuttack',
      address: 'District Court Complex, Capitol Hill, Bhubaneswar – 751001, Odisha',
      website: 'https://districts.ecourts.gov.in/bhubaneswar',
      phone: '0674-2390001',
      email: 'hc-orissa@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Legal demand notice: no fee. Court fee on suit filing: as per Odisha Court Fees Act — ad valorem fees on claim amount. Eviction petition under OHRC Act: nominal court fee.',
    },
    limitationPeriod: {
      days: 1095,
      fromEvent: 'cause of action / breach of tenancy',
      notes: '3 years for money recovery under Limitation Act 1963. Under Odisha House Rent Control Act, eviction proceedings have specific timelines. Notice under Section 106 TPA: 15 days for monthly residential tenancy.',
    },
    courtHierarchy: [
      { level: 1, name: 'Rent Controller (Civil Judge Junior Division) for OHRC Act premises', jurisdiction: 'Premises in notified urban areas under Odisha HRC Act 1967' },
      { level: 2, name: 'Rent Control Tribunal / District Judge', jurisdiction: 'Appeals from Rent Controller' },
      { level: 3, name: 'Orissa High Court, Cuttack', jurisdiction: 'Revisions, writ petitions, high-value matters' },
    ],
    additionalContext: 'The Odisha House Rent Control Act 1967 applies to buildings in Bhubaneswar, Cuttack, and other notified urban areas. Always send legal notice by Registered Post with Acknowledgement Due (AD). Keep copies of rent receipts, rent agreement, and all correspondence. For properties outside notified areas, TPA 1882 governs.',
  },

  {
    state: 'Odisha',
    documentType: 'cheque_bounce_notice',
    applicableActs: [
      { actShortName: 'Negotiable Instruments Act, 1881', sectionNumbers: ['138', '139', '141', '142', '142A', '143A', '147'], notes: 'Central Act governing cheque dishonour. Post-2015 amendment: complaint filed where payee\'s bank branch is situated.' },
    ],
    filingAuthority: {
      name: 'Judicial Magistrate First Class (JMFC), Bhubaneswar / Cuttack',
      address: 'Chief Judicial Magistrate Court, District Court Complex, Capitol Hill, Bhubaneswar – 751001, Odisha',
      website: 'https://districts.ecourts.gov.in/bhubaneswar',
      phone: '0674-2390001',
      email: 'hc-orissa@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Demand notice: no fee. Court complaint filing fee: nominal (~₹100–₹200). Costs of notice claimable in complaint. Section 143A interim compensation of up to 20% of cheque amount can be sought at first hearing.',
    },
    limitationPeriod: {
      days: 75,
      fromEvent: 'date of bank dishonour memo',
      notes: 'Strict timeline under Section 142 NI Act: (1) Send demand notice within 30 days of bank dishonour memo; (2) Allow 15-day payment window; (3) File complaint within 30 days of expiry of 15-day window. Missing any step is fatal to the case.',
    },
    courtHierarchy: [
      { level: 1, name: 'Judicial Magistrate First Class (JMFC) — file where payee\'s bank branch is located', jurisdiction: 'Cheque bounce complaint under Section 138 NI Act' },
      { level: 2, name: 'Sessions Court / Additional Sessions Judge', jurisdiction: 'Appeal from JMFC order' },
      { level: 3, name: 'Orissa High Court, Cuttack', jurisdiction: 'Revision and quashing petitions under Section 482 CrPC / Section 528 BNSS' },
    ],
    additionalContext: 'For multiple dishonoured cheques from the same drawer, file a separate complaint for each cheque. Always collect the bank\'s dishonour memo specifying the exact reason (insufficient funds / account closed / stop payment / signature mismatch). Send demand notice by both Registered Post AD and Speed Post to create a legal presumption of service under Section 27 General Clauses Act. Lok Adalat settlement available for fast resolution without criminal record.',
  },

  {
    state: 'Odisha',
    documentType: 'domestic_violence_complaint',
    applicableActs: [
      { actShortName: 'Protection of Women from Domestic Violence Act, 2005', sectionNumbers: ['3', '4', '5', '12', '17', '18', '19', '20', '21', '22', '23'], notes: 'Central Act. Odisha has Protection Officers in all 30 districts under the Department of Women and Child Development.' },
    ],
    filingAuthority: {
      name: 'Judicial Magistrate First Class (JMFC), Bhubaneswar. Contact: Odisha State Commission for Women / Protection Officer',
      address: 'Odisha State Commission for Women, Plot No. 44/B, Satya Nagar, Bhubaneswar – 751007, Odisha',
      website: 'https://wcd.odisha.gov.in',
      phone: '0674-2570006 (Odisha Women Helpline: 181 / Abhaya Helpline: 1800-345-7051)',
      email: 'oscw-wb@nic.in',
    },
    filingFee: {
      amount: 0,
      currency: 'INR',
      notes: 'Completely FREE. No court fee or filing charge. Protection Officers assist with filing Form I at no cost. Odisha State Legal Services Authority (OSLSA) provides free legal aid to domestic violence survivors.',
    },
    limitationPeriod: {
      days: null,
      fromEvent: 'No limitation period — file when safe to do so',
      notes: 'No fixed limitation period. Courts are sympathetic to delays caused by safety concerns or coercion. Emergency ex-parte protection orders can be obtained on the same day in urgent situations under Section 23 PWDVA.',
    },
    courtHierarchy: [
      { level: 1, name: 'Judicial Magistrate First Class (JMFC) — file where aggrieved person resides, where respondent resides, or where violence occurred', jurisdiction: 'DV applications, protection orders, residence orders, monetary relief' },
      { level: 2, name: 'Sessions Court', jurisdiction: 'Appeal from JMFC orders under Section 29 PWDVA' },
      { level: 3, name: 'Orissa High Court, Cuttack', jurisdiction: 'Revision petitions and writ jurisdiction' },
    ],
    additionalContext: 'Odisha Women Helpline: 181 (Toll-free, 24×7). Abhaya Helpline: 1800-345-7051 (Toll-free). National Emergency: 112. NCW Helpline: 7827170170. Contact the nearest Protection Officer (PO) in your district — they assist in drafting Form I application and can file it on your behalf. One Stop Centres (Sakhi Centres) operate across Odisha districts providing shelter, legal aid, medical assistance, and counselling. File application in any court near where you are currently staying — your safety takes priority over jurisdiction concerns.',
  },
];

/* ---------------------------------------------------------------------------
 * Seed function
 * ------------------------------------------------------------------------ */

async function main() {
  console.log('🌱 NyayaSetu — Seeding JurisdictionRules');
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

  for (const rule of JURISDICTIONS) {
    const existing = await JurisdictionRule.findOne({
      state: rule.state,
      documentType: rule.documentType,
    });

    if (existing) {
      console.log(`   ⏭  Skipped: ${rule.state} — ${rule.documentType}`);
      skipped++;
      continue;
    }

    await JurisdictionRule.create(rule);
    console.log(`   ✅ Inserted: ${rule.state} — ${rule.documentType}`);
    inserted++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Skipped  : ${skipped}`);
  console.log(`   Total    : ${JURISDICTIONS.length}`);

  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

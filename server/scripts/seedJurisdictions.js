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

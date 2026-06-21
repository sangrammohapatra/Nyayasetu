'use strict';

/**
 * rtiMinistries.js
 *
 * Reference data for Central Government Ministries and major State departments.
 * PIO details are approximate — users should verify current addresses on the
 * official Ministry website or rtionline.gov.in before filing.
 *
 * Central RTI fee: ₹10 (BPL applicants: free)
 * Portal: https://rtionline.gov.in (for Ministries/Depts under Central Govt)
 */

const CENTRAL_MINISTRIES = [
  {
    id: 'mha',
    name: 'Ministry of Home Affairs',
    shortName: 'MHA',
    category: 'Internal Security & Administration',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Home Affairs, North Block, New Delhi - 110001',
    email: 'rti-mha@nic.in',
    website: 'https://mha.gov.in',
    rtiPortalCode: 'MHA',
    departments: ['Internal Security', 'Border Management', 'J&K Affairs', 'States Division'],
  },
  {
    id: 'molaw',
    name: 'Ministry of Law & Justice',
    shortName: 'MoL&J',
    category: 'Legal Affairs',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Law and Justice, 4th Floor, A-Wing, Shastri Bhawan, New Delhi - 110001',
    email: 'rti-molj@nic.in',
    website: 'https://lawmin.gov.in',
    rtiPortalCode: 'MLJ',
    departments: ['Department of Legal Affairs', 'Department of Justice', 'Legislative Department'],
  },
  {
    id: 'moe',
    name: 'Ministry of Education',
    shortName: 'MoE',
    category: 'Education',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Education, Shastri Bhawan, New Delhi - 110001',
    email: 'rti-moe@nic.in',
    website: 'https://education.gov.in',
    rtiPortalCode: 'MOE',
    departments: ['Department of School Education & Literacy', 'Department of Higher Education'],
  },
  {
    id: 'mohfw',
    name: 'Ministry of Health & Family Welfare',
    shortName: 'MoHFW',
    category: 'Health',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Health and Family Welfare, Nirman Bhawan, New Delhi - 110011',
    email: 'rti-mohfw@nic.in',
    website: 'https://mohfw.gov.in',
    rtiPortalCode: 'MHF',
    departments: ['Department of Health & Family Welfare', 'Department of Health Research'],
  },
  {
    id: 'dopt',
    name: 'Department of Personnel & Training (DoPT)',
    shortName: 'DoPT',
    category: 'Personnel & Governance',
    pioDesignation: 'Public Information Officer',
    address: 'Department of Personnel and Training, North Block, New Delhi - 110001',
    email: 'rti-dopt@nic.in',
    website: 'https://dopt.gov.in',
    rtiPortalCode: 'DOPT',
    departments: ['Establishment Division', 'Training Division', 'Vigilance Division'],
  },
  {
    id: 'mofinance',
    name: 'Ministry of Finance',
    shortName: 'MoF',
    category: 'Finance & Taxation',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Finance, North Block, New Delhi - 110001',
    email: 'rti-mof@nic.in',
    website: 'https://finmin.nic.in',
    rtiPortalCode: 'MOF',
    departments: ['Department of Revenue', 'Department of Expenditure', 'Department of Economic Affairs', 'CBDT', 'CBIC'],
  },
  {
    id: 'mord',
    name: 'Ministry of Rural Development',
    shortName: 'MoRD',
    category: 'Rural Development',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Rural Development, Krishi Bhawan, New Delhi - 110001',
    email: 'rti-mord@nic.in',
    website: 'https://rural.nic.in',
    rtiPortalCode: 'MRD',
    departments: ['Department of Rural Development', 'Department of Land Resources'],
  },
  {
    id: 'mohua',
    name: 'Ministry of Housing & Urban Affairs',
    shortName: 'MoHUA',
    category: 'Urban Development',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Housing and Urban Affairs, Nirman Bhawan, New Delhi - 110011',
    email: 'rti-mohua@nic.in',
    website: 'https://mohua.gov.in',
    rtiPortalCode: 'HUA',
    departments: ['Urban Development', 'Smart Cities', 'RERA', 'PMAY'],
  },
  {
    id: 'mowr',
    name: 'Ministry of Jal Shakti',
    shortName: 'Jal Shakti',
    category: 'Water Resources',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Jal Shakti, Shram Shakti Bhawan, New Delhi - 110001',
    email: 'rti-jalshakti@nic.in',
    website: 'https://jalshakti-dowr.gov.in',
    rtiPortalCode: 'JS',
    departments: ['Department of Water Resources', 'Dept of Drinking Water & Sanitation'],
  },
  {
    id: 'mol',
    name: 'Ministry of Labour & Employment',
    shortName: 'MoLE',
    category: 'Labour & Employment',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Labour and Employment, Shram Shakti Bhawan, New Delhi - 110001',
    email: 'rti-labour@nic.in',
    website: 'https://labour.gov.in',
    rtiPortalCode: 'MLE',
    departments: ['Central Industrial Relations Machinery', 'EPFO', 'ESIC'],
  },
  {
    id: 'morvs',
    name: 'Ministry of Social Justice & Empowerment',
    shortName: 'MoSJE',
    category: 'Social Justice',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Social Justice and Empowerment, Shastri Bhawan, New Delhi - 110001',
    email: 'rti-sje@nic.in',
    website: 'https://socialjustice.gov.in',
    rtiPortalCode: 'SJE',
    departments: ['Department of Social Justice & Empowerment', 'Department for Empowerment of Persons with Disabilities'],
  },
  {
    id: 'meit',
    name: 'Ministry of Electronics & IT (MeitY)',
    shortName: 'MeitY',
    category: 'Technology',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Electronics and Information Technology, Electronics Niketan, 6, CGO Complex, New Delhi - 110003',
    email: 'rti-meity@nic.in',
    website: 'https://meity.gov.in',
    rtiPortalCode: 'MEI',
    departments: ['DeitY', 'NIC', 'Cyber Security'],
  },
  {
    id: 'morths',
    name: 'Ministry of Road Transport & Highways',
    shortName: 'MoRTH',
    category: 'Transport',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Road Transport and Highways, Transport Bhawan, 1, Parliament Street, New Delhi - 110001',
    email: 'rti-morth@nic.in',
    website: 'https://morth.nic.in',
    rtiPortalCode: 'RTH',
    departments: ['NH Division', 'Transport Research Wing', 'NHAI'],
  },
  {
    id: 'mopng',
    name: 'Ministry of Petroleum & Natural Gas',
    shortName: 'MoPNG',
    category: 'Energy',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Petroleum and Natural Gas, Shastri Bhawan, New Delhi - 110001',
    email: 'rti-petroleum@nic.in',
    website: 'https://petroleum.nic.in',
    rtiPortalCode: 'PNG',
    departments: ['Upstream Division', 'Downstream Division', 'IOC', 'ONGC', 'BPCL'],
  },
  {
    id: 'upsc',
    name: 'Union Public Service Commission (UPSC)',
    shortName: 'UPSC',
    category: 'Public Services',
    pioDesignation: 'Public Information Officer',
    address: 'UPSC, Dholpur House, Shahjahan Road, New Delhi - 110069',
    email: 'rti-upsc@nic.in',
    website: 'https://upsc.gov.in',
    rtiPortalCode: 'UPSC',
    departments: ['Examination Division', 'Recruitment Division'],
  },
  {
    id: 'eci',
    name: 'Election Commission of India',
    shortName: 'ECI',
    category: 'Elections',
    pioDesignation: 'Public Information Officer',
    address: 'Election Commission of India, Nirvachan Sadan, Ashoka Road, New Delhi - 110001',
    email: 'rti-eci@nic.in',
    website: 'https://eci.gov.in',
    rtiPortalCode: 'ECI',
    departments: ['Election Division', 'Media & Communication'],
  },
  {
    id: 'cbi',
    name: 'Central Bureau of Investigation (CBI)',
    shortName: 'CBI',
    category: 'Investigation',
    pioDesignation: 'Public Information Officer',
    address: 'Central Bureau of Investigation, 5, Lodhi Road, New Delhi - 110003',
    email: 'rti-cbi@nic.in',
    website: 'https://cbi.gov.in',
    rtiPortalCode: 'CBI',
    departments: ['Anti-Corruption Branch', 'Special Crimes Branch'],
  },
  {
    id: 'moca',
    name: 'Ministry of Civil Aviation',
    shortName: 'MoCA',
    category: 'Aviation',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Civil Aviation, Rajiv Gandhi Bhawan, Safdarjung Airport, New Delhi - 110003',
    email: 'rti-aviation@nic.in',
    website: 'https://civilaviation.gov.in',
    rtiPortalCode: 'MCA',
    departments: ['DGCA', 'AAI', 'BCAS'],
  },
  {
    id: 'moa',
    name: 'Ministry of Agriculture & Farmers Welfare',
    shortName: 'MoAFW',
    category: 'Agriculture',
    pioDesignation: 'Public Information Officer',
    address: 'Ministry of Agriculture and Farmers Welfare, Krishi Bhawan, New Delhi - 110001',
    email: 'rti-agriculture@nic.in',
    website: 'https://agricoop.nic.in',
    rtiPortalCode: 'MAF',
    departments: ['Department of Agriculture', 'Department of Fisheries', 'Department of Animal Husbandry'],
  },
  {
    id: 'other_central',
    name: 'Other Central Government Department',
    shortName: 'Other (Central)',
    category: 'Other',
    pioDesignation: 'Public Information Officer',
    address: '',
    email: '',
    website: 'https://rtionline.gov.in',
    rtiPortalCode: null,
    departments: [],
  },
];

// ─── States (for state-level RTI) ─────────────────────────────────────────────
// State RTIs go to respective State PIOs; fees vary (₹10-50)

const STATE_DEPARTMENTS = [
  'Revenue & Land Records',
  'Police Department',
  'Municipal Corporation / Local Body',
  'State PWD (Roads & Buildings)',
  'Electricity Board / Distribution Company',
  'Water Supply & Sanitation',
  'School Education Department',
  'Higher & Technical Education',
  'Health & Family Welfare',
  'Agriculture Department',
  'Forest Department',
  'Labour & Employment',
  'Social Justice & Empowerment',
  'Urban Development / Town Planning',
  'Housing Board',
  'Transport Department (RTO)',
  'Food & Civil Supplies (PDS)',
  'MNREGA / Rural Development',
  'Panchayati Raj',
  'State Election Commission',
  'State Lokayukta',
  'Other State Department',
];

// ─── RTI Online Portal info ───────────────────────────────────────────────────

const RTI_PORTAL = {
  central: {
    url: 'https://rtionline.gov.in',
    name: 'RTI Online Portal (Central)',
    instructions: 'Register/login at rtionline.gov.in → Click "Submit Request" → Select Ministry/Dept → Pay ₹10 online → Submit',
  },
  state: {
    note: 'Each state has its own RTI portal or requires physical submission. Check your state government website.',
    commonPortals: {
      Maharashtra: 'https://rti.maharashtra.gov.in',
      Delhi: 'https://rti.delhi.gov.in',
      Karnataka: 'https://rtionline.karnataka.gov.in',
      TamilNadu: 'https://rti.tn.gov.in',
      Gujarat: 'https://rtionline.gujarat.gov.in',
      WestBengal: 'https://wbprd.wb.gov.in/rti',
      UttarPradesh: 'https://rti.up.gov.in',
      Rajasthan: 'https://rti.rajasthan.gov.in',
    },
  },
};

// ─── CIC Contact ─────────────────────────────────────────────────────────────

const CIC_INFO = {
  name: 'Central Information Commission (CIC)',
  address: 'Central Information Commission, Club Building (Near Post Office), Old JNU Campus, New Delhi - 110067',
  phone: '011-26107924',
  email: 'cic-india@nic.in',
  website: 'https://cic.gov.in',
  eFilingPortal: 'https://cic.gov.in/online-appeal',
};

/**
 * getMinistryById — resolve ministry data by ID.
 * @param {string} id
 */
function getMinistryById(id) {
  return CENTRAL_MINISTRIES.find((m) => m.id === id) || null;
}

/**
 * searchMinistries — simple substring search on name/category.
 * @param {string} query
 */
function searchMinistries(query) {
  if (!query) return CENTRAL_MINISTRIES;
  const q = query.toLowerCase();
  return CENTRAL_MINISTRIES.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      m.shortName.toLowerCase().includes(q)
  );
}

module.exports = {
  CENTRAL_MINISTRIES,
  STATE_DEPARTMENTS,
  RTI_PORTAL,
  CIC_INFO,
  getMinistryById,
  searchMinistries,
};

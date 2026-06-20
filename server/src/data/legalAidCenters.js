const NALSA_HELPLINE = '1516';
const NALSA_WEBSITE = 'https://nalsa.gov.in';

/**
 * State Legal Services Authority (SLSA) contact data.
 * Source: NALSA public directory (nalsa.gov.in).
 * Keyed by standard Indian state/UT codes.
 */
const LEGAL_AID_CENTERS = {
  DL: {
    state: 'Delhi',
    authority: 'Delhi State Legal Services Authority',
    address: 'Patiala House Courts Complex, New Delhi - 110001',
    phone: '011-23074054',
    email: 'dslsa@nic.in',
    website: 'https://dslsa.org',
  },
  MH: {
    state: 'Maharashtra',
    authority: 'Maharashtra State Legal Services Authority',
    address: 'Mumbai High Court Annexe, Fort, Mumbai - 400032',
    phone: '022-22633855',
    email: 'mslsa@nic.in',
    website: 'https://mslsa.nic.in',
  },
  UP: {
    state: 'Uttar Pradesh',
    authority: 'U.P. State Legal Services Authority',
    address: 'B-Block, Lal Bahadur Shastri Bhawan, Lucknow - 226001',
    phone: '0522-2239016',
    email: 'upslsa@nic.in',
  },
  GJ: {
    state: 'Gujarat',
    authority: 'Gujarat State Legal Services Authority',
    address: 'Gujarat High Court Campus, Sola, Ahmedabad - 380060',
    phone: '079-27560059',
    email: 'gslsa@nic.in',
  },
  KA: {
    state: 'Karnataka',
    authority: 'Karnataka State Legal Services Authority',
    address: 'High Court of Karnataka, Ambedkar Veedhi, Bangalore - 560001',
    phone: '080-22111714',
    email: 'kslsa@nic.in',
    website: 'https://kslsa.kar.nic.in',
  },
  TN: {
    state: 'Tamil Nadu',
    authority: 'Tamil Nadu State Legal Services Authority',
    address: 'High Court Complex, Chennai - 600104',
    phone: '044-25340509',
    email: 'tnslsa@nic.in',
  },
  WB: {
    state: 'West Bengal',
    authority: 'West Bengal State Legal Services Authority',
    address: 'High Court Building, Kolkata - 700001',
    phone: '033-22435495',
    email: 'wbslsa@nic.in',
    website: 'https://wbslsa.org',
  },
  RJ: {
    state: 'Rajasthan',
    authority: 'Rajasthan State Legal Services Authority',
    address: 'Rajasthan High Court Complex, Jodhpur - 342001',
    phone: '0291-2543912',
    email: 'rslsa@nic.in',
  },
  MP: {
    state: 'Madhya Pradesh',
    authority: 'M.P. State Legal Services Authority',
    address: 'High Court of M.P., South Civil Lines, Jabalpur - 482001',
    phone: '0761-2621092',
    email: 'mpslsa@nic.in',
  },
  TS: {
    state: 'Telangana',
    authority: 'Telangana State Legal Services Authority',
    address: 'High Court of Telangana, Nayapul, Hyderabad - 500066',
    phone: '040-23210056',
    email: 'tslsa@nic.in',
  },
  AP: {
    state: 'Andhra Pradesh',
    authority: 'Andhra Pradesh State Legal Services Authority',
    address: 'High Court of A.P., Amaravati - 522503',
    phone: '0863-2340018',
    email: 'apslsa@nic.in',
  },
  KL: {
    state: 'Kerala',
    authority: 'Kerala State Legal Services Authority',
    address: 'High Court of Kerala, Ernakulam - 682031',
    phone: '0484-2391800',
    email: 'kerlsa@nic.in',
    website: 'https://kelsa.nic.in',
  },
  BR: {
    state: 'Bihar',
    authority: 'Bihar State Legal Services Authority',
    address: 'Patna High Court Campus, Bankipur, Patna - 800001',
    phone: '0612-2219038',
    email: 'bslsa@nic.in',
  },
  PB: {
    state: 'Punjab',
    authority: 'Punjab State Legal Services Authority',
    address: 'Punjab & Haryana High Court Complex, Chandigarh - 160001',
    phone: '0172-2749430',
    email: 'pslsa@nic.in',
  },
  HR: {
    state: 'Haryana',
    authority: 'Haryana State Legal Services Authority',
    address: 'Punjab & Haryana High Court Complex, Chandigarh - 160001',
    phone: '0172-2749432',
    email: 'hslsa@nic.in',
  },
  OR: {
    state: 'Odisha',
    authority: 'Odisha State Legal Services Authority',
    address: 'Orissa High Court, Cuttack - 753002',
    phone: '0671-2305750',
    email: 'oslsa@nic.in',
  },
  AS: {
    state: 'Assam',
    authority: 'Assam State Legal Services Authority',
    address: 'Gauhati High Court Complex, Guwahati - 781001',
    phone: '0361-2525505',
    email: 'aslsa@nic.in',
  },
  JH: {
    state: 'Jharkhand',
    authority: 'Jharkhand State Legal Services Authority',
    address: 'Jharkhand High Court, H.E.C. Area, Ranchi - 834002',
    phone: '0651-2482208',
    email: 'jhslsa@nic.in',
  },
  CG: {
    state: 'Chhattisgarh',
    authority: 'Chhattisgarh State Legal Services Authority',
    address: 'Chhattisgarh High Court, Civil Lines, Bilaspur - 495001',
    phone: '07752-242111',
    email: 'cgslsa@nic.in',
  },
  UK: {
    state: 'Uttarakhand',
    authority: 'Uttarakhand State Legal Services Authority',
    address: 'High Court of Uttarakhand, Nainital - 263001',
    phone: '05942-235472',
    email: 'ukslsa@nic.in',
  },
  HP: {
    state: 'Himachal Pradesh',
    authority: 'H.P. State Legal Services Authority',
    address: 'H.P. High Court, Ravenswood, Shimla - 171001',
    phone: '0177-2622526',
    email: 'hpslsa@nic.in',
  },
  GA: {
    state: 'Goa',
    authority: 'Goa State Legal Services Authority',
    address: 'High Court of Bombay at Goa, Panaji - 403001',
    phone: '0832-2421484',
    email: 'goa-slsa@nic.in',
  },
  MN: {
    state: 'Manipur',
    authority: 'Manipur State Legal Services Authority',
    address: 'High Court of Manipur, Imphal - 795001',
    phone: '0385-2450491',
    email: 'mnslsa@nic.in',
  },
  ML: {
    state: 'Meghalaya',
    authority: 'Meghalaya State Legal Services Authority',
    address: 'High Court of Meghalaya, Shillong - 793001',
    phone: '0364-2502468',
    email: 'mlslsa@nic.in',
  },
  NL: {
    state: 'Nagaland',
    authority: 'Nagaland State Legal Services Authority',
    address: 'Kohima, Nagaland - 797001',
    phone: '0370-2290567',
    email: 'nlslsa@nic.in',
  },
  TR: {
    state: 'Tripura',
    authority: 'Tripura State Legal Services Authority',
    address: 'High Court of Tripura, Agartala - 799001',
    phone: '0381-2325631',
    email: 'trslsa@nic.in',
  },
  AR: {
    state: 'Arunachal Pradesh',
    authority: 'Arunachal Pradesh State Legal Services Authority',
    address: 'Itanagar, Arunachal Pradesh - 791111',
    phone: '0360-2291472',
    email: 'arslsa@nic.in',
  },
  MZ: {
    state: 'Mizoram',
    authority: 'Mizoram State Legal Services Authority',
    address: 'Aizawl, Mizoram - 796001',
    phone: '0389-2311362',
    email: 'mzslsa@nic.in',
  },
  SK: {
    state: 'Sikkim',
    authority: 'Sikkim State Legal Services Authority',
    address: 'High Court of Sikkim, Gangtok - 737101',
    phone: '03592-202617',
    email: 'skslsa@nic.in',
  },
  JK: {
    state: 'Jammu & Kashmir',
    authority: 'J&K Legal Services Authority',
    address: 'High Court of J&K, Srinagar - 190001',
    phone: '0194-2473916',
    email: 'jkslsa@nic.in',
  },
  LA: {
    state: 'Ladakh',
    authority: 'Ladakh Legal Services Authority',
    address: 'Leh, Ladakh - 194101',
    phone: '01982-252012',
    email: 'laslsa@nic.in',
  },
  CH: {
    state: 'Chandigarh',
    authority: 'Chandigarh State Legal Services Authority',
    address: 'High Court Complex, Chandigarh - 160001',
    phone: '0172-2748400',
    email: 'chslsa@nic.in',
  },
};

const NALSA_DEFAULT = {
  state: 'India',
  authority: 'National Legal Services Authority (NALSA)',
  address: '12/11, Jam Nagar House, Shahjahan Road, New Delhi - 110011',
  phone: '011-23387054',
  email: 'nalsa@nic.in',
  website: NALSA_WEBSITE,
};

/**
 * Returns SLSA data for a state code, falling back to NALSA national office.
 * @param {string} stateCode  e.g. 'MH', 'DL', 'KA'
 * @returns {Object}
 */
function getLegalAidCenter(stateCode) {
  if (!stateCode) return { ...NALSA_DEFAULT, helpline: NALSA_HELPLINE };
  const center = LEGAL_AID_CENTERS[stateCode.toUpperCase()];
  return center
    ? { ...center, helpline: NALSA_HELPLINE }
    : { ...NALSA_DEFAULT, helpline: NALSA_HELPLINE };
}

module.exports = { LEGAL_AID_CENTERS, getLegalAidCenter, NALSA_HELPLINE, NALSA_WEBSITE };

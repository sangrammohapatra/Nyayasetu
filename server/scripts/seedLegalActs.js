/**
 * scripts/seedLegalActs.js
 *
 * Seeds 8 LegalAct records with real section text and simplified plain-language versions.
 * Run: node scripts/seedLegalActs.js
 * Safe to re-run — checks by shortName before inserting.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const LegalAct = require('../src/models/LegalAct.model');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/nyayasetu';

/* ---------------------------------------------------------------------------
 * Acts data
 * ------------------------------------------------------------------------ */

const ACTS = [

  // ══════════════════════════════════════════════════════════════════════════
  // 1. CONSUMER PROTECTION ACT, 2019
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Consumer Protection Act 2019',
    fullName: 'The Consumer Protection Act, 2019',
    year: 2019,
    type: 'central',
    description: 'An Act to provide for protection of the interests of consumers and for the said purpose, to establish authorities for timely and effective administration and settlement of consumers disputes.',
    sections: [
      {
        number: '2(1)(d)',
        title: 'Definition of Consumer',
        text: '"Consumer" means any person who— (i) buys any goods for a consideration which has been paid or promised or partly paid and partly promised, or under any system of deferred payment and includes any user of such goods other than the person who buys such goods for consideration paid or promised or partly paid or partly promised, or under any system of deferred payment, when such use is made with the approval of such person, but does not include a person who obtains such goods for resale or for any commercial purpose; or (ii) hires or avails of any service for a consideration which has been paid or promised or partly paid and partly promised, or under any system of deferred payment and includes any beneficiary of such service other than the person who hires or avails of the service for consideration paid or promised, or partly paid and partly promised, or under any system of deferred payment, when such services are availed of with the approval of the first mentioned person, but does not include a person who avails of such service for any commercial purpose.',
        simplifiedText: 'A consumer is anyone who buys goods or services for personal use (not for resale or business). If you bought a product or service and paid for it (or are paying in instalments), you are a consumer and have rights under this Act. You can also claim rights on behalf of family members who use what you bought.',
        relevantTo: ['consumer_complaint', 'insurance_claim'],
      },
      {
        number: '35',
        title: 'Filing a Complaint',
        text: 'A complaint in relation to any goods sold or delivered or agreed to be sold or delivered or any service provided or agreed to be provided may be filed with a District Commission by— (a) the consumer to whom such goods are sold or delivered or agreed to be sold or delivered or such service is provided or agreed to be provided; (b) any recognised consumer association whether the consumer to whom the goods sold or delivered or agreed to be sold or delivered or service provided or agreed to be provided is a member of such association or not; (c) one or more consumers, where there are numerous consumers having the same interest, with the permission of the District Commission, on behalf of, or for the benefit of, all consumers so interested; or (d) the Central Government or the State Government.',
        simplifiedText: 'Who can file a consumer complaint? (1) You yourself — the person who bought the product/service. (2) A consumer association on your behalf. (3) Multiple consumers together if they have the same problem. (4) The government. You do not need a lawyer to file a consumer complaint.',
        relevantTo: ['consumer_complaint', 'insurance_claim'],
      },
      {
        number: '38',
        title: 'Procedure on Admission of Complaint',
        text: 'The District Commission shall, on admission of a complaint, if it relates to goods in respect of which the procedure specified under section 38 is applicable, or if it relates to a service, proceed as follows: (a) refer a copy of the admitted complaint, within twenty-one days from the date of its admission to the opposite party mentioned in the complaint directing him to give his version of the case within a period of thirty days or such extended period not exceeding fifteen days as may be granted by the District Commission.',
        simplifiedText: 'After your complaint is accepted, the court sends a copy to the company and asks them to reply within 30 days. If they do not reply, the court may proceed ex-parte (in their absence). You will be given a hearing date. The process is straightforward and consumer-friendly.',
        relevantTo: ['consumer_complaint', 'insurance_claim'],
      },
      {
        number: '69',
        title: 'Limitation Period',
        text: 'The District Commission, the State Commission or the National Commission shall not admit a complaint unless it is filed within two years from the date on which the cause of action has arisen: Provided that where the complainant satisfies the District Commission, the State Commission or the National Commission, as the case may be, that he had sufficient cause for not filing the complaint within such period, such Commission may entertain the complaint after recording its reasons for condoning such delay.',
        simplifiedText: 'You have 2 years from the date of the problem to file your complaint. If you missed this deadline, you can still explain your reason for delay and the court may accept it. Important: File as soon as possible. Time-barred complaints are harder to get admitted.',
        relevantTo: ['consumer_complaint', 'insurance_claim'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 2. RIGHT TO INFORMATION ACT, 2005
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Right to Information Act 2005',
    fullName: 'The Right to Information Act, 2005',
    year: 2005,
    type: 'central',
    description: 'An Act to provide for setting out the practical regime of right to information for citizens to secure access to information under the control of public authorities.',
    sections: [
      {
        number: '6',
        title: 'Request for Obtaining Information',
        text: '(1) A person, who desires to obtain any information under this Act, shall make a request in writing or through electronic means in English or Hindi or in the official language of the area in which the application is being made, accompanying such fee as may be prescribed, to— (a) the Central Public Information Officer or State Public Information Officer, as the case may be, of the concerned public authority; (b) the Central Assistant Public Information Officer or State Assistant Public Information Officer, as the case may be, specifying the particulars of the information sought by him or her. (2) An applicant making request for information shall not be required to give any reason for requesting the information or any other personal details except those that may be necessary for contacting him.',
        simplifiedText: 'You have the right to ask any government department for information in writing. Pay ₹10 (or free for BPL). You do NOT have to explain why you want the information. Write in Hindi, English, or your state language. You can also apply online at rtionline.gov.in.',
        relevantTo: ['rti_application'],
      },
      {
        number: '7',
        title: 'Disposal of Request',
        text: '(1) Subject to the proviso to sub-section (2) of section 5 or the proviso to sub-section (3) of section 6, the Central Public Information Officer or State Public Information Officer, as the case may be, on receipt of a request under section 6 shall, as expeditiously as possible, and in any case within thirty days of the receipt of the request, either provide the information on payment of such fee as may be prescribed or reject the request for any of the reasons specified in sections 8 and 9. (2) If the information sought for concerns the life or liberty of a person, the same shall be provided within forty-eight hours of the receipt of the request.',
        simplifiedText: 'The government must reply within 30 days. If your question relates to someone\'s life or safety, they must reply within 48 hours. If you are asked to pay extra fee for copies, do not pay more than ₹2 per page. If the PIO does not reply in 30 days, it is considered a deemed refusal — you can file an appeal.',
        relevantTo: ['rti_application'],
      },
      {
        number: '8',
        title: 'Exemption from Disclosure',
        text: '(1) Notwithstanding anything contained in this Act, there shall be no obligation to give any citizen,— (a) information, disclosure of which would prejudicially affect the sovereignty and integrity of India, the security, strategic, scientific or economic interests of the State, relation with foreign State or lead to incitement of an offence; (b) information which has been expressly forbidden to be published by any court of law or tribunal or the disclosure of which may constitute contempt of court; (c) information, the disclosure of which would cause a breach of privilege of Parliament or the State Legislature; (d) information including commercial confidence, trade secrets or intellectual property, the disclosure of which would harm the competitive position of a third party, unless the competent authority is satisfied that larger public interest warrants the disclosure of such information; (e) information available to a person in his fiduciary relationship, unless the competent authority is satisfied that the larger public interest warrants the disclosure of such information.',
        simplifiedText: 'The government can refuse to give information if it would harm national security, court orders, personal privacy, or trade secrets. However, even for exempt information, the government must tell you WHY they are refusing. They cannot refuse without giving a proper reason.',
        relevantTo: ['rti_application'],
      },
      {
        number: '19',
        title: 'Appeal',
        text: '(1) Any person who, does not receive a decision within the time specified in sub-section (1) or clause (a) of sub-section (3) of section 7, or is aggrieved by a decision of the Central Public Information Officer or State Public Information Officer, as the case may be, may within thirty days from the expiry of such period or from the receipt of such a decision prefer an appeal to such officer who is senior in rank to the Central Public Information Officer or State Public Information Officer as the case may be, in each public authority. (3) A second appeal against the decision under sub-section (1) shall lie within ninety days from the date on which the decision should have been made or was actually received, with the Central Information Commission or the State Information Commission.',
        simplifiedText: 'If you did not get a reply within 30 days OR the reply is unsatisfactory: File First Appeal within 30 days to a senior officer in the same department. If first appeal fails: File Second Appeal within 90 days to the Information Commission (CIC for Central bodies, State IC for state bodies). No court fee for appeals.',
        relevantTo: ['rti_application'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 3. TRANSFER OF PROPERTY ACT, 1882
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Transfer of Property Act 1882',
    fullName: 'The Transfer of Property Act, 1882',
    year: 1882,
    type: 'central',
    description: 'An Act to amend the law relating to the Transfer of Property by act of parties.',
    sections: [
      {
        number: '105',
        title: 'Lease Defined',
        text: 'A lease of immoveable property is a transfer of a right to enjoy such property, made for a certain time, express or implied, or in perpetuity, in consideration of a price paid or promised, or of money, a share of crops, service or any other thing of value, to be rendered periodically or on specified occasions to the transferor by the transferee, who accepts the transfer on such terms. The transferor is called the lessor, the transferee is called the lessee, the price is called the premium, and the money, share, service or other thing to be so rendered is called the rent.',
        simplifiedText: 'A lease means: a landlord (lessor) allows a tenant (lessee) to use their property for a fixed or ongoing period in exchange for rent. The landlord still owns the property but transfers the right to use it. Rent is the payment the tenant makes.',
        relevantTo: ['legal_notice_landlord', 'landlord_eviction'],
      },
      {
        number: '106',
        title: 'Duration of Certain Leases in Absence of Written Contract or Local Usage',
        text: 'In the absence of a contract or local usage to the contrary, a lease of immoveable property for agricultural or manufacturing purposes shall be deemed to be a lease from year to year, terminable, on the part of either lessor or lessee, by six months notice; and a lease of immoveable property for any other purpose shall be deemed to be a lease from month to month, terminable, on the part of either lessor or lessee, by fifteen days notice. Every notice under this section must be in writing, signed by or on behalf of the person giving it, and either be sent by post to the party who is intended to be bound by it or be tendered or delivered personally to such party.',
        simplifiedText: 'For residential/commercial properties: either landlord or tenant can end the lease by giving 15 days written notice. For agricultural/factory properties: 6 months notice is required. The notice MUST be in writing and sent by post OR delivered personally. If notice is not given, the lease continues automatically.',
        relevantTo: ['legal_notice_landlord', 'landlord_eviction'],
      },
      {
        number: '108',
        title: "Rights and Liabilities of Lessor and Lessee",
        text: 'In the absence of a contract or local usage to the contrary, the lessor and the lessee of immoveable property, as against one another, have the rights and are subject to the liabilities mentioned in the rules next following, or such of them as are applicable to the property leased: (A) Rights and liabilities of the lessor: (a) A lessor is bound to disclose to the lessee any material defect in the property, with reference to its intended use, of which the lessor is and the lessee is not aware, and which the lessee could not with ordinary care discover; (b) The lessor is bound on the lessee\'s request to put him in possession of the property; (c) The lessor shall be deemed to contract with the lessee that, if the lessee pays the rent reserved by the lease and performs the contracts binding on the lessee, he may hold the property during the time limited by the lease without interruption.',
        simplifiedText: 'Landlord\'s duties: (1) Must tell tenant about any defects in the property. (2) Must give tenant possession of property. (3) Must not disturb the tenant if they are paying rent. Tenant\'s duties: (1) Pay rent on time. (2) Use property responsibly. (3) Hand over property at end of lease. (4) Allow landlord to inspect.',
        relevantTo: ['legal_notice_landlord', 'landlord_eviction'],
      },
      {
        number: '111',
        title: 'Determination of Lease',
        text: 'A lease of immoveable property determines— (a) by efflux of the time limited thereby; (b) where such time is limited conditionally on the happening of some event — by the happening of such event; (c) where the interest of the lessor in the property terminates on, or his power to dispose of the same extends only to, the happening of any event — by the happening of such event; (d) in case the interests of the lessee and the lessor in the whole of the property become vested at the same time in one person in the same right; (e) by express surrender; that is to say, in case the lessee yields up his interest under the lease to the lessor, by mutual agreement between them; (f) by implied surrender; (g) by forfeiture; that is to say, (1) in case the lessee breaks an express condition which provides that, on breach thereof, the lessor may re-enter; or (2) in case the lessee renounces his character as such by setting up a title in a third person or by claiming title in himself; or (3) the lessee is adjudicated an insolvent and the lease provides that the lessor may re-enter on the happening of such event; and (h) on the expiration of a notice to quit.',
        simplifiedText: 'A tenancy ends in these ways: (1) When the agreed time period expires. (2) When both parties agree to end it. (3) When tenant breaks a major term of the lease. (4) When proper written notice of 15 days (residential) is given. (5) When tenant abandons the property. A landlord CANNOT forcibly evict without following proper legal procedure.',
        relevantTo: ['legal_notice_landlord', 'landlord_eviction'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 4. NEGOTIABLE INSTRUMENTS ACT, 1881
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Negotiable Instruments Act 1881',
    fullName: 'The Negotiable Instruments Act, 1881',
    year: 1881,
    type: 'central',
    description: 'An Act to define and amend the law relating to Promissory Notes, Bills of Exchange and Cheques.',
    sections: [
      {
        number: '138',
        title: 'Dishonour of Cheque for Insufficiency of Funds',
        text: 'Where any cheque drawn by a person on an account maintained by him with a banker for payment of any amount of money to another person from out of that account for the discharge, in whole or in part, of any debt or other liability, is returned by the bank unpaid, either because of the amount of money standing to the credit of that account is insufficient to honour the cheque or that it exceeds the amount arranged to be paid from that account by an agreement made with that bank, such person shall be deemed to have committed an offence and shall, without prejudice to any other provision of this Act, be punished with imprisonment for a term which may extend to two years, or with fine which may extend to twice the amount of the cheque, or with both.',
        simplifiedText: 'If a cheque bounces due to insufficient funds or account closure: it is a CRIMINAL OFFENCE. The person who gave the cheque can be jailed for up to 2 years OR fined up to double the cheque amount, or both. But: the payee must send a written demand notice within 30 days of getting the bank memo. If payment is not made in 15 days, file a criminal complaint.',
        relevantTo: ['cheque_bounce_notice'],
      },
      {
        number: '141',
        title: 'Offences by Companies',
        text: 'If the person committing an offence under section 138 is a company, every person who, at the time the offence was committed, was in charge of, and was responsible to the company for the conduct of the business of the company, as well as the company, shall be deemed to be guilty of the offence and shall be liable to be proceeded against and punished accordingly.',
        simplifiedText: 'If a company\'s cheque bounces, the company AND its directors/managers can all be prosecuted. Directors cannot escape by saying "I didn\'t know." If you are in charge of the company\'s finances, you are personally responsible. Include directors in the complaint along with the company.',
        relevantTo: ['cheque_bounce_notice'],
      },
      {
        number: '142',
        title: 'Cognizance of Offences',
        text: 'Notwithstanding anything contained in the Code of Criminal Procedure, 1973,— (a) no court shall take cognizance of any offence punishable under section 138 except upon a complaint, in writing, made by the payee or, as the case may be, the holder in due course of the cheque; (b) such complaint is made within one month of the date on which the cause of action arises under clause (c) of the proviso to section 138.',
        simplifiedText: 'Important timeline for cheque bounce cases: (1) Cheque bounces → get bank\'s dishonour memo. (2) Within 30 days of memo: send legal notice to drawer demanding payment in 15 days. (3) If no payment in 15 days: file criminal complaint within 30 days after that. If you miss these deadlines, your case may be dismissed. Always keep bank dishonour memo, postal receipts, and delivery proof.',
        relevantTo: ['cheque_bounce_notice'],
      },
      {
        number: '143A',
        title: 'Power to Direct Interim Compensation',
        text: 'Notwithstanding anything contained in the Code of Criminal Procedure, 1973, the Court trying an offence under section 138 may order the drawer of the cheque to pay interim compensation to the complainant— (a) in a summary trial or a summons case, where he pleads not guilty to the accusation made in the complaint; and (b) in any other case, upon framing of charge. The interim compensation under sub-section (1) shall not exceed twenty per cent of the amount of the cheque.',
        simplifiedText: 'Courts can order the accused to pay you up to 20% of the cheque amount as interim compensation even before the case is decided. This prevents accused persons from delaying cases. If the accused is later acquitted, they can get this money back. Ask for interim compensation in your complaint to get partial relief quickly.',
        relevantTo: ['cheque_bounce_notice'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 5. CODE OF CIVIL PROCEDURE, 1908
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Code of Civil Procedure 1908',
    fullName: 'The Code of Civil Procedure, 1908',
    year: 1908,
    type: 'central',
    description: 'An Act to consolidate and amend the laws relating to the procedure of the Courts of Civil Judicature.',
    sections: [
      {
        number: '9',
        title: 'Courts to Try All Civil Suits Unless Barred',
        text: 'The Courts shall (subject to the provisions herein contained) have jurisdiction to try all suits of a civil nature excepting suits of which their cognizance is either expressly or impliedly barred. Explanation I — A suit in which the right to property or to an office is contested is a suit of a civil nature, notwithstanding that such right may depend entirely on the decision of questions as to religious rites or ceremonies. Explanation II — For the purposes of this section, it is immaterial whether or not any fees are attached to the office referred to in Explanation I or whether or not such office is attached to a particular place.',
        simplifiedText: 'Civil courts can hear all civil disputes unless the law specifically says otherwise. This means most property, money, and contract disputes go to civil courts. Exceptions: criminal matters (go to criminal courts), labour disputes (go to labour courts), consumer disputes (go to consumer forums).',
        relevantTo: ['legal_notice_landlord', 'landlord_eviction', 'property_sale_agreement'],
      },
      {
        number: '80',
        title: 'Notice',
        text: '(1) Save as otherwise provided in sub-section (2), no suit shall be instituted against the Government (including the Government of the State of Jammu and Kashmir) or against a public officer in respect of any act purporting to be done by such public officer in his official capacity, until the expiration of two months next after notice in writing has been delivered to, or left at the office of— (a) in the case of a suit against the Central Government, except where it relates to a railway, a Secretary to that Government; (b) in the case of a suit against the Central Government where it relates to a railway, the General Manager of that railway; (bb) in the case of a suit against the Government of the State of Jammu and Kashmir, the Chief Secretary to that Government or any other officer authorised by that Government in this behalf; (c) in the case of a suit against any other State Government, a Secretary to that Government or the Collector of the District.',
        simplifiedText: 'If you want to sue the government or a government officer, you must first give them a written notice 2 months before filing the suit. This gives the government time to settle the matter. The notice must explain your claim and the relief you want. Without this notice, your suit will be dismissed. Keep proof of delivery.',
        relevantTo: ['rti_application', 'consumer_complaint'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 6. INDIAN EVIDENCE ACT, 1872
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Indian Evidence Act 1872',
    fullName: 'The Indian Evidence Act, 1872',
    year: 1872,
    type: 'central',
    description: 'An Act to consolidate, define and amend the law of evidence.',
    sections: [
      {
        number: '17',
        title: 'Admission Defined',
        text: 'An admission is a statement, oral or documentary or contained in electronic form, which suggests any inference as to any fact in issue or relevant fact, and which is made by any of the persons, and under the circumstances, hereinafter mentioned.',
        simplifiedText: 'An "admission" is when someone (usually the other party in a case) says or writes something that proves a fact relevant to your case. This can be in person, in writing, or even in emails/WhatsApp messages. Admissions are very powerful evidence. Collect all written communications from the other party — they may constitute admissions.',
        relevantTo: ['cheque_bounce_notice', 'consumer_complaint', 'legal_notice_landlord'],
      },
      {
        number: '65B',
        title: 'Admissibility of Electronic Records',
        text: 'Notwithstanding anything contained in this Act, any information contained in an electronic record which is printed on a paper, stored, recorded or copied in optical or magnetic media produced by a computer (hereinafter referred to as the computer output) shall be deemed to be also a document, if the conditions mentioned in this section are satisfied in relation to the information and computer in question and shall be admissible in any proceedings, without further proof or production of the original, as evidence of any contents of the original or of any fact stated therein of which direct evidence would be admissible.',
        simplifiedText: 'Digital evidence like WhatsApp chats, emails, and computer printouts are valid evidence in Indian courts. However, you need a certificate (called a Section 65B certificate) from someone who operates the computer system to prove the digital document is genuine. Without this certificate, digital evidence may be rejected. Take screenshots and get certificate from service provider if needed.',
        relevantTo: ['consumer_complaint', 'cheque_bounce_notice', 'police_complaint'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 7. PROTECTION OF WOMEN FROM DOMESTIC VIOLENCE ACT, 2005
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Protection of Women from Domestic Violence Act 2005',
    fullName: 'The Protection of Women from Domestic Violence Act, 2005',
    year: 2005,
    type: 'central',
    description: 'An Act to provide for more effective protection of the rights of women guaranteed under the Constitution who are victims of violence of any kind occurring within the family.',
    sections: [
      {
        number: '3',
        title: 'Definition of Domestic Violence',
        text: 'For the purposes of this Act, any act, omission or commission or conduct of the respondent shall constitute "domestic violence" in case it— (a) harms or injures or endangers the health, safety, life, limb or well-being, whether mental or physical, of the aggrieved person or tends to do so and includes causing physical abuse, sexual abuse, verbal and emotional abuse and economic abuse; or (b) harasses, harms, injures or endangers the aggrieved person with a view to coerce her or any other person related to her to meet any unlawful demand for any dowry or other property or valuable security; or (c) has the effect of threatening the aggrieved person or any other person related to her by any conduct mentioned in clause (a) or clause (b); or (d) otherwise injures or causes harm, whether physical or mental, to the aggrieved person.',
        simplifiedText: 'Domestic violence includes: (1) Physical violence — hitting, slapping, kicking. (2) Sexual abuse. (3) Verbal abuse — constant shouting, threats, insults. (4) Emotional abuse — controlling behaviour, isolating from family. (5) Economic abuse — stopping you from working, controlling money, not giving money for basic needs. (6) Dowry demands. You do NOT need physical injury to claim domestic violence.',
        relevantTo: ['domestic_violence_complaint'],
      },
      {
        number: '12',
        title: 'Application to Magistrate',
        text: 'An aggrieved person or a Protection Officer or any other person on behalf of the aggrieved person may present an application to the Magistrate seeking one or more reliefs under this Act. The relief sought for under sub-section (1) may include a relief for issuance of an order for payment of compensation or damages without prejudice to the right of such person to institute a suit for compensation or damages for the injuries caused by the acts of domestic violence committed by the respondent.',
        simplifiedText: 'You can file an application at the nearest Magistrate\'s court asking for protection. You can ask a Protection Officer (every district has one) or an NGO to help you file. You do not need a lawyer. You can ask for: (1) Protection from further violence. (2) Permission to stay in your home. (3) Monthly financial support. (4) Compensation for injuries.',
        relevantTo: ['domestic_violence_complaint'],
      },
      {
        number: '17',
        title: 'Right to Reside in Shared Household',
        text: 'Notwithstanding anything contained in any other law for the time being in force, every woman in a domestic relationship shall have the right to reside in the shared household, whether or not she has any right, title or beneficial interest in the same.',
        simplifiedText: 'You have the right to live in your home (the shared household) even if you don\'t own it or your name is not on the property papers. The abuser cannot throw you out without a court order. You can ask the Magistrate for a Residence Order to protect your right to stay in your home.',
        relevantTo: ['domestic_violence_complaint'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 9. INFORMATION TECHNOLOGY ACT, 2000
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Information Technology Act 2000',
    fullName: 'The Information Technology Act, 2000',
    year: 2000,
    type: 'central',
    description: 'An Act to provide legal recognition for transactions carried out by means of electronic data interchange and other means of electronic communication, and to prevent cybercrime.',
    sections: [
      {
        number: '66',
        title: 'Computer Related Offences',
        text: 'If any person, dishonestly or fraudulently, does any act referred to in section 43, he shall be punishable with imprisonment for a term which may extend to three years or with fine which may extend to five lakh rupees or with both. Explanation: For the purpose of this section,— (a) the word "dishonestly" shall have the meaning assigned to it in section 24 of the Indian Penal Code; (b) the word "fraudulently" shall have the meaning assigned to it in section 25 of the Indian Penal Code.',
        simplifiedText: 'Anyone who hacks into a computer system, damages data, or disrupts computer networks dishonestly faces up to 3 years imprisonment and/or ₹5 lakh fine. This covers: hacking into someone\'s email, destroying files, introducing viruses, denying access to systems. File a complaint at the nearest cybercrime police station or cybercrime.gov.in.',
        relevantTo: ['cybercrime_complaint', 'police_complaint'],
      },
      {
        number: '66C',
        title: 'Punishment for Identity Theft',
        text: 'Whoever, fraudulently or dishonestly make use of the electronic signature, password or any other unique identification feature of any other person, shall be punished with imprisonment of either description for a term which may extend to three years and shall also be liable to fine which may extend to rupees one lakh.',
        simplifiedText: 'Using someone else\'s password, OTP, digital signature, or login credentials without permission is a criminal offence: up to 3 years imprisonment and ₹1 lakh fine. This includes: using someone\'s UPI PIN, logging into their social media, using their Aadhaar for verification. Report to cybercrime.gov.in with evidence of the identity theft.',
        relevantTo: ['cybercrime_complaint', 'police_complaint'],
      },
      {
        number: '66D',
        title: 'Punishment for Cheating by Personation by Using Computer Resource',
        text: 'Whoever, by means of any communication device or computer resource cheats by personating, shall be punished with imprisonment of either description for a term which may extend to three years and shall also be liable to fine which may extend to one lakh rupees.',
        simplifiedText: 'Online fraud by impersonation — pretending to be someone else online to cheat you of money — is a criminal offence: up to 3 years and ₹1 lakh fine. This covers: fake loan apps, phishing calls pretending to be bank officials, fake e-commerce sellers. File complaint at cybercrime.gov.in (National Cyber Crime Reporting Portal) or call helpline 1930.',
        relevantTo: ['cybercrime_complaint', 'consumer_complaint', 'police_complaint'],
      },
      {
        number: '72',
        title: 'Breach of Confidentiality and Privacy',
        text: 'Save as otherwise provided in this Act or any other law for the time being in force, any person who, in pursuance of any of the powers conferred under this Act, rules or regulations made thereunder, has secured access to any electronic record, book, register, correspondence, information, document or other material without the consent of the person concerned discloses such material to any other person shall be punished with imprisonment for a term which may extend to two years, or with fine which may extend to one lakh rupees, or with both.',
        simplifiedText: 'Government officials or anyone with authorized access to your digital records cannot share them without your consent. Doing so is punishable with up to 2 years imprisonment or ₹1 lakh fine. If a government official leaks your Aadhaar data, tax records, or medical records, you can file a complaint under this section.',
        relevantTo: ['cybercrime_complaint', 'police_complaint'],
      },
      {
        number: '79',
        title: 'Exemption from Liability of Intermediary in Certain Cases',
        text: 'An intermediary shall not be liable for any third party information, data, or communication link made available or hosted by him, if— (a) the function of the intermediary is limited to providing access to a communication system over which information made available by third parties is transmitted or temporarily stored or hosted; or (b) the intermediary does not— (i) initiate the transmission; (ii) select the receiver of the transmission; and (iii) select or modify the information contained in the transmission; and (c) the intermediary observes due diligence while discharging his duties under this Act.',
        simplifiedText: 'Platforms like Facebook, WhatsApp, Google are not automatically liable for user content — but they must remove illegal content when notified. If a platform does NOT remove harmful/illegal content after proper notice, it loses this protection and becomes liable. Send a legal notice to the platform\'s grievance officer first before approaching courts.',
        relevantTo: ['cybercrime_complaint', 'police_complaint'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 10. HINDU SUCCESSION ACT, 1956
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Hindu Succession Act 1956',
    fullName: 'The Hindu Succession Act, 1956',
    year: 1956,
    type: 'central',
    description: 'An Act to amend and codify the law relating to intestate succession among Hindus.',
    sections: [
      {
        number: '8',
        title: 'General Rules of Succession in the Case of Males',
        text: 'The property of a male Hindu dying intestate shall devolve according to the provisions of this Chapter:— (a) firstly, upon the heirs, being the relatives specified in class I of the Schedule; (b) secondly, if there is no heir of class I, then upon the heirs, being the relatives specified in class II of the Schedule; (c) thirdly, if there is no heir of any of the two classes, then upon the agnates of the deceased; and (d) lastly, if there is no agnate, then upon the cognates of the deceased.',
        simplifiedText: 'When a Hindu man dies without a will, his property is distributed as follows: First priority — Class I heirs (wife, sons, daughters, mother, son\'s children, daughter\'s children). If no Class I heirs — Class II heirs (father, siblings, grandchildren etc.). All Class I heirs inherit equally. After the 2005 amendment, daughters have equal rights as sons in ancestral property.',
        relevantTo: ['legal_heir_certificate', 'property_sale_agreement'],
      },
      {
        number: '14',
        title: 'Property of a Female Hindu to be her Absolute Property',
        text: 'Any property possessed by a female Hindu, whether acquired before or after the commencement of this Act, shall be held by her as full owner thereof and not as a limited owner. Explanation — In this section, "property" includes both moveable and immoveable property acquired by a female Hindu by inheritance or devise, or at a partition, or in lieu of maintenance or arrears of maintenance, or by gift from any person, whether a relative or not, before, at or after her marriage, or by her own skill or exertion, or by purchase or by prescription, or in any other manner whatsoever, and also any such property held by her as stridhana immediately before the commencement of this Act.',
        simplifiedText: 'A Hindu woman owns ALL property she acquires or inherits absolutely — no one else can claim rights over it. This includes: property inherited from parents/husband, gifts received at marriage (stridhan), property bought with her own money, property received in lieu of maintenance. Her property passes to her heirs like any other absolute owner.',
        relevantTo: ['legal_heir_certificate', 'property_sale_agreement', 'domestic_violence_complaint'],
      },
      {
        number: '15',
        title: 'General Rules of Succession in the Case of Female Hindus',
        text: 'The property of a female Hindu dying intestate shall devolve according to the rules set out in section 16— (a) firstly, upon the sons and daughters (including the children of any pre-deceased son or daughter) and the husband; (b) secondly, upon the heirs of the husband; (c) thirdly, upon the mother and father; (d) fourthly, upon the heirs of the father; and (e) lastly, upon the heirs of the mother.',
        simplifiedText: 'When a Hindu woman dies without a will, her property goes in this order: (1) Her sons, daughters, and husband equally. (2) Husband\'s heirs (in-laws). (3) Her parents. (4) Father\'s heirs. (5) Mother\'s heirs. Note: Property she inherited from her parents goes back to her parents\' heirs if she dies without children. Property from her husband/in-laws goes to her husband\'s heirs.',
        relevantTo: ['legal_heir_certificate'],
      },
      {
        number: '6',
        title: 'Devolution of Interest in Coparcenary Property (Post-2005 Amendment)',
        text: 'On and from the commencement of the Hindu Succession (Amendment) Act, 2005, in a Joint Hindu family governed by the Mitakshara law, the daughter of a coparcener shall,— (a) by birth become a coparcener in her own right the same manner as the son; (b) have the same rights in the coparcenary property as she would have had if she had been a son; (c) be subject to the same liabilities in respect of the said coparcenary property as that of a son, and any reference to a Hindu Mitakshara coparcener shall be deemed to include a reference to a daughter of a coparcener.',
        simplifiedText: 'Since September 2005, daughters have EQUAL rights in ancestral (joint family) property as sons — from birth. This applies even if the father died before 2005, as long as the daughter was alive at the time of the 2005 amendment. Daughters can demand partition of ancestral property and cannot be deprived of their share by a will. This is a landmark equality provision.',
        relevantTo: ['legal_heir_certificate', 'property_sale_agreement'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 11. MOTOR VEHICLES ACT, 1988
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Motor Vehicles Act 1988',
    fullName: 'The Motor Vehicles Act, 1988',
    year: 1988,
    type: 'central',
    description: 'An Act to consolidate and amend the law relating to motor vehicles including road accident compensation.',
    sections: [
      {
        number: '163A',
        title: 'Special Provisions as to Payment of Compensation on Structured Formula Basis',
        text: 'Notwithstanding anything contained in this Act or in any other law for the time being in force or instrument having the force of law, the owner of the motor vehicle or the authorised insurer shall be liable to pay in the case of death or permanent disablement due to accident arising out of the use of motor vehicle, compensation, as indicated in the Second Schedule, to the legal representatives or the victim, as the case may be. In any claim for compensation under sub-section (1), the claimant shall not be required to plead or establish that the death or permanent disablement in respect of which the claim has been made was due to any wrongful act or neglect or default of the owner of the vehicle or of any other person.',
        simplifiedText: 'Accident victims or their families can claim compensation WITHOUT proving the driver was at fault (no-fault liability). Use the structured formula based on age and income in Schedule II. This is faster than proving negligence. File claim with Motor Accident Claims Tribunal (MACT) within 6 months of accident.',
        relevantTo: ['consumer_complaint'],
      },
      {
        number: '165',
        title: 'Claims Tribunals',
        text: 'A State Government may, by notification in the Official Gazette, constitute one or more Motor Accidents Claims Tribunals (hereinafter referred to as Claims Tribunal) for such area as may be specified in the notification for the purpose of adjudicating upon claims for compensation in respect of accidents involving the death of, or bodily injury to, persons arising out of the use of motor vehicles, or damages to any property of a third party so arising, or both.',
        simplifiedText: 'Motor Accident Claims Tribunals (MACT) are special courts set up in each district to handle road accident compensation claims. They are faster and more accessible than regular courts. File your accident claim here — you don\'t need a lawyer for simple cases. MACT hearings are informal and focused on getting compensation for victims quickly.',
        relevantTo: ['consumer_complaint'],
      },
      {
        number: '166',
        title: 'Application for Compensation',
        text: 'An application for compensation arising out of an accident of the nature specified in sub-section (1) of section 165 may be made— (a) by the person who has sustained the injury; or (b) by the owner of the property; or (c) where death has resulted from the accident, by all or any of the legal representatives of the deceased; or (d) by any agent duly authorised by the person injured or all or any of the legal representatives of the deceased, as the case may be.',
        simplifiedText: 'Who can claim accident compensation: (1) The injured person. (2) Legal heirs if the person died. (3) Any agent/lawyer on their behalf. Deadline: File within 6 months of accident (courts can condone delay). Include: FIR copy, medical bills, disability certificate (if applicable), income proof for calculating lost earnings. Insurance company is a mandatory party to the claim.',
        relevantTo: ['consumer_complaint'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 12. PAYMENT OF GRATUITY ACT, 1972
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Payment of Gratuity Act 1972',
    fullName: 'The Payment of Gratuity Act, 1972',
    year: 1972,
    type: 'central',
    description: 'An Act to provide for a scheme for the payment of gratuity to employees engaged in factories, mines, oilfields, plantations, ports, railway companies, shops or other establishments.',
    sections: [
      {
        number: '4',
        title: 'Payment of Gratuity',
        text: 'Gratuity shall be payable to an employee on the termination of his employment after he has rendered continuous service for not less than five years,— (a) on his superannuation, or (b) on his retirement or resignation, or (c) on his death or disablement due to accident or disease: Provided that the completion of continuous service of five years shall not be necessary where the termination of the employment of any employee is due to death or disablement. The amount of gratuity payable to an employee shall be at the rate of fifteen days wages based on the rate of wages last drawn by the employee concerned, for every completed year of service or part thereof in excess of six months.',
        simplifiedText: 'You are entitled to gratuity after completing 5 years of continuous service (except in case of death/disability — no minimum years required). Formula: 15 days salary × number of years worked. Gratuity must be paid within 30 days of leaving. Maximum gratuity is capped at ₹20 lakh (revised from ₹10 lakh). Gratuity cannot be forfeited except in case of moral turpitude or violence.',
        relevantTo: ['employment_termination', 'labour_dispute'],
      },
      {
        number: '7',
        title: 'Determination of the Amount of Gratuity',
        text: '(1) A person who is eligible for payment of gratuity under this Act or any person authorised, in writing, to act on his behalf shall send a written application to the employer, within such time and in such form, as may be prescribed, for payment of such gratuity. (2) As soon as gratuity becomes payable, the employer shall, whether an application referred to in sub-section (1) has been made or not, determine the amount of gratuity and give notice in writing to the person to whom the gratuity is payable and also to the Controlling Authority specifying the amount of gratuity so determined. (3) The employer shall arrange to pay the amount of gratuity within thirty days from the date it becomes payable to the person to whom the gratuity is payable.',
        simplifiedText: 'To claim gratuity: Submit Form I (gratuity application) to your employer within 30 days of leaving. Employer must pay within 30 days. If not paid: employer pays interest from due date. If employer disputes: apply to Controlling Authority (Labour Commissioner). If employer denies gratuity unfairly: appeal to Appellate Authority (District Collector or designated officer). Gratuity is exempt from income tax up to ₹20 lakh.',
        relevantTo: ['employment_termination', 'labour_dispute'],
      },
      {
        number: '8',
        title: 'Recovery of Gratuity',
        text: 'If the amount of gratuity payable under this Act is not paid by the employer, within the prescribed time, to the person entitled thereto, the Controlling Authority shall, on an application made to it in this behalf by the aggrieved person, issue a certificate for that amount to the Collector, who shall recover the same from the employer with compound interest thereon at such rate as the Central Government may, by notification, specify, from the date of expiry of the prescribed period, with penalty, if any, as may be specified in the certificate.',
        simplifiedText: 'If your employer does not pay gratuity: File application before the Controlling Authority (Labour Commissioner) with proof of service and calculation. The authority issues a certificate and the Collector recovers the amount from the employer — including compound interest. Employer also faces criminal prosecution for wilful failure to pay gratuity.',
        relevantTo: ['employment_termination', 'labour_dispute'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 13. INDIAN CONTRACT ACT, 1872
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Indian Contract Act 1872',
    fullName: 'The Indian Contract Act, 1872',
    year: 1872,
    type: 'central',
    description: 'An Act to define and amend the law relating to contracts in India.',
    sections: [
      {
        number: '10',
        title: 'What Agreements are Contracts',
        text: 'All agreements are contracts if they are made by the free consent of parties competent to contract, for a lawful consideration and with a lawful object, and are not hereby expressly declared to be void. Nothing herein contained shall affect any law in force in India, and not hereby expressly repealed, by which any contract is required to be made in writing or in the presence of witnesses, or any law relating to the registration of documents.',
        simplifiedText: 'A valid contract needs: (1) Offer and acceptance. (2) Both parties must be competent (above 18, sound mind, not bankrupt). (3) Free consent (no force, fraud, or misrepresentation). (4) Lawful purpose. (5) Consideration (something of value exchanged). Even verbal agreements can be contracts — but written contracts are easier to prove. If any of these elements is missing, the contract may be void or voidable.',
        relevantTo: ['property_sale_agreement', 'startup_founders_agreement', 'employment_termination'],
      },
      {
        number: '73',
        title: 'Compensation for Loss or Damage Caused by Breach of Contract',
        text: 'When a contract has been broken, the party who suffers by such breach is entitled to receive, from the party who has broken it, compensation for any loss or damage caused to him thereby, which naturally arose in the usual course of things from such breach, or which the parties knew, when they made the contract, to be likely to result from the breach of it. Such compensation is not to be given for any remote and indirect loss or damage sustained by reason of the breach. Compensation for failure to discharge obligation resembling those created by contract — When an obligation resembling those created by contract has been incurred and has not been discharged, any person injured by the failure to discharge it is entitled to receive the same compensation from the party in default, as if such person had contracted to discharge it and had broken his contract.',
        simplifiedText: 'If someone breaks a contract: you can claim compensation for losses that directly result from the breach — including lost profits, wasted expenses, and costs incurred. You cannot claim for indirect/speculative losses. You have a duty to "mitigate" — take steps to reduce your own losses. Always document your financial losses with receipts and records before approaching court.',
        relevantTo: ['property_sale_agreement', 'startup_founders_agreement', 'consumer_complaint'],
      },
      {
        number: '74',
        title: 'Compensation for Breach of Contract Where Penalty Stipulated',
        text: 'When a contract has been broken, if a sum is named in the contract as the amount to be paid in case of such breach, or if the contract contains any other stipulation by way of penalty, the party complaining of the breach is entitled, whether or not actual damage or loss is proved to have been caused thereby, to receive from the party who has broken the contract reasonable compensation not exceeding the amount so named or, as the case may be, the penalty stipulated for.',
        simplifiedText: 'If your contract specifies a penalty for breach (e.g., "₹1 lakh per month of delay"), you can claim that amount without proving actual loss — but courts can reduce it if deemed excessive. Reasonable penalty clauses are enforceable in India. In property deals: if buyer defaults, seller can forfeit token money. If seller defaults, buyer can claim token money back plus interest.',
        relevantTo: ['property_sale_agreement', 'startup_founders_agreement'],
      },
      {
        number: '19',
        title: 'Voidability of Agreements Without Free Consent',
        text: 'When consent to an agreement is caused by coercion, fraud, or misrepresentation, the agreement is a contract voidable at the option of the party whose consent was so caused. A party to a contract, whose consent was caused by fraud or misrepresentation, may, if he thinks fit, insist that the contract shall be performed, and that he shall be put in the position in which he would have been if the representations made had been true.',
        simplifiedText: 'If you were cheated into signing a contract (fraud, pressure, false promises): the contract is voidable — you can cancel it. You must act promptly once you discover the fraud. Options: (1) Cancel the contract and get your money/property back. (2) Enforce the contract as if the false promise were true. Keep all communications (WhatsApp, email) showing the misrepresentation — they are key evidence.',
        relevantTo: ['consumer_complaint', 'property_sale_agreement', 'police_complaint'],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 8. INDUSTRIAL DISPUTES ACT, 1947
  // ══════════════════════════════════════════════════════════════════════════
  {
    shortName: 'Industrial Disputes Act 1947',
    fullName: 'The Industrial Disputes Act, 1947',
    year: 1947,
    type: 'central',
    description: 'An Act to make provision for the investigation and settlement of industrial disputes, and for certain other purposes.',
    sections: [
      {
        number: '2(k)',
        title: 'Definition of Industrial Dispute',
        text: '"Industrial dispute" means any dispute or difference between employers and employers, or between employers and workmen, or between workmen and workmen, which is connected with the employment or non-employment or the terms of employment or with the conditions of labour, of any person.',
        simplifiedText: 'An "industrial dispute" is any conflict between: (1) Worker and employer about employment, salary, working conditions, dismissal. (2) Worker and worker about the same. This covers: wrongful dismissal, unpaid wages, denial of holidays, safety issues, transfer to different location. Most employment disputes between workers and employers are "industrial disputes" under this Act.',
        relevantTo: ['labour_dispute', 'employment_termination'],
      },
      {
        number: '10',
        title: 'Reference of Disputes to Boards, Courts or Tribunals',
        text: '(1) Where the appropriate Government is of opinion that any industrial dispute exists or is apprehended, it may at any time, by order in writing,— (a) refer the dispute to a Board for promoting a settlement thereof; or (b) refer any matter appearing to be connected with or relevant to the dispute to a Court for enquiry; or (c) refer the dispute or any matter appearing to be connected with, or relevant to, the dispute, if it relates to any matter specified in the Second Schedule, to a Labour Court for adjudication.',
        simplifiedText: 'The government (state or central) can send your dispute to: (1) A Conciliation Board to try to settle it peacefully. (2) Labour Court if the dispute is about individual workers (dismissal, wages). (3) Industrial Tribunal for bigger disputes affecting many workers. File a grievance with the Labour Department first — they will conciliate. If conciliation fails, the matter can go to Labour Court.',
        relevantTo: ['labour_dispute', 'employment_termination'],
      },
      {
        number: '25F',
        title: 'Conditions Precedent to Retrenchment of Workmen',
        text: 'No workman employed in any industry who has been in continuous service for not less than one year under an employer shall be retrenched by that employer until— (a) the workman has been given one month\'s notice in writing indicating the reasons for retrenchment and the period of notice has expired, or the workman has been paid in lieu of such notice, wages for the period of the notice; (b) the workman has been paid, at the time of retrenchment, compensation which shall be equivalent to fifteen days\' average pay for every completed year of continuous service or any part thereof in excess of six months; and (c) notice in the prescribed manner is served on the appropriate Government or such authority as may be specified by the appropriate Government by notification in the Official Gazette.',
        simplifiedText: 'If your employer wants to fire you (retrench you) after 1 year of service, they MUST: (1) Give 1 month written notice OR pay 1 month salary instead of notice. (2) Pay retrenchment compensation = 15 days salary × number of years worked. (3) Inform the government. If your employer did not follow these steps, the retrenchment is illegal. You can demand reinstatement or compensation.',
        relevantTo: ['labour_dispute', 'employment_termination'],
      },
    ],
  },
];

/* ---------------------------------------------------------------------------
 * Seed function
 * ------------------------------------------------------------------------ */

async function main() {
  console.log('🌱 NyayaSetu — Seeding LegalActs');
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

  for (const act of ACTS) {
    const existing = await LegalAct.findOne({ shortName: act.shortName });
    if (existing) {
      console.log(`   ⏭  Skipped (already exists): ${act.shortName}`);
      skipped++;
      continue;
    }

    await LegalAct.create(act);
    console.log(`   ✅ Inserted: ${act.shortName} — ${act.sections.length} sections`);
    inserted++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Acts inserted : ${inserted}`);
  console.log(`   Acts skipped  : ${skipped}`);
  console.log(`   Total sections: ${ACTS.reduce((s, a) => s + a.sections.length, 0)}`);

  await mongoose.disconnect();
  console.log('\n👋 Disconnected from MongoDB');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

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
const LegalAct = require('../src/models/LegalAct');

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

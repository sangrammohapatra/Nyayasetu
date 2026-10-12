'use strict';

/**
 * In-app paths that match the React router in client/src/App.jsx.
 * Notification actionUrl values must use these — the old unprefixed paths
 * (/consultations/:id, /documents/:id, /cases/:id, /lawyer/dashboard, …)
 * are not registered routes.
 */

function idOf(ref) {
  if (ref == null || ref === '') return '';
  const id = ref._id || ref;
  return String(id);
}

function consultationUrl(persona, consultationId) {
  const base = persona === 'lawyer' ? '/lawyer/consultations' : '/citizen/consultations';
  const id = idOf(consultationId);
  return id ? `${base}?consultation=${id}` : base;
}

function caseUrl(persona, caseId) {
  const base = persona === 'lawyer' ? '/lawyer/cases' : '/citizen/cases';
  const id = idOf(caseId);
  return id ? `${base}?case=${id}` : base;
}

function documentUrl(documentRef) {
  const id = idOf(documentRef);
  return id ? `/citizen/documents/${id}` : '/citizen/documents';
}

function notaryRequestUrl(requestId) {
  const id = idOf(requestId);
  return id ? `/notary/requests?request=${id}` : '/notary/requests';
}

function chatUrl(templateSlug) {
  return templateSlug ? `/citizen/chat/${encodeURIComponent(templateSlug)}` : '/citizen/documents';
}

module.exports = {
  LAWYER_HOME: '/lawyer/home',
  LAWYER_SETUP: '/lawyer/profile',
  NOTARY_HOME: '/notary/home',
  consultationUrl,
  caseUrl,
  documentUrl,
  notaryRequestUrl,
  chatUrl,
};

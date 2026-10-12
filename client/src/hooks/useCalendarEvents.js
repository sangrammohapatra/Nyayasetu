import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectUserPersona } from '../store/slices/authSlice';
import { selectCases, listCases } from '../store/slices/caseSlice';
import { selectConsultations, fetchConsultations, selectClients, fetchMyClients } from '../store/slices/lawyerSlice';
import { selectNotarizationRequests, fetchNotarizationRequests } from '../store/slices/notarySlice';

// Normalized event shape used by the calendar components:
// { id, type, date, title, subtitle, color, icon, link }

function idOf(ref) {
  if (ref == null || ref === '') return '';
  return String(ref._id || ref);
}

const CONSULTATION_COLORS = {
  video:     'var(--color-primary)',
  phone:     'var(--color-info, #0277bd)',
  chat:      'var(--color-primary)',
  in_person: 'var(--color-info, #0277bd)',
};

function consultationToEvent(c, perspective) {
  if (!c.scheduledAt) return null;
  const mode = c.mode || 'chat';
  return {
    id:              `consultation-${c._id}`,
    type:            'consultation',
    date:            new Date(c.scheduledAt),
    durationMinutes: c.durationMinutes || 30,
    title:           perspective === 'lawyer'
                       ? (c.citizen?.name || 'Client Consultation')
                       : (c.lawyer?.name || 'Lawyer Consultation'),
    subtitle:        `${mode.replace('_', ' ')} · ${c.durationMinutes || 30} min`,
    color:           CONSULTATION_COLORS[mode] || 'var(--color-primary)',
    icon:            mode === 'video' ? '🎥' : mode === 'phone' ? '📞' : mode === 'in_person' ? '🏢' : '💬',
    link:            perspective === 'lawyer'
                       ? `/lawyer/consultations?consultation=${c._id}`
                       : `/citizen/consultations?consultation=${c._id}`,
    raw:             c,
  };
}

function hearingToEvent(caseDoc, hearing, link) {
  if (!hearing.date) return null;
  return {
    id:              `hearing-${caseDoc._id}-${hearing.date}`,
    type:            'hearing',
    date:            new Date(hearing.date),
    durationMinutes: 60,
    title:           caseDoc.caseTitle || caseDoc.cnrNumber,
    subtitle:        [
                       caseDoc.clientName,
                       `${caseDoc.court || 'Court'} · ${hearing.status || 'scheduled'}`,
                     ].filter(Boolean).join(' · '),
    color:           'var(--color-warning, #e65100)',
    icon:            '🏛️',
    link,
    raw:             { case: caseDoc, hearing },
  };
}

function kycToEvent(request, perspective) {
  if (!request.scheduledAt) return null;
  const documentId = idOf(request.document);
  return {
    id:              `kyc-${request._id}`,
    type:            'kyc',
    date:            new Date(request.scheduledAt),
    durationMinutes: 30,
    title:           perspective === 'notary'
                       ? (request.citizen?.name || 'Video KYC')
                       : 'Video KYC',
    subtitle:        `Notarization · ${request.document?.title || 'document'}`,
    color:           'var(--color-success, #2e7d32)',
    icon:            '📹',
    link:            perspective === 'notary'
                       ? `/notary/requests?request=${request._id}`
                       : (documentId ? `/citizen/documents/${documentId}` : '/citizen/documents'),
    raw:             request,
  };
}

export function useCalendarEvents() {
  const dispatch      = useDispatch();
  const persona       = useSelector(selectUserPersona)?.toLowerCase();
  const cases         = useSelector(selectCases);
  const consultations = useSelector(selectConsultations);
  const clients       = useSelector(selectClients);
  const notarizations = useSelector(selectNotarizationRequests);

  useEffect(() => {
    if (!persona) return;
    if (persona === 'citizen' || persona === 'lawyer') {
      dispatch(fetchConsultations({}));
      // Calendar needs every tracked case's hearings, not just the first
      // paginated page — request the server's max page size.
      dispatch(listCases({ limit: 100 }));
    }
    if (persona === 'lawyer') {
      // A client's shared matter is owned by the citizen, so it is absent
      // from this lawyer's own case list.
      dispatch(fetchMyClients());
    }
    if (persona === 'citizen' || persona === 'notary') {
      dispatch(fetchNotarizationRequests({}));
    }
  }, [dispatch, persona]);

  const events = useMemo(() => {
    if (!persona) return [];
    const out = [];

    if (['citizen', 'lawyer'].includes(persona)) {
      consultations.forEach((c) => {
        const ev = consultationToEvent(c, persona === 'lawyer' ? 'lawyer' : 'citizen');
        if (ev) out.push(ev);
      });
    }

    if (persona === 'citizen' || persona === 'lawyer') {
      const caseBase = persona === 'lawyer' ? '/lawyer/cases' : '/citizen/cases';
      cases.forEach((c) => {
        const link = c._id ? `${caseBase}?case=${c._id}` : caseBase;
        (c.hearings || []).forEach((h) => {
          const ev = hearingToEvent(c, h, link);
          if (ev) out.push(ev);
        });
      });
    }

    if (persona === 'lawyer') {
      const seen = new Set((cases || []).map((c) => String(c._id)));
      (clients || []).forEach((client) => {
        const clientName = client.user?.name;
        (client.sharedCases || []).forEach((shared) => {
          const id = shared?._id ? String(shared._id) : '';
          if (!id || seen.has(id)) return;
          seen.add(id);
          const caseDoc = clientName ? { ...shared, clientName } : shared;
          (shared.hearings || []).forEach((h) => {
            const ev = hearingToEvent(caseDoc, h, `/lawyer/cases/${id}`);
            if (ev) out.push(ev);
          });
        });
      });
    }

    if (persona === 'citizen') {
      notarizations
        .filter((r) => r.status === 'kyc_scheduled')
        .forEach((r) => {
          const ev = kycToEvent(r, 'citizen');
          if (ev) out.push(ev);
        });
    }

    if (persona === 'notary') {
      notarizations
        .filter((r) => r.status === 'kyc_scheduled')
        .forEach((r) => {
          const ev = kycToEvent(r, 'notary');
          if (ev) out.push(ev);
        });
    }

    return out.sort((a, b) => a.date - b.date);
  }, [persona, consultations, cases, clients, notarizations]);

  return { events };
}

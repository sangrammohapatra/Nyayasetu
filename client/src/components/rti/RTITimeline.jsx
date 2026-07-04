/**
 * RTITimeline — visual vertical timeline of RTI application stages.
 * Shows completed, current, and upcoming stages.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { RADIUS } from '../../theme/tokens';

const STAGES = [
  {
    key:   'drafted',
    label: 'Application Drafted',
    desc:  'RTI questions prepared',
    icon:  '✍️',
  },
  {
    key:   'filed',
    label: 'Filed with PIO',
    desc:  '30-day response window starts',
    icon:  '📬',
  },
  {
    key:         'response',
    label:       'PIO Response',
    desc:        'Due within 30 days of filing',
    icon:        '📄',
    splitKeys:   ['response_received', 'first_appeal_due'],
  },
  {
    key:         'first_appeal',
    label:       'First Appeal',
    desc:        'File with FAA within 30 days of deadline',
    icon:        '⚖️',
    splitKeys:   ['first_appeal_filed', 'first_appeal_decided'],
    optionalIf:  ['response_received', 'closed'],
  },
  {
    key:         'cic',
    label:       'CIC / SIC Appeal',
    desc:        'Second appeal to Central Information Commission',
    icon:        '🏛️',
    splitKeys:   ['cic_filed', 'cic_decided'],
    optionalIf:  ['response_received', 'first_appeal_decided', 'closed'],
  },
  {
    key:   'closed',
    label: 'Resolved',
    desc:  'Matter closed',
    icon:  '✅',
  },
];

const STATUS_ORDER = [
  'drafted',
  'filed',
  'response_received',
  'first_appeal_due',
  'first_appeal_filed',
  'first_appeal_decided',
  'cic_filed',
  'cic_decided',
  'closed',
  'withdrawn',
];

// 'withdrawn' is reachable from any status (drafted through cic_decided), so it
// carries no information on its own about how far the application actually
// progressed before withdrawal. Infer the furthest reached stage from which
// date fields are populated, so earlier stages still render as 'done' instead
// of falling through to 'pending' (which would misrepresent progress made
// before the withdrawal).
function inferProgressBeforeWithdrawal({ filedDate, firstAppealFiledDate, cicFiledDate }) {
  if (cicFiledDate) return 'cic_filed';
  if (firstAppealFiledDate) return 'first_appeal_filed';
  if (filedDate) return 'filed';
  return 'drafted';
}

function getStageState(stage, currentStatus, dates = {}) {
  if (currentStatus === 'withdrawn') {
    // The application was never resolved — show "Resolved" as bypassed rather
    // than 'done' (STATUS_ORDER would otherwise mark it 'done' simply because
    // 'withdrawn' sorts after 'closed' in the array).
    if (stage.key === 'closed') return 'skipped';
    return getStageState(stage, inferProgressBeforeWithdrawal(dates), dates);
  }

  const idx = STATUS_ORDER.indexOf(currentStatus);

  if (stage.key === 'response') {
    if (['response_received', 'first_appeal_due', 'first_appeal_filed', 'first_appeal_decided', 'cic_filed', 'cic_decided', 'closed'].includes(currentStatus)) return 'done';
    if (currentStatus === 'filed') return 'active';
    return 'pending';
  }

  if (stage.key === 'first_appeal') {
    if (['first_appeal_decided', 'cic_filed', 'cic_decided', 'closed'].includes(currentStatus)) return 'done';
    if (['first_appeal_due', 'first_appeal_filed'].includes(currentStatus)) return 'active';
    if (['response_received'].includes(currentStatus)) return 'skipped';
    return 'pending';
  }

  if (stage.key === 'cic') {
    if (['cic_decided', 'closed'].includes(currentStatus)) return 'done';
    if (['cic_filed'].includes(currentStatus)) return 'active';
    if (['first_appeal_decided', 'response_received'].includes(currentStatus)) return 'skipped';
    return 'pending';
  }

  // Direct key matching
  if (stage.key === currentStatus) return 'active';
  if (STATUS_ORDER.indexOf(stage.key) < idx) return 'done';
  return 'pending';
}

const STATE_COLORS = {
  done:    { dot: '#2E7D32', line: '#A5D6A7', label: '#2E7D32' },
  active:  { dot: '#1565C0', line: '#90CAF9', label: '#1565C0' },
  pending: { dot: '#CFD8DC', line: '#ECEFF1', label: '#90A4AE' },
  skipped: { dot: '#BDBDBD', line: '#ECEFF1', label: '#9E9E9E' },
};

export default function RTITimeline({ status, filedDate, responseDeadline, firstAppealFiledDate, cicFiledDate }) {
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  const stageDates = {
    filed:         filedDate ? `Filed: ${formatDate(filedDate)}` : null,
    response:      responseDeadline ? `Deadline: ${formatDate(responseDeadline)}` : null,
    first_appeal:  firstAppealFiledDate ? `Filed: ${formatDate(firstAppealFiledDate)}` : null,
    cic:           cicFiledDate ? `Filed: ${formatDate(cicFiledDate)}` : null,
  };

  return (
    <Box sx={{ pl: 1 }}>
      {STAGES.map((stage, i) => {
        const state  = getStageState(stage, status, { filedDate, firstAppealFiledDate, cicFiledDate });
        const colors = STATE_COLORS[state];
        const isLast = i === STAGES.length - 1;
        const dateNote = stageDates[stage.key];

        return (
          <Box key={stage.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            {/* Dot + connector line */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: '3px' }}>
              <Box
                sx={{
                  width:        state === 'active' ? 14 : 12,
                  height:       state === 'active' ? 14 : 12,
                  borderRadius: '50%',
                  background:   state === 'done' ? colors.dot : state === 'active' ? colors.dot : 'transparent',
                  border:       `2px solid ${colors.dot}`,
                  boxShadow:    state === 'active' ? `0 0 0 4px ${colors.dot}22` : 'none',
                  flexShrink:   0,
                  transition:   'all 0.2s',
                }}
              />
              {!isLast && (
                <Box
                  sx={{
                    width:      2,
                    height:     state === 'done' ? 32 : 28,
                    background: colors.line,
                    my:         '2px',
                    transition: 'background 0.3s',
                  }}
                />
              )}
            </Box>

            {/* Content */}
            <Box sx={{ pb: isLast ? 0 : 1, pt: '1px', flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: state === 'active' ? 700 : state === 'done' ? 600 : 400,
                    color:      colors.label,
                    fontSize:   '0.82rem',
                  }}
                >
                  {stage.icon} {stage.label}
                </Typography>
                {state === 'active' && (
                  <Box
                    sx={{
                      px:         0.8,
                      py:         0.1,
                      background: '#1565C0',
                      color:      '#fff',
                      fontSize:   '0.6rem',
                      fontWeight: 700,
                      borderRadius: '4px',
                      letterSpacing: '0.06em',
                    }}
                  >
                    NOW
                  </Box>
                )}
                {state === 'skipped' && (
                  <Box sx={{ px: 0.8, py: 0.1, background: '#E0E0E0', color: '#757575', fontSize: '0.6rem', fontWeight: 700, borderRadius: '4px' }}>
                    SKIPPED
                  </Box>
                )}
              </Box>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.4, display: 'block' }}>
                {stage.desc}
              </Typography>
              {dateNote && state !== 'pending' && (
                <Typography variant="caption" sx={{ color: colors.label, fontWeight: 600, fontSize: '0.7rem' }}>
                  {dateNote}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

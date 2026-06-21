/**
 * RTIStatusBadge — compact colored chip showing RTI status.
 */

import React from 'react';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

const STATUS_CONFIG = {
  drafted:              { label: 'Draft',              color: '#546E7A', bg: '#ECEFF1', tooltip: 'Application created but not yet filed' },
  filed:                { label: 'Filed',              color: '#1565C0', bg: '#E3F2FD', tooltip: 'Awaiting PIO response (30-day window)' },
  response_received:    { label: 'Response Received',  color: '#2E7D32', bg: '#E8F5E9', tooltip: 'PIO responded to your application' },
  first_appeal_due:     { label: 'First Appeal Due',   color: '#E65100', bg: '#FFF3E0', tooltip: 'Deadline passed — file First Appeal now' },
  first_appeal_filed:   { label: 'First Appeal Filed', color: '#F57F17', bg: '#FFFDE7', tooltip: 'Awaiting FAA decision (30-day window)' },
  first_appeal_decided: { label: 'First Appeal Done',  color: '#6A1B9A', bg: '#F3E5F5', tooltip: 'FAA has given decision' },
  cic_filed:            { label: 'CIC Filed',          color: '#B71C1C', bg: '#FFEBEE', tooltip: 'Second appeal filed with CIC' },
  cic_decided:          { label: 'CIC Decided',        color: '#4E342E', bg: '#EFEBE9', tooltip: 'CIC has given its decision' },
  closed:               { label: 'Closed',             color: '#37474F', bg: '#ECEFF1', tooltip: 'Matter resolved and closed' },
  withdrawn:            { label: 'Withdrawn',          color: '#757575', bg: '#F5F5F5', tooltip: 'Application withdrawn by you' },
};

export default function RTIStatusBadge({ status, size = 'small' }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#546E7A', bg: '#ECEFF1', tooltip: '' };

  return (
    <Tooltip title={cfg.tooltip} placement="top">
      <Chip
        label={cfg.label}
        size={size}
        sx={{
          fontWeight: 700,
          fontSize:   size === 'small' ? '0.67rem' : '0.75rem',
          height:     size === 'small' ? 22 : 28,
          background: cfg.bg,
          color:      cfg.color,
          border:     `1px solid ${cfg.color}33`,
          cursor:     'default',
        }}
      />
    </Tooltip>
  );
}

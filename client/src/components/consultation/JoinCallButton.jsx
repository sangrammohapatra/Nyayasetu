import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import { RADIUS } from '../../theme/tokens';

// Citizens and lawyers can enter the room 10 minutes early, and until the slot ends.
const JOIN_EARLY_MS = 10 * 60 * 1000;

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function slotLabel(startMs) {
  return new Date(startMs).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

/**
 * null — not a joinable video consultation
 * early — before the lobby opens
 * open — within the slot (plus 10 minutes early)
 * ended — the slot is over
 */
export function callJoinState(consultation, now = Date.now()) {
  if (consultation?.mode !== 'video' || !consultation.meetingLink || consultation.status !== 'accepted') {
    return null;
  }
  const start = new Date(consultation.scheduledAt).getTime();
  if (Number.isNaN(start)) return null;
  const durationMs = (consultation.durationMinutes || 30) * 60 * 1000;
  if (now < start - JOIN_EARLY_MS) return { state: 'early', label: slotLabel(start) };
  if (now > start + durationMs) return { state: 'ended' };
  return { state: 'open' };
}

const buttonSx = {
  fontSize: '0.72rem',
  fontWeight: 700,
  whiteSpace: 'nowrap',
  borderRadius: `${RADIUS.md}px`,
  py: 0.4,
  background: '#1565c0',
  '&:hover': { background: '#0d47a1' },
  '&.Mui-disabled': {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
  },
};

export default function JoinCallButton({ consultation }) {
  const now = useNow();
  const join = callJoinState(consultation, now);
  if (!join || join.state === 'ended') return null;

  if (join.state === 'early') {
    return (
      <Tooltip title={`The call opens 10 minutes before ${join.label} IST`}>
        <span>
          <Button size="small" variant="outlined" disabled sx={buttonSx}>
            Join at {join.label}
          </Button>
        </span>
      </Tooltip>
    );
  }

  return (
    <Button
      size="small"
      variant="contained"
      component="a"
      href={consultation.meetingLink}
      target="_blank"
      rel="noopener noreferrer"
      sx={buttonSx}
    >
      Join Call
    </Button>
  );
}

import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';

export default function OfflineBanner() {
  const isOnline = useOfflineStatus();
  const [showReconnect, setShowReconnect] = useState(false);

  // When connectivity returns, flash a "reconnected" message briefly
  useEffect(() => {
    if (isOnline) {
      setShowReconnect(true);
      const t = setTimeout(() => setShowReconnect(false), 3000);
      return () => clearTimeout(t);
    }
  }, [isOnline]);

  if (isOnline && !showReconnect) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2000,
        py: 0.75,
        px: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        background: isOnline ? '#2e7d32' : '#b71c1c',
        transition: 'background 0.4s ease',
      }}
    >
      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 0.3 }}>
        {isOnline
          ? '✓ Back online — changes will sync automatically'
          : 'No internet connection — browsing saved documents'}
      </Typography>
    </Box>
  );
}

/**
 * AuthShared.jsx
 * Shared visual components for Login and Register pages.
 * – ScalesOfJusticeSVG: animated scales illustration
 * – AuthVisualPanel: two-column left panel (55% desktop, hidden mobile)
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import { motion } from 'framer-motion';
import { selectTheme } from '../../store/slices/uiSlice';

// ─── Illustration ─────────────────────────────────────────────────────────────

export function ScalesOfJusticeSVG() {
  return (
    <svg viewBox="0 0 260 280" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: 240, filter: 'drop-shadow(0 8px 24px rgba(255,255,255,0.15))' }}>
      <rect x="127" y="60" width="6" height="160" rx="3" fill="rgba(255,255,255,0.9)" />
      <rect x="90" y="218" width="80" height="10" rx="5" fill="rgba(255,255,255,0.8)" />
      <rect x="108" y="228" width="44" height="6" rx="3" fill="rgba(255,255,255,0.6)" />
      <rect x="60" y="80" width="140" height="6" rx="3" fill="rgba(255,255,255,0.9)" />
      <circle cx="130" cy="64" r="10" fill="rgba(255,255,255,0.9)" />
      <circle cx="130" cy="64" r="5" fill="rgba(255,255,255,0.35)" />
      <line x1="72" y1="86" x2="72" y2="136" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeDasharray="4 3" />
      <line x1="188" y1="86" x2="188" y2="116" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeDasharray="4 3" />
      <motion.g animate={{ rotate: [-3, 3, -3] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '72px 136px' }}>
        <ellipse cx="72" cy="158" rx="30" ry="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
        <path d="M44 138 Q72 132 100 138" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
        <line x1="44" y1="138" x2="44" y2="158" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <line x1="100" y1="138" x2="100" y2="158" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      </motion.g>
      <motion.g animate={{ rotate: [3, -3, 3] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '188px 116px' }}>
        <ellipse cx="188" cy="138" rx="30" ry="8" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
        <path d="M160 118 Q188 112 216 118" stroke="rgba(255,255,255,0.6)" strokeWidth="2" fill="none" />
        <line x1="160" y1="118" x2="160" y2="138" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <line x1="216" y1="118" x2="216" y2="138" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      </motion.g>
      {[[40, 50], [210, 40], [230, 180], [28, 190]].map(([cx, cy], i) => (
        <motion.circle key={i} cx={cx} cy={cy} r="3" fill="rgba(255,255,255,0.4)"
          animate={{ opacity: [0.2, 0.7, 0.2], scale: [0.8, 1.3, 0.8] }}
          transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: i * 0.5 }}
          style={{ transformOrigin: `${cx}px ${cy}px` }} />
      ))}
    </svg>
  );
}

// ─── Left visual panel ────────────────────────────────────────────────────────

export function AuthVisualPanel({ step = null }) {
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const themeId = useSelector(selectTheme);
  const isHighContrast = themeId === 'highContrast';

  const darkStrip = muiTheme.custom?.darkStrip || '#0F1623';
  const gradientBrand = muiTheme.custom?.gradientBrand || 'linear-gradient(135deg, #1565C0, #E65100)';

  // Step-aware floating chips (optional polish)
  const CHIP_SETS = {
    0: [
      { icon: '📄', label: t('auth.feature1', 'AI Legal Documents'), style: { top: '30%', left: '6%' } },
      { icon: '⚖️', label: t('auth.feature2', 'Case Tracking'), style: { top: '50%', right: '6%' } },
      { icon: '🌐', label: t('auth.feature3', '11 Languages'), style: { top: '68%', left: '10%' } },
    ],
    1: [
      { icon: '🏠', label: t('auth.role_citizen', 'Citizen Portal'), style: { top: '30%', left: '6%' } },
      { icon: '⚖️', label: t('auth.role_lawyer', 'Lawyer Dashboard'), style: { top: '50%', right: '6%' } },
      { icon: '🔒', label: t('auth.feature_secure', 'Secure & Private'), style: { top: '68%', left: '10%' } },
    ],
    2: [
      { icon: '🌐', label: t('auth.feature3', '11 Languages'), style: { top: '30%', left: '6%' } },
      { icon: '📱', label: t('auth.whatsapp_alerts', 'WhatsApp Alerts'), style: { top: '50%', right: '6%' } },
      { icon: '🎨', label: t('auth.custom_themes', '5 Themes'), style: { top: '68%', left: '10%' } },
    ],
  };

  const chips = CHIP_SETS[step] || CHIP_SETS[0];

  return (
    <Box sx={{
      width: '55%',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
      display: { xs: 'none', md: 'flex' },
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      p: 6,
      background: isHighContrast ? '#000000' : darkStrip,
    }}>

      {/* Gradient overlay — hidden on high contrast */}
      {!isHighContrast && (
        <Box sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: gradientBrand,
          opacity: 0.18,
        }} />
      )}

      {/* Radial highlight */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.06) 0%, transparent 65%)',
      }} />

      {/* Illustration + text */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: 320, textAlign: 'center', position: 'relative', zIndex: 1 }}
      >
        <ScalesOfJusticeSVG />

        <Typography variant="h3" sx={{
          fontFamily: "'Playfair Display', 'Tiro Devanagari Hindi', serif",
          color: '#FFFFFF',
          fontWeight: 700,
          mt: 4, mb: 1.5,
          lineHeight: 1.25,
          textShadow: '0 2px 12px rgba(0,0,0,0.4)',
          fontSize: { md: '1.75rem', lg: '2.125rem' },
        }}>
          {t('auth.tagline', 'न्याय सबके लिए')}
        </Typography>

        <Typography variant="body1" sx={{
          color: isHighContrast ? '#FFFFFF' : 'rgba(255,255,255,0.80)',
          lineHeight: 1.65,
          fontSize: '0.9375rem',
        }}>
          {t('auth.tagline_sub', 'Justice for every Indian, in every language')}
        </Typography>
      </motion.div>

      {/* Floating chips */}
      {chips.map((chip, i) => (
        <motion.div
          key={`${step}-${i}`}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3 + i * 0.9, repeat: Infinity, delay: i * 0.85, ease: 'easeInOut' }}
          style={{ position: 'absolute', zIndex: 2, ...chip.style }}
        >
          <Chip
            label={`${chip.icon} ${chip.label}`}
            sx={{
              background: isHighContrast
                ? 'rgba(255,255,255,0.15)'
                : 'rgba(255,255,255,0.11)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.22)',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '0.75rem',
              height: 32,
              '& .MuiChip-label': { px: 1.5 },
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          />
        </motion.div>
      ))}
    </Box>
  );
}

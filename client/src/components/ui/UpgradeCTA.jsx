/**
 * client/src/components/ui/UpgradeCTA.jsx
 *
 * Upgrade call-to-action. Two modes:
 *   compact=false — full GlassCard-style layout with plan info (standalone use)
 *   compact=true  — pill button only (used inside FeatureGate's locked card)
 *
 * Props:
 *   featureName    — internal feature key (e.g. 'pdf_download')
 *   featureLabel   — human-readable name shown in the card
 *   description    — override description text
 *   compact        — compact pill-button variant (default false)
 *   onClick        — override click handler (default: navigate to /pricing)
 *   href           — render button as <a> with this href instead of navigate
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import { selectUserPlan, selectUserPersona } from '../../store/slices/authSlice';
import { minimumPlanFor } from '../../utils/featureFlags';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { RADIUS, SPACING } from '../../theme/tokens';

const PLAN_LABELS = {
  basic:        'Basic ₹99/mo',
  pro:          'Pro ₹199/mo',
  professional: 'Professional ₹499/mo',
  firm:         'Firm ₹1,499/mo',
};

function UpgradeCTA({ featureName, featureLabel, description, compact = false, onClick, href }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const currentPlan = useSelector(selectUserPlan);
  const persona = useSelector(selectUserPersona);

  const requiredPlan = minimumPlanFor(persona, featureName);
  const planLabel = requiredPlan ? (PLAN_LABELS[requiredPlan] || requiredPlan) : null;

  const displayName = featureLabel || featureName?.replace(/_/g, ' ') || 'this feature';

  const handleUpgrade = onClick
    ? onClick
    : href
    ? () => { window.location.href = href; }
    : () => navigate('/pricing');

  // ── Pill CTA button (shared by both modes) ──────────────────────────────────
  const ctaButton = (
    <Button
      variant="contained"
      fullWidth={!compact}
      size={compact ? 'medium' : 'large'}
      onClick={handleUpgrade}
      {...(href && !onClick ? { component: 'a', href } : {})}
      sx={{
        background: 'var(--color-primary)',
        color: '#FFFFFF',
        fontWeight: 600,
        borderRadius: '8px',
        px: compact ? 2.5 : 3,
        py: compact ? 0.875 : 1.25,
        fontSize: compact ? '0.875rem' : '0.95rem',
        boxShadow: 'none',
        color: 'var(--color-bg)',
        '&:hover': {
          background: 'var(--color-primary-dark, var(--color-primary))',
          boxShadow: 'none',
        },
      }}
    >
      {compact ? 'Upgrade to unlock' : 'View plans'}
    </Button>
  );

  const motionWrapper = (node) => node;

  // ── Compact: just the motion-wrapped pill button ────────────────────────────
  if (compact) {
    return motionWrapper(ctaButton);
  }

  // ── Full card mode ──────────────────────────────────────────────────────────
  return (
    <Box
      sx={{
        borderRadius: `${RADIUS.xl}px`,
        border: theme.custom.cardBorder,
        background: theme.custom.cardBg,
        overflow: 'hidden',
        boxShadow: theme.custom.cardShadow,
      }}
    >
      <Box sx={{ p: { xs: SPACING.md / 8, sm: SPACING.xl / 8 } }}>
        {/* Lock icon + badge */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: `${RADIUS.lg}px`,
              background: 'var(--color-primary-alpha)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--color-primary)',
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>
              Unlock {displayName}
            </Typography>
            <Chip
              label={`Current: ${currentPlan === 'free' ? 'Free' : currentPlan}`}
              size="small"
              sx={{
                mt: 0.5,
                height: 20,
                fontSize: '0.7rem',
                background: 'var(--color-overlay)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            />
          </Box>
        </Box>

        {/* Description */}
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2.5, lineHeight: 1.6 }}>
          {description ||
            `${displayName.charAt(0).toUpperCase() + displayName.slice(1)} is available on the ${planLabel || 'paid'} plan. Upgrade to get access to this and many more features.`}
        </Typography>

        {/* Required plan callout */}
        {planLabel && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 1.25,
              mb: 2.5,
              borderRadius: `${RADIUS.md}px`,
              background: 'var(--color-surface-raised, var(--color-bg))',
              border: '1px solid var(--color-border)',
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
                Available on
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                {planLabel}
              </Typography>
            </Box>
          </Box>
        )}

        {/* CTA */}
        {motionWrapper(ctaButton)}

        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1.5, color: 'var(--color-text-secondary)' }}>
          No credit card required to browse plans
        </Typography>
      </Box>
    </Box>
  );
}

export default UpgradeCTA;

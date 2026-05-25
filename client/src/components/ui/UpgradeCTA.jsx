/**
 * client/src/components/ui/UpgradeCTA.jsx
 *
 * Shown by FeatureGate when a user tries to access a gated feature.
 * Uses only CSS custom properties and MUI theme tokens — zero hardcoded hex.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import { useSelector } from 'react-redux';
import { selectUserPlan, selectUserPersona } from '../../store/slices/authSlice';
import { minimumPlanFor } from '../../utils/featureFlags';
import { RADIUS, SHADOWS, SPACING } from '../../theme/tokens';

const PLAN_LABELS = {
  basic:        'Basic ₹99/mo',
  pro:          'Pro ₹199/mo',
  professional: 'Professional ₹499/mo',
  firm:         'Firm ₹1,499/mo',
};

const PLAN_ICONS = {
  basic: '⭐',
  pro: '🚀',
  professional: '⚖️',
  firm: '🏛️',
};

// Subtle pulse animation for the CTA button
const pulseVariants = {
  idle: { scale: 1, boxShadow: '0 0 0 0 var(--color-primary-alpha)' },
  pulse: {
    scale: [1, 1.03, 1],
    boxShadow: [
      '0 0 0 0 var(--color-primary-alpha)',
      '0 0 0 10px rgba(0,0,0,0)',
      '0 0 0 0 rgba(0,0,0,0)',
    ],
    transition: {
      duration: 2.2,
      repeat: Infinity,
      repeatDelay: 1,
      ease: 'easeInOut',
    },
  },
};

/**
 * @param {object}  props
 * @param {string}  props.featureName    Internal feature key (e.g. 'pdf_download')
 * @param {string}  [props.featureLabel] Human-readable feature name shown in the card
 * @param {string}  [props.description]  Optional description text
 * @param {boolean} [props.compact]      Compact inline variant (no card wrapper)
 */
function UpgradeCTA({ featureName, featureLabel, description, compact = false }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const currentPlan = useSelector(selectUserPlan);
  const persona = useSelector(selectUserPersona);

  const requiredPlan = minimumPlanFor(persona, featureName);
  const planLabel = requiredPlan ? (PLAN_LABELS[requiredPlan] || requiredPlan) : null;
  const planIcon = requiredPlan ? (PLAN_ICONS[requiredPlan] || '🔒') : '🔒';

  const displayName = featureLabel || featureName?.replace(/_/g, ' ') || 'this feature';

  const handleUpgrade = () => navigate('/pricing');

  if (compact) {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderRadius: `${RADIUS.md}px`,
          background: 'var(--color-primary-alpha)',
          border: '1px solid var(--color-primary)',
          cursor: 'pointer',
        }}
        onClick={handleUpgrade}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleUpgrade()}
      >
        <Typography variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          🔒 Upgrade to unlock
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: `${RADIUS.xl}px`,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
        boxShadow: SHADOWS.md,
      }}
    >
      {/* Gradient header bar using theme primary */}
      <Box
        sx={{
          height: 4,
          background: `linear-gradient(90deg, var(--color-primary), var(--color-primary-light))`,
        }}
      />

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
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            🔒
          </Box>
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                color: 'var(--color-text)',
                lineHeight: 1.3,
              }}
            >
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
        <Typography
          variant="body2"
          sx={{ color: 'var(--color-text-secondary)', mb: 2.5, lineHeight: 1.6 }}
        >
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
            <Typography sx={{ fontSize: 20 }}>{planIcon}</Typography>
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

        {/* CTA button with pulse animation */}
        <motion.div variants={pulseVariants} initial="idle" animate="pulse">
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleUpgrade}
            sx={{
              background: 'var(--color-primary)',
              color: '#FFFFFF',
              fontWeight: 700,
              borderRadius: `${RADIUS.md}px`,
              py: 1.25,
              fontSize: '1rem',
              '&:hover': {
                background: 'var(--color-primary-dark, var(--color-primary))',
                transform: 'translateY(-1px)',
                boxShadow: SHADOWS.md,
              },
              transition: 'all 200ms ease',
            }}
          >
            View Upgrade Plans
          </Button>
        </motion.div>

        {/* Secondary no-thanks link */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 1.5,
            color: 'var(--color-text-secondary)',
          }}
        >
          No credit card required to browse plans
        </Typography>
      </Box>
    </Box>
  );
}

export default UpgradeCTA;

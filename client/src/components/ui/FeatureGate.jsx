/**
 * client/src/components/ui/FeatureGate.jsx
 *
 * Checks whether the authenticated user's plan includes the requested feature.
 * Renders children when allowed; renders a GlassCard overlay (lock icon +
 * message + UpgradeCTA pill) when not allowed.
 *
 * Usage:
 *   <FeatureGate feature="pdf_download">
 *     <DownloadButton />
 *   </FeatureGate>
 *
 *   <FeatureGate feature="book_consultation" fallback={null}>
 *     <ConsultButton />
 *   </FeatureGate>
 *
 *   <FeatureGate feature="voice_input" compact>
 *     <VoiceInputButton />
 *   </FeatureGate>
 */

import React from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { selectUserPersona, selectUserPlan } from '../../store/slices/authSlice';
import { hasFeature } from '../../utils/featureFlags';
import GlassCard from './GlassCard';
import UpgradeCTA from './UpgradeCTA';

/**
 * @param {object}               props
 * @param {string}               props.feature        Feature key from FEATURE_MAP
 * @param {React.ReactNode}      props.children       Rendered when feature is allowed
 * @param {React.ReactNode|null} [props.fallback]     Override the locked UI. Pass null to render nothing.
 * @param {string}               [props.featureLabel] Human-readable label shown in locked state
 * @param {string}               [props.description]  Description shown in locked state
 * @param {boolean}              [props.compact]      Use compact inline locked variant (default false)
 * @param {boolean}              [props.animate]      Animate the gate swap (default true)
 */
function FeatureGate({
  feature,
  children,
  fallback,
  featureLabel,
  description,
  compact = false,
  animate = true,
}) {
  const persona = useSelector(selectUserPersona);
  const plan = useSelector(selectUserPlan);

  const allowed = hasFeature(persona || 'citizen', plan || 'free', feature);

  const displayName = featureLabel || feature?.replace(/_/g, ' ') || 'this feature';

  let content;

  if (allowed) {
    content = children;
  } else if (fallback !== undefined) {
    content = fallback;
  } else if (compact) {
    // Compact: inline chip-style locked indicator
    content = (
      <UpgradeCTA
        featureName={feature}
        featureLabel={featureLabel}
        description={description}
        compact
      />
    );
  } else {
    // Full: GlassCard overlay with lock icon, message, and CTA button
    content = (
      <GlassCard
        sx={{
          p: { xs: 3, sm: 4 },
          textAlign: 'center',
          maxWidth: 400,
          mx: 'auto',
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--color-secondary-alpha, var(--color-overlay))',
            mb: 2.5,
          }}
        >
          <LockOutlinedIcon
            sx={{ fontSize: 32, color: 'secondary.main', opacity: 0.75 }}
          />
        </Box>

        <Typography
          variant="h6"
          sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1, lineHeight: 1.35 }}
        >
          Unlock {displayName}
        </Typography>

        <Typography
          variant="body2"
          sx={{ color: 'var(--color-text-secondary)', mb: 3, lineHeight: 1.65 }}
        >
          {description ||
            `This feature isn't included in your current plan. Upgrade to access ${displayName} and more.`}
        </Typography>

        <UpgradeCTA
          featureName={feature}
          featureLabel={featureLabel}
          description={description}
          compact
        />
      </GlassCard>
    );
  }

  if (!animate) return <>{content}</>;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={allowed ? 'allowed' : 'blocked'}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{ width: '100%' }}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

export default FeatureGate;

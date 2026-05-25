/**
 * client/src/components/ui/FeatureGate.jsx
 *
 * Checks whether the authenticated user's plan includes the requested feature.
 * Renders children when allowed; renders <UpgradeCTA> (or a custom fallback)
 * when not allowed.
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
import { selectUserPersona, selectUserPlan } from '../../store/slices/authSlice';
import { hasFeature } from '../../utils/featureFlags';
import UpgradeCTA from './UpgradeCTA';

/**
 * @param {object}           props
 * @param {string}           props.feature        Feature key from FEATURE_MAP
 * @param {React.ReactNode}  props.children       Rendered when feature is allowed
 * @param {React.ReactNode|null} [props.fallback] Override the default UpgradeCTA.
 *                                                Pass null to render nothing when blocked.
 * @param {string}           [props.featureLabel] Human-readable label shown in UpgradeCTA
 * @param {string}           [props.description]  Description shown in UpgradeCTA
 * @param {boolean}          [props.compact]      Use compact inline UpgradeCTA variant
 * @param {boolean}          [props.animate]      Animate the gate swap (default true)
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

  const content = allowed
    ? children
    : fallback !== undefined
    ? fallback
    : (
      <UpgradeCTA
        featureName={feature}
        featureLabel={featureLabel}
        description={description}
        compact={compact}
      />
    );

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

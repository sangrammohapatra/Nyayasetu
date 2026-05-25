/**
 * client/src/components/document/ClauseExplainer.jsx
 *
 * MUI Popover anchored to the clicked clause.
 * Dispatches explainClause (SSE streaming) and renders the progressive result.
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import {
  explainClause,
  selectClauseExplanations,
  selectClauseBuffer,
  selectExplanationLoading,
} from '../../store/slices/documentSlice';
import { selectLanguage } from '../../store/slices/uiSlice';
import { RADIUS, SHADOWS } from '../../theme/tokens';

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'EN' }, { code: 'hi', label: 'HI' },
  { code: 'bn', label: 'BN' }, { code: 'mr', label: 'MR' },
  { code: 'ta', label: 'TA' }, { code: 'te', label: 'TE' },
];

function ClauseExplainer({ anchorEl, onClose, documentId, clauseIndex, clauseText }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const explanations = useSelector(selectClauseExplanations);
  const streamBuffer = useSelector(selectClauseBuffer);
  const loading = useSelector(selectExplanationLoading);
  const reduxLang = useSelector(selectLanguage);

  const [lang, setLang] = useState(reduxLang || 'en');
  const open = Boolean(anchorEl) && clauseIndex !== null && clauseIndex !== undefined;

  const explanationKey = `${clauseIndex}_${lang}`;
  const savedExplanation = explanations[explanationKey] || explanations[clauseIndex];
  const displayText = loading && !savedExplanation ? streamBuffer : (savedExplanation || '');

  // Trigger explanation when popover opens or language changes
  useEffect(() => {
    if (!open || clauseIndex === null || !documentId) return;
    if (savedExplanation) return; // already have it
    dispatch(explainClause({ documentId, clauseIndex, clauseText, language: lang }));
  }, [open, clauseIndex, lang, documentId]);

  const handleLangChange = (code) => {
    if (code === lang) return;
    setLang(code);
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{
        sx: {
          borderRadius: `${RADIUS.xl}px`,
          border: '1px solid var(--color-border)',
          boxShadow: SHADOWS.lg,
          background: 'var(--color-surface)',
          overflow: 'hidden',
          maxWidth: isMobile ? '92vw' : 380,
          minWidth: 280,
        },
      }}
      slotProps={{ backdrop: { sx: { background: 'transparent' } } }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        {/* Header */}
        <Box sx={{
          px: 2.5, pt: 2, pb: 1.25,
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 20 }}>💡</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
              {t('clause.title', 'In Simple Terms')}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}
            sx={{ color: 'var(--color-text-secondary)', '&:hover': { background: 'var(--color-overlay)' } }}>
            <Typography sx={{ fontSize: 16, lineHeight: 1 }}>✕</Typography>
          </IconButton>
        </Box>

        {/* Language selector */}
        <Box sx={{ px: 2.5, pt: 1.25, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {LANGUAGE_OPTIONS.map((l) => (
            <Chip
              key={l.code}
              label={l.label}
              size="small"
              onClick={() => handleLangChange(l.code)}
              sx={{
                height: 22, fontSize: '0.68rem', fontWeight: 600,
                cursor: 'pointer',
                background: lang === l.code ? 'var(--color-primary)' : 'var(--color-bg)',
                color: lang === l.code ? '#fff' : 'var(--color-text-secondary)',
                border: lang === l.code ? 'none' : '1px solid var(--color-border)',
                '&:hover': { background: lang === l.code ? 'var(--color-primary)' : 'var(--color-overlay)' },
              }}
            />
          ))}
        </Box>

        {/* Explanation body */}
        <Box sx={{ px: 2.5, py: 2, minHeight: 80 }}>
          <AnimatePresence mode="wait">
            {loading && !displayText ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 8 }}
              >
                <CircularProgress size={16} sx={{ color: 'var(--color-primary)' }} />
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                  {t('clause.explaining', 'Explaining…')}
                </Typography>
              </motion.div>
            ) : (
              <motion.div
                key={`${clauseIndex}-${lang}`}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <Typography variant="body2" sx={{ color: 'var(--color-text)', lineHeight: 1.7 }}>
                  {displayText}
                  {loading && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      style={{
                        display: 'inline-block', width: 2, height: 12,
                        background: 'var(--color-primary)',
                        marginLeft: 2, verticalAlign: 'text-bottom', borderRadius: 1,
                      }}
                    />
                  )}
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Original clause snippet */}
        {clauseText && (
          <Box sx={{
            mx: 2.5, mb: 2, p: 1.5,
            borderRadius: `${RADIUS.md}px`,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
          }}>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', mb: 0.25 }}>
              {t('clause.original', 'Original clause')}
            </Typography>
            <Typography variant="caption" sx={{
              color: 'var(--color-text)', lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {clauseText}
            </Typography>
          </Box>
        )}
      </motion.div>
    </Popover>
  );
}

export default ClauseExplainer;

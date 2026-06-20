import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';
import { selectUser, selectUserPlan } from '../../store/slices/authSlice';
import api from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────────────────

const URGENCY_CONFIG = {
  CRITICAL: {
    label: 'CRITICAL',
    color: '#FF1744',
    bg: 'rgba(255,23,68,0.12)',
    border: 'rgba(255,23,68,0.4)',
    pulse: true,
  },
  URGENT: {
    label: 'URGENT',
    color: '#FF6D00',
    bg: 'rgba(255,109,0,0.12)',
    border: 'rgba(255,109,0,0.4)',
    pulse: false,
  },
  MODERATE: {
    label: 'MODERATE',
    color: '#FFD600',
    bg: 'rgba(255,214,0,0.10)',
    border: 'rgba(255,214,0,0.4)',
    pulse: false,
  },
};

const CATEGORY_ICONS = {
  Criminal: '🚨',
  'Domestic Violence': '🛡️',
  Property: '🏠',
  Consumer: '🛒',
  Employment: '💼',
  Tenant: '🏘️',
  'Family/Matrimonial': '👨‍👩‍👧',
  Cybercrime: '💻',
  'Financial Fraud': '💸',
  'Land Acquisition': '📋',
  'Human Rights': '⚖️',
  Other: '📄',
};

const TEMPLATE_LABELS = {
  'domestic-violence-complaint': 'Domestic Violence Complaint',
  'police-complaint':            'Police Complaint (FIR)',
  'consumer-complaint':          'Consumer Complaint',
  'property-dispute':            'Property Dispute Notice',
  'tenant-notice':               'Tenant / Rental Notice',
  'employment-termination':      'Employment Notice',
};

const MAX_CHARS = 2000;

// ─── Sub-components ───────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }) {
  const cfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.MODERATE;
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 0.75,
          borderRadius: '100px',
          background: cfg.bg,
          border: `1.5px solid ${cfg.border}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {cfg.pulse && (
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: cfg.color,
              animation: 'pulse 1.2s ease-in-out infinite',
              '@keyframes pulse': {
                '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                '50%': { opacity: 0.4, transform: 'scale(1.5)' },
              },
            }}
          />
        )}
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 800,
            color: cfg.color,
            letterSpacing: '0.08em',
            fontFamily: TYPOGRAPHY.fontFamily.mono,
          }}
        >
          {cfg.label}
        </Typography>
      </Box>
    </motion.div>
  );
}

function StepCard({ step, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          p: 2,
          borderRadius: `${RADIUS.md}px`,
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
          mb: 1.5,
        }}
      >
        <Box
          sx={{
            minWidth: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.85rem',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          {step.order}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.9rem',
              color: 'var(--color-text)',
              mb: 0.5,
            }}
          >
            {step.action}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            {step.channel && (
              <Chip
                label={step.channel}
                size="small"
                sx={{
                  fontSize: '0.7rem',
                  background: 'rgba(var(--color-primary-rgb),0.1)',
                  color: 'var(--color-primary)',
                  border: '1px solid rgba(var(--color-primary-rgb),0.2)',
                  height: 22,
                }}
              />
            )}
            {step.deadline && (
              <Chip
                label={`⏰ ${step.deadline}`}
                size="small"
                sx={{
                  fontSize: '0.7rem',
                  background: 'rgba(255,109,0,0.1)',
                  color: '#FF6D00',
                  border: '1px solid rgba(255,109,0,0.2)',
                  height: 22,
                }}
              />
            )}
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

function LawCard({ law, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <Box
        sx={{
          p: 1.5,
          borderRadius: `${RADIUS.sm}px`,
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
          mb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 700, flexShrink: 0 }}>
            ⚖️
          </Typography>
          <Box>
            <Typography sx={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {law.name}{law.section ? ` — §${law.section}` : ''}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', mt: 0.25 }}>
              {law.relevance}
            </Typography>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

function LegalAidCard({ center }) {
  if (!center) return null;
  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: `${RADIUS.md}px`,
        background: 'rgba(var(--color-primary-rgb),0.06)',
        border: '1.5px solid rgba(var(--color-primary-rgb),0.2)',
      }}
    >
      <Typography
        sx={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: 'var(--color-primary)',
          letterSpacing: '0.08em',
          mb: 0.75,
          textTransform: 'uppercase',
        }}
      >
        Nearest Legal Aid Authority
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', mb: 0.25 }}>
        {center.authority}
      </Typography>
      {center.address && (
        <Typography sx={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', mb: 0.5 }}>
          📍 {center.address}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
        {center.phone && (
          <Box
            component="a"
            href={`tel:${center.phone}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: '0.83rem',
              color: 'var(--color-primary)',
              fontWeight: 600,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            📞 {center.phone}
          </Box>
        )}
        {center.email && (
          <Box
            component="a"
            href={`mailto:${center.email}`}
            sx={{
              fontSize: '0.8rem',
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              '&:hover': { color: 'var(--color-primary)' },
            }}
          >
            ✉️ {center.email}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmergencyHelpline() {
  const navigate  = useNavigate();
  const user      = useSelector(selectUser);
  const plan      = useSelector(selectUserPlan);
  const textRef   = useRef(null);

  const [description, setDescription] = useState('');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState('');
  const [quota, setQuota]             = useState(null);
  const [showLaws, setShowLaws]       = useState(false);

  // Fetch current daily quota on mount
  useEffect(() => {
    api.get('/triage/quota')
      .then(({ data }) => setQuota(data))
      .catch(() => {});
  }, []);

  const charsLeft   = MAX_CHARS - description.length;
  const canSubmit   = description.trim().length >= 10 && !loading && (quota == null || quota.remaining > 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');
    setResult(null);
    setShowLaws(false);

    try {
      const { data } = await api.post('/triage', {
        description: description.trim(),
        stateCode:   user?.stateCode || null,
        language:    user?.preferredLanguage || 'en',
      });

      setResult(data);
      setQuota((prev) =>
        prev ? { ...prev, used: data.usage.used, remaining: data.usage.remaining } : prev
      );

      // Scroll to results
      setTimeout(() => {
        document.getElementById('triage-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      const msg = err?.response?.data?.message;
      if (err?.response?.status === 403) {
        setError(msg || 'Daily limit reached. Upgrade for more triages.');
      } else {
        setError(msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setDescription('');
    setError('');
    setShowLaws(false);
    textRef.current?.focus();
  }

  const triage    = result?.triage;
  const usage     = result?.usage;
  const urgencyCfg = triage ? (URGENCY_CONFIG[triage.urgency] || URGENCY_CONFIG.MODERATE) : null;

  return (
    <AnimatedPage>
      <Box sx={{ maxWidth: 780, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 4 } }}>

        {/* ── Emergency Header ── */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(255,23,68,0.12)',
                border: '2px solid rgba(255,23,68,0.35)',
                mb: 2,
                fontSize: 34,
              }}
            >
              🆘
            </Box>
          </motion.div>

          <Typography
            sx={{
              fontFamily: TYPOGRAPHY.fontFamily.display,
              fontSize: { xs: '1.6rem', sm: '2rem' },
              fontWeight: 800,
              color: 'var(--color-text)',
              mb: 0.75,
              lineHeight: 1.2,
            }}
          >
            Legal Helpline
          </Typography>
          <Typography sx={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', maxWidth: 480, mx: 'auto' }}>
            Describe what happened — in any language — and get instant guidance on your legal rights, next steps, and who to call.
          </Typography>

          {/* NALSA strip */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mt: 2,
              px: 2,
              py: 0.75,
              borderRadius: '100px',
              background: 'rgba(255,23,68,0.08)',
              border: '1px solid rgba(255,23,68,0.2)',
            }}
          >
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#FF1744',
                animation: 'blink 1.5s ease-in-out infinite',
                '@keyframes blink': {
                  '0%,100%': { opacity: 1 },
                  '50%':     { opacity: 0.2 },
                },
              }}
            />
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#FF1744' }}>
              NALSA Free Legal Aid Helpline: <strong>1516</strong>
            </Typography>
          </Box>
        </Box>

        {/* ── Quota Banner ── */}
        {quota != null && (
          <Box
            sx={{
              mb: 2.5,
              p: 1.5,
              borderRadius: `${RADIUS.md}px`,
              background: quota.remaining === 0
                ? 'rgba(255,23,68,0.08)'
                : 'rgba(var(--color-primary-rgb),0.06)',
              border: `1px solid ${quota.remaining === 0
                ? 'rgba(255,23,68,0.2)'
                : 'rgba(var(--color-primary-rgb),0.15)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
                Daily triages used:
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {quota.used} / {quota.limit === 999 ? '∞' : quota.limit}
              </Typography>
            </Box>
            {quota.remaining === 0 && (
              <Button
                size="small"
                onClick={() => navigate('/pricing')}
                sx={{
                  fontSize: '0.75rem',
                  color: '#FF1744',
                  fontWeight: 600,
                  px: 1.5,
                  py: 0.4,
                  border: '1px solid rgba(255,23,68,0.3)',
                  borderRadius: '100px',
                  textTransform: 'none',
                }}
              >
                Upgrade for more
              </Button>
            )}
          </Box>
        )}

        {/* ── Input Form ── */}
        <AnimatePresence mode="wait">
          {!result && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <GlassCard sx={{ p: { xs: 2.5, sm: 3 } }}>
                <form onSubmit={handleSubmit}>
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      mb: 1.5,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                    }}
                  >
                    Describe what happened
                  </Typography>

                  <TextField
                    inputRef={textRef}
                    multiline
                    minRows={5}
                    maxRows={12}
                    fullWidth
                    autoFocus
                    placeholder="Aapke saath kya hua? (Hindi/English/Any language OK)\n\nE.g. My landlord locked me out of my house without notice. Or: मुझे बिना नोटिस के घर से निकाल दिया गया।"
                    value={description}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_CHARS) setDescription(e.target.value);
                    }}
                    disabled={loading || (quota != null && quota.remaining === 0)}
                    sx={{
                      mb: 1,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: `${RADIUS.md}px`,
                        background: 'var(--color-surface-2)',
                        fontSize: '0.95rem',
                        '& fieldset': { borderColor: 'var(--color-border)' },
                        '&:hover fieldset': { borderColor: 'var(--color-primary)' },
                        '&.Mui-focused fieldset': { borderColor: 'var(--color-primary)' },
                      },
                      '& textarea': {
                        color: 'var(--color-text)',
                        '&::placeholder': { color: 'var(--color-text-secondary)', opacity: 0.7 },
                      },
                    }}
                  />

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      Works in Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, and more.
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: '0.72rem',
                        color: charsLeft < 100 ? '#FF6D00' : 'var(--color-text-secondary)',
                        fontFamily: TYPOGRAPHY.fontFamily.mono,
                      }}
                    >
                      {charsLeft} left
                    </Typography>
                  </Box>

                  {error && (
                    <Box
                      sx={{
                        mb: 2,
                        p: 1.5,
                        borderRadius: `${RADIUS.sm}px`,
                        background: 'rgba(255,23,68,0.08)',
                        border: '1px solid rgba(255,23,68,0.25)',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.83rem', color: '#FF1744' }}>
                        {error}
                      </Typography>
                    </Box>
                  )}

                  <Button
                    type="submit"
                    fullWidth
                    disabled={!canSubmit}
                    sx={{
                      py: 1.5,
                      borderRadius: `${RADIUS.md}px`,
                      background: canSubmit
                        ? 'linear-gradient(135deg, #FF1744 0%, #D50000 100%)'
                        : 'var(--color-border)',
                      color: canSubmit ? '#fff' : 'var(--color-text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      textTransform: 'none',
                      boxShadow: canSubmit ? '0 4px 16px rgba(255,23,68,0.35)' : 'none',
                      transition: 'all 0.2s ease',
                      '&:hover': canSubmit
                        ? { background: 'linear-gradient(135deg, #D50000 0%, #B71C1C 100%)', boxShadow: '0 6px 20px rgba(255,23,68,0.45)' }
                        : {},
                      '&.Mui-disabled': { color: 'var(--color-text-secondary)' },
                    }}
                  >
                    {loading ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CircularProgress size={18} sx={{ color: '#fff' }} />
                        Analyzing your situation…
                      </Box>
                    ) : quota?.remaining === 0 ? (
                      'Daily limit reached — Upgrade to continue'
                    ) : (
                      '🆘  Get Immediate Legal Guidance'
                    )}
                  </Button>
                </form>

                {loading && (
                  <LinearProgress
                    sx={{
                      mt: 2,
                      borderRadius: 4,
                      height: 3,
                      background: 'rgba(255,23,68,0.12)',
                      '& .MuiLinearProgress-bar': { background: '#FF1744' },
                    }}
                  />
                )}
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results ── */}
        <AnimatePresence>
          {result && triage && (
            <motion.div
              id="triage-result"
              key="result"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Urgency + Category */}
              <Box
                sx={{
                  p: { xs: 2.5, sm: 3 },
                  borderRadius: `${RADIUS.lg}px`,
                  background: urgencyCfg.bg,
                  border: `2px solid ${urgencyCfg.border}`,
                  mb: 2.5,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                  <UrgencyBadge urgency={triage.urgency} />
                  <Chip
                    label={`${CATEGORY_ICONS[triage.legalCategory] || '⚖️'} ${triage.legalCategory}`}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      border: '1px solid var(--color-border)',
                    }}
                  />
                </Box>

                {triage.summary && (
                  <Typography sx={{ fontSize: '0.93rem', color: 'var(--color-text)', lineHeight: 1.65 }}>
                    {triage.summary}
                  </Typography>
                )}

                {triage.detectedLanguage && triage.detectedLanguage !== 'en' && (
                  <Typography sx={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', mt: 1 }}>
                    Detected language: <strong>{triage.detectedLanguage}</strong>
                  </Typography>
                )}
              </Box>

              {/* Immediate Steps */}
              {triage.immediateSteps?.length > 0 && (
                <GlassCard sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
                  <Typography
                    sx={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      mb: 2,
                    }}
                  >
                    Immediate Steps
                  </Typography>
                  {triage.immediateSteps.map((step, i) => (
                    <StepCard key={i} step={step} index={i} />
                  ))}
                </GlassCard>
              )}

              {/* Important Deadlines */}
              {triage.importantDeadlines?.length > 0 && (
                <GlassCard sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
                  <Typography
                    sx={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#FF6D00',
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      mb: 1.5,
                    }}
                  >
                    ⏰ Important Deadlines
                  </Typography>
                  {triage.importantDeadlines.map((dl, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        gap: 1.5,
                        mb: 1,
                        p: 1.5,
                        borderRadius: `${RADIUS.sm}px`,
                        background: 'rgba(255,109,0,0.06)',
                        border: '1px solid rgba(255,109,0,0.2)',
                      }}
                    >
                      <Typography sx={{ fontSize: '0.83rem', color: 'var(--color-text)', flex: 1 }}>
                        {dl.description}
                      </Typography>
                      {dl.timeframe && (
                        <Chip
                          label={dl.timeframe}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            background: 'rgba(255,109,0,0.12)',
                            color: '#FF6D00',
                            fontWeight: 600,
                            height: 22,
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </Box>
                  ))}
                </GlassCard>
              )}

              {/* Applicable Laws (collapsible) */}
              {triage.applicableLaws?.length > 0 && (
                <GlassCard sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', mb: showLaws ? 2 : 0 }}
                    onClick={() => setShowLaws((v) => !v)}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.07em',
                      }}
                    >
                      Applicable Laws ({triage.applicableLaws.length})
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                      {showLaws ? 'Hide ▲' : 'Show ▼'}
                    </Typography>
                  </Box>
                  <Collapse in={showLaws}>
                    {triage.applicableLaws.map((law, i) => (
                      <LawCard key={i} law={law} index={i} />
                    ))}
                  </Collapse>
                </GlassCard>
              )}

              {/* Template CTA */}
              {triage.recommendedTemplate && (
                <GlassCard
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    mb: 2,
                    border: '2px solid rgba(var(--color-primary-rgb),0.3)',
                    background: 'rgba(var(--color-primary-rgb),0.04)',
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--color-primary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      mb: 1.5,
                    }}
                  >
                    Recommended Document
                  </Typography>
                  <Typography sx={{ fontSize: '0.88rem', color: 'var(--color-text)', mb: 0.75, fontWeight: 600 }}>
                    📄 {TEMPLATE_LABELS[triage.recommendedTemplate.slug] || triage.recommendedTemplate.slug}
                  </Typography>
                  {triage.recommendedTemplate.reason && (
                    <Typography sx={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', mb: 1.5 }}>
                      {triage.recommendedTemplate.reason}
                    </Typography>
                  )}
                  <Button
                    fullWidth
                    onClick={() => navigate(`/citizen/chat/${triage.recommendedTemplate.slug}`)}
                    sx={{
                      py: 1.25,
                      borderRadius: `${RADIUS.md}px`,
                      background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      textTransform: 'none',
                      boxShadow: SHADOWS.primary,
                    }}
                  >
                    Generate This Document Now →
                  </Button>
                </GlassCard>
              )}

              {/* Legal Aid Center */}
              {triage.legalAidCenter && (
                <Box sx={{ mb: 2 }}>
                  <LegalAidCard center={triage.legalAidCenter} />
                </Box>
              )}

              {/* Usage + Actions */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
                {usage && (
                  <Typography sx={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                    {usage.remaining > 0
                      ? `${usage.remaining} triage${usage.remaining === 1 ? '' : 's'} remaining today`
                      : 'Daily limit reached'}
                    {' · '}
                    <Box
                      component="span"
                      sx={{ color: 'var(--color-primary)', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => navigate('/pricing')}
                    >
                      Upgrade for more
                    </Box>
                  </Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    onClick={handleReset}
                    sx={{
                      fontSize: '0.8rem',
                      textTransform: 'none',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                      borderRadius: `${RADIUS.sm}px`,
                      px: 2,
                      '&:hover': { color: 'var(--color-text)', borderColor: 'var(--color-text)' },
                    }}
                  >
                    New Situation
                  </Button>
                  <Button
                    size="small"
                    onClick={() => navigate('/citizen/home')}
                    sx={{
                      fontSize: '0.8rem',
                      textTransform: 'none',
                      color: 'var(--color-primary)',
                      border: '1px solid rgba(var(--color-primary-rgb),0.3)',
                      borderRadius: `${RADIUS.sm}px`,
                      px: 2,
                    }}
                  >
                    Back to Home
                  </Button>
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Disclaimer ── */}
        <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid var(--color-border)' }}>
          <Typography sx={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.7 }}>
            This AI triage is for informational guidance only and does not constitute legal advice.
            For urgent matters, call <strong>1516</strong> (NALSA free legal aid) or contact your nearest police station.
            Always consult a qualified lawyer for your specific situation.
          </Typography>
        </Box>

      </Box>
    </AnimatedPage>
  );
}

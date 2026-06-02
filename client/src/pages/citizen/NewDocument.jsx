/**
 * client/src/pages/citizen/NewDocument.jsx
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import InputAdornment from '@mui/material/InputAdornment';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import AnimatedPage from '../../components/ui/AnimatedPage';
import FeatureGate from '../../components/ui/FeatureGate';
import { RADIUS, SHADOWS } from '../../theme/tokens';
import { selectUserPlan, selectUserPersona } from '../../store/slices/authSlice';
import { hasFeature } from '../../utils/featureFlags';
import api from '../../services/api';

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { slug: 'all',        label: t('newDoc.category_all', 'All'),        icon: '📋' },
  { slug: 'consumer',   label: t('newDoc.category_consumer', 'Consumer'),   icon: '🛒' },
  { slug: 'property',   label: t('newDoc.category_property', 'Property'),   icon: '🏠' },
  { slug: 'employment', label: t('newDoc.category_employment', 'Employment'), icon: '💼' },
  { slug: 'family',     label: t('newDoc.category_family', 'Family'),     icon: '👨‍👩‍👧' },
  { slug: 'criminal',   label: t('newDoc.category_criminal', 'Criminal'),   icon: '⚖️' },
  { slug: 'rti',        label: t('newDoc.category_rti', 'RTI'),        icon: '📑' },
  { slug: 'civil',      label: t('newDoc.category_civil', 'Civil'),      icon: '🏛️' },
  { slug: 'financial',  label: t('newDoc.category_financial', 'Financial'),  icon: '💰' },
  { slug: 'labour',     label: t('newDoc.category_labour', 'Labour'),     icon: '👷' },
  { slug: 'startup',    label: t('newDoc.category_startup', 'Startup'),    icon: '🚀' },
];

const CATEGORY_ICONS = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c.icon]));

const COMPLEXITY_STYLES = {
  simple:   { label: t('newDoc.complexity_simple', 'Simple'),   color: 'var(--color-success)', bg: 'rgba(46,125,50,0.1)' },
  moderate: { label: t('newDoc.complexity_moderate', 'Moderate'), color: 'var(--color-warning)', bg: 'rgba(230,81,0,0.1)' },
  complex:  { label: t('newDoc.complexity_complex', 'Complex'),  color: 'var(--color-error)',   bg: 'rgba(198,40,40,0.1)' },
};

const PLAN_STYLES = {
  free:  { label: t('newDoc.plan_free', '🆓 FREE'), bg: 'rgba(46,125,50,0.12)', color: 'var(--color-success)' },
  basic: { label: t('newDoc.plan_basic', '⭐ BASIC'), bg: 'var(--color-primary-alpha)', color: 'var(--color-primary)' },
  pro:   { label: t('newDoc.plan_pro', '🚀 PRO'),   bg: 'rgba(230,81,0,0.12)',       color: 'var(--color-warning)' },
};

function getPlanRequired(template) {
  if (template.pricePayPerDoc === 0) return 'free';
  const p = template.requiredPlan?.citizen;
  if (!p || p === 'free') return 'free';
  return p;
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCardSkeleton() {
  return (
    <Box sx={{
      p: 2.5, borderRadius: `${RADIUS.lg}px`,
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
    }}>
      <Skeleton variant="rectangular" width={48} height={48} sx={{ borderRadius: `${RADIUS.md}px`, mb: 1.5 }} />
      <Skeleton variant="text" width="80%" height={20} />
      <Skeleton variant="text" width="55%" height={16} sx={{ mt: 0.5 }} />
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
        <Skeleton variant="rounded" width={60} height={20} />
        <Skeleton variant="rounded" width={50} height={20} />
      </Box>
    </Box>
  );
}

function TemplateCard({ template, onSelect, delay = 0 }) {
  const { t } = useTranslation();
  const plan = useSelector(selectUserPlan);
  const persona = useSelector(selectUserPersona);

  const requiredPlan = getPlanRequired(template);
  const isAlwaysFree = template.pricePayPerDoc === 0;
  const canAccess = isAlwaysFree || hasFeature(persona, plan, 'pdf_download') ||
    plan === requiredPlan || plan === 'pro';

  const complexity = COMPLEXITY_STYLES[template.complexity] || COMPLEXITY_STYLES.simple;
  const planStyle = PLAN_STYLES[requiredPlan] || PLAN_STYLES.free;
  const catIcon = CATEGORY_ICONS[template.category] || '📄';

  const TIME_MAP = { simple: '5–10 min', moderate: '10–20 min', complex: '20–40 min' };
  const estTime = TIME_MAP[template.complexity] || '10 min';

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.38, ease: 'easeOut' }}
      whileHover={canAccess ? { scale: 1.028, y: -3, transition: { duration: 0.18 } } : {}}
      whileTap={canAccess ? { scale: 0.98 } : {}}
      style={{ height: '100%' }}
    >
      <Box
        onClick={() => onSelect(template, canAccess)}
        sx={{
          height: '100%',
          p: 2.5,
          borderRadius: `${RADIUS.lg}px`,
          border: '1.5px solid var(--color-border)',
          background: 'var(--color-surface)',
          cursor: canAccess ? 'pointer' : 'default',
          display: 'flex', flexDirection: 'column', gap: 1,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': canAccess ? {
            borderColor: 'var(--color-primary)',
            boxShadow: SHADOWS.md,
          } : {},
        }}
      >
        {/* Always-free ribbon */}
        {isAlwaysFree && (
          <Box sx={{
            position: 'absolute', top: 10, right: -24,
            background: 'var(--color-success)', color: '#fff',
            fontSize: '0.6rem', fontWeight: 800,
            px: 3.5, py: 0.25, transform: 'rotate(30deg)',
            letterSpacing: '0.05em',
          }}>
            FREE
          </Box>
        )}

        {/* Category icon */}
        <Box sx={{
          width: 48, height: 48, borderRadius: `${RADIUS.md}px`,
          background: 'var(--color-primary-alpha)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, flexShrink: 0,
        }}>
          {catIcon}
        </Box>

        {/* Name */}
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.35, flex: 1 }}>
          {template.name}
        </Typography>

        {/* Estimated time */}
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
          ⏱ {estTime}
        </Typography>

        {/* Badges row */}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
          <Chip size="small" label={complexity.label}
            sx={{
              height: 19, fontSize: '0.67rem', fontWeight: 600,
              background: complexity.bg, color: complexity.color, border: 'none',
            }} />
          <Chip size="small" label={planStyle.label}
            sx={{
              height: 19, fontSize: '0.67rem', fontWeight: 600,
              background: planStyle.bg, color: planStyle.color, border: 'none',
            }} />
        </Box>

        {/* Locked overlay */}
        {!canAccess && (
          <Box sx={{
            position: 'absolute', inset: 0,
            borderRadius: `${RADIUS.lg}px`,
            background: 'rgba(var(--color-bg-rgb, 248,250,255), 0.7)',
            backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Typography sx={{ fontSize: 28 }}>🔒</Typography>
          </Box>
        )}
      </Box>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function NewDocument() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [gateTemplate, setGateTemplate] = useState(null);

  useEffect(() => {
    api.get('/templates').then(({ data }) => {
      setTemplates(data.templates || data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSelect = (template, canAccess) => {
    if (!canAccess) { setGateTemplate(template); return; }
    navigate(`/citizen/chat/${template.slug}`);
  };

  const filtered = useMemo(() => {
    let list = templates;
    if (activeCategory !== 'all') list = list.filter((t) => t.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.name?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q));
    }
    return list;
  }, [templates, activeCategory, search]);

  const featured = useMemo(() =>
    templates.filter((t) => t.isFeatured || t.pricePayPerDoc === 0).slice(0, 4),
  [templates]);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1100, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Typography variant="h4" sx={{
            fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 0.75,
          }}>
            {t('newDoc.title', 'Create a Legal Document')}
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
            {t('newDoc.subtitle', 'Choose a template and our AI will guide you step by step.')}
          </Typography>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
          <TextField
            fullWidth
            placeholder={t('newDoc.search', 'Search templates…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: <InputAdornment position="start">🔍</InputAdornment>,
            }}
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: `${RADIUS.full}px`,
                background: 'var(--color-surface)',
                '& fieldset': { borderColor: 'var(--color-border)' },
                '&:hover fieldset': { borderColor: 'var(--color-primary)' },
              },
            }}
          />
        </motion.div>

        {/* Category tabs */}
        <Box sx={{
          display: 'flex', gap: 1, mb: 3,
          overflowX: 'auto', pb: 0.5,
          '&::-webkit-scrollbar': { height: 3 },
          '&::-webkit-scrollbar-thumb': { background: 'var(--color-border)', borderRadius: 2 },
        }}>
          {CATEGORIES.map((cat, i) => (
            <motion.div key={cat.slug}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}>
              <Chip
                label={`${cat.icon} ${cat.label}`}
                onClick={() => setActiveCategory(cat.slug)}
                sx={{
                  cursor: 'pointer', fontWeight: 600, flexShrink: 0,
                  background: activeCategory === cat.slug ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: activeCategory === cat.slug ? '#fff' : 'var(--color-text-secondary)',
                  border: activeCategory === cat.slug ? 'none' : '1px solid var(--color-border)',
                  '&:hover': { background: activeCategory === cat.slug ? 'var(--color-primary)' : 'var(--color-overlay)' },
                }}
              />
            </motion.div>
          ))}
        </Box>

        {/* Featured section */}
        {!search && activeCategory === 'all' && featured.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{
              fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 2,
            }}>
              🌟 {t('newDoc.popular', 'Popular this week')}
            </Typography>
            <Grid container spacing={2}>
              {loading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Grid item xs={12} sm={6} md={3} key={i}>
                      <TemplateCardSkeleton />
                    </Grid>
                  ))
                : featured.map((tmpl, i) => (
                    <Grid item xs={12} sm={6} md={3} key={tmpl._id || tmpl.slug}>
                      <TemplateCard template={tmpl} onSelect={handleSelect} delay={i * 0.07} />
                    </Grid>
                  ))}
            </Grid>
          </Box>
        )}

        {/* All templates */}
        <Typography variant="h6" sx={{
          fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 2,
        }}>
          {activeCategory === 'all'
            ? t('newDoc.all_templates', 'All Templates')
            : `${CATEGORIES.find((c) => c.slug === activeCategory)?.icon} ${CATEGORIES.find((c) => c.slug === activeCategory)?.label}`}
          <Typography component="span" variant="caption" sx={{ ml: 1, color: 'var(--color-text-secondary)' }}>
            ({filtered.length})
          </Typography>
        </Typography>

        <Grid container spacing={2}>
          {loading
            ? Array.from({ length: 9 }).map((_, i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <TemplateCardSkeleton />
                </Grid>
              ))
            : filtered.length === 0
            ? (
              <Grid item xs={12}>
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <Typography sx={{ fontSize: 48, mb: 1 }}>🔍</Typography>
                  <Typography variant="body1" sx={{ color: 'var(--color-text-secondary)' }}>
                    {t('newDoc.no_results', 'No templates match your search.')}
                  </Typography>
                </Box>
              </Grid>
            )
            : filtered.map((tmpl, i) => (
                <Grid item xs={12} sm={6} md={4} key={tmpl._id || tmpl.slug}>
                  <TemplateCard template={tmpl} onSelect={handleSelect} delay={(i % 9) * 0.05} />
                </Grid>
              ))}
        </Grid>

        {/* Feature gate modal */}
        <AnimatePresence>
          {gateTemplate && (
            <motion.div
              key="gate-overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setGateTemplate(null)}
              style={{
                position: 'fixed', inset: 0, zIndex: 1300,
                background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', maxWidth: 420 }}
              >
                <FeatureGate feature="pdf_download"
                  featureLabel={gateTemplate.name}
                  description={`${gateTemplate.name} requires an upgraded plan. Upgrade to access this and ${templates.length - 2} more templates.`}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </AnimatedPage>
  );
}

export default NewDocument;

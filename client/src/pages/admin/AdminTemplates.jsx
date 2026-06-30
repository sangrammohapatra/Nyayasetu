import React, { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Skeleton from '@mui/material/Skeleton';
import Drawer from '@mui/material/Drawer';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import api from '../../services/api';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const CATEGORY_OPTIONS = ['consumer', 'property', 'employment', 'family', 'criminal', 'rti', 'civil', 'financial', 'labour', 'startup'];
const COMPLEXITY_OPTIONS = ['simple', 'moderate', 'complex', 'premium'];

const COMPLEXITY_COLORS = {
  simple: { bg: 'rgba(46,125,50,0.1)', color: '#2e7d32' },
  moderate: { bg: 'rgba(2,136,209,0.1)', color: '#0288d1' },
  complex: { bg: 'rgba(237,108,2,0.1)', color: '#ed6c02' },
  premium: { bg: 'rgba(106,27,154,0.1)', color: '#6a1b9a' },
};

const CATEGORY_ICONS = {
  consumer: '🛒', property: '🏠', employment: '💼', family: '👨‍👩‍👧',
  criminal: '⚖️', rti: '📑', civil: '🏛️', financial: '💰', labour: '👷', startup: '🚀',
};

const PLAN_ORDER = { free: 0, basic: 1, pro: 2, professional: 2, firm: 3 };
const PREVIEW_PLANS = ['free', 'basic', 'pro'];

const COMPLEXITY_CARD = {
  simple:   { label: 'Simple',   color: '#2e7d32', bg: 'rgba(46,125,50,0.1)'  },
  moderate: { label: 'Moderate', color: '#ed6c02', bg: 'rgba(230,81,0,0.1)'   },
  complex:  { label: 'Complex',  color: '#d32f2f', bg: 'rgba(198,40,40,0.1)'  },
  premium:  { label: 'Premium',  color: '#6a1b9a', bg: 'rgba(106,27,154,0.1)' },
};
const PLAN_BADGE = {
  free:  { label: '🆓 FREE',  bg: 'rgba(46,125,50,0.12)',  color: '#2e7d32' },
  basic: { label: '⭐ BASIC', bg: 'rgba(25,118,210,0.12)', color: '#1976d2' },
  pro:   { label: '🚀 PRO',   bg: 'rgba(230,81,0,0.12)',   color: '#ed6c02' },
};
const TIME_MAP = { simple: '5–10 min', moderate: '10–20 min', complex: '20–40 min', premium: '30–60 min' };

const INPUT_TYPE_LABELS = {
  text: 'Text', textarea: 'Paragraph', date: 'Date', number: 'Number',
  select: 'Select', multiselect: 'Multi-select', boolean: 'Yes/No', address: 'Address',
};

function getRequiredPlan(template) {
  if (template.pricePayPerDoc === 0) return 'free';
  const p = template.requiredPlan?.citizen;
  if (!p || p === 'free') return 'free';
  return p;
}

function canAccessWithPlan(template, plan) {
  if (template.isAlwaysFree) return true;
  const req = template.requiredPlan?.citizen || 'free';
  return (PLAN_ORDER[plan] ?? 0) >= (PLAN_ORDER[req] ?? 0);
}

/* ---------------------------------------------------------------------------
 * Citizen card replica
 * ------------------------------------------------------------------------ */
function CitizenCardReplica({ template, viewerPlan }) {
  const canAccess = canAccessWithPlan(template, viewerPlan);
  const isAlwaysFree = template.isAlwaysFree;
  const catIcon = CATEGORY_ICONS[template.category] || '📄';
  const requiredPlan = getRequiredPlan(template);
  const complexity = COMPLEXITY_CARD[template.complexity] || COMPLEXITY_CARD.simple;
  const planBadge = PLAN_BADGE[requiredPlan] || PLAN_BADGE.free;
  const estTime = TIME_MAP[template.complexity] || '10 min';

  return (
    <Box sx={{
      width: 220, p: 2.5, borderRadius: `${RADIUS.lg}px`,
      border: '1.5px solid var(--color-border)', background: 'var(--color-surface)',
      position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 1,
    }}>
      {isAlwaysFree && (
        <Box sx={{
          position: 'absolute', top: 10, right: -24,
          background: '#2e7d32', color: '#fff', fontSize: '0.6rem', fontWeight: 800,
          px: 3.5, py: 0.25, transform: 'rotate(30deg)', letterSpacing: '0.05em',
        }}>FREE</Box>
      )}
      <Box sx={{ width: 48, height: 48, borderRadius: `${RADIUS.md}px`, background: 'rgba(25,118,210,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
        {catIcon}
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.35, color: 'var(--color-text)', flex: 1 }}>
        {template.name}
      </Typography>
      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>⏱ {estTime}</Typography>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.5 }}>
        <Chip size="small" label={complexity.label} sx={{ height: 19, fontSize: '0.67rem', fontWeight: 600, background: complexity.bg, color: complexity.color, border: 'none' }} />
        <Chip size="small" label={planBadge.label} sx={{ height: 19, fontSize: '0.67rem', fontWeight: 600, background: planBadge.bg, color: planBadge.color, border: 'none' }} />
      </Box>
      {!canAccess && (
        <Box sx={{ position: 'absolute', inset: 0, borderRadius: `${RADIUS.lg}px`, background: 'rgba(248,250,255,0.75)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: 28 }}>🔒</Typography>
        </Box>
      )}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * Template preview modal — citizen card + question flow
 * ------------------------------------------------------------------------ */
function TemplatePreviewModal({ template, onClose }) {
  const [viewerPlan, setViewerPlan] = useState('free');
  if (!template) return null;

  const questions = [...(template.questionFlow || [])].sort((a, b) => a.order - b.order);
  const sections = [...new Set(questions.map((q) => q.section).filter(Boolean))];

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, background: 'var(--color-surface)' } }}>
      <DialogTitle sx={{ fontWeight: 700, pr: 6, fontFamily: TYPOGRAPHY.fontFamily.display }}>
        👁️ Preview: {template.name}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>✕</IconButton>
      </DialogTitle>
      <DialogContent>
        {/* Plan selector */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600, mr: 0.5 }}>Viewing as:</Typography>
          {PREVIEW_PLANS.map((p) => (
            <Chip key={p} label={p} size="small" onClick={() => setViewerPlan(p)}
              sx={{
                cursor: 'pointer', fontWeight: 700, textTransform: 'capitalize',
                background: viewerPlan === p ? 'var(--color-primary)' : 'transparent',
                color: viewerPlan === p ? '#fff' : 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                '&:hover': { background: viewerPlan === p ? 'var(--color-primary)' : 'var(--color-overlay)' },
              }}
            />
          ))}
        </Box>

        {/* Citizen card */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <CitizenCardReplica template={template} viewerPlan={viewerPlan} />
        </Box>

        <Divider sx={{ mb: 2, borderColor: 'var(--color-border)' }} />

        {/* Access matrix */}
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
          Access by Plan
        </Typography>
        <Box sx={{ mb: 2.5 }}>
          {PREVIEW_PLANS.map((p) => {
            const accessible = canAccessWithPlan(template, p);
            let label;
            if (template.isAlwaysFree)        label = { text: '✓ Always free', color: '#2e7d32' };
            else if (accessible)               label = { text: '✓ Subscription access', color: '#2e7d32' };
            else if (template.pricePayPerDoc > 0) label = { text: `💳 Pay ₹${template.pricePayPerDoc / 100}`, color: '#0288d1' };
            else                               label = { text: '✗ Locked', color: '#d32f2f' };
            return (
              <Box key={p} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75, borderBottom: '1px solid var(--color-border)' }}>
                <Typography variant="caption" sx={{ textTransform: 'capitalize', fontWeight: 600, color: 'var(--color-text)' }}>{p}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: label.color }}>{label.text}</Typography>
              </Box>
            );
          })}
        </Box>

        {/* Metadata */}
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
          Metadata
        </Typography>
        <Box sx={{ mb: 2.5 }}>
          {[
            ['Slug', template.slug],
            ['Category', template.category],
            ['Complexity', template.complexity],
            ['Version', `v${template.version || 1}`],
            ['Est. Time', TIME_MAP[template.complexity] || '—'],
            ['Price', template.isAlwaysFree ? 'Always Free' : template.pricePayPerDoc === 0 ? '₹0 (plan-gated)' : `₹${template.pricePayPerDoc / 100}`],
            ['Active', template.isActive ? 'Yes' : 'No'],
            ['Featured', template.isFeatured ? 'Yes' : 'No'],
          ].map(([label, value]) => (
            <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid var(--color-border)' }}>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>{label}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text)', fontWeight: 500, fontFamily: label === 'Slug' ? 'monospace' : undefined }}>{String(value)}</Typography>
            </Box>
          ))}
        </Box>

        {/* System prompt addendum */}
        {template.systemPromptAddendum && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, display: 'block' }}>
              AI System Prompt Addendum
            </Typography>
            <Box sx={{ p: 1.5, borderRadius: `${RADIUS.md}px`, background: 'var(--color-bg)', border: '1px solid var(--color-border)', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 140, overflow: 'auto', mb: 2.5 }}>
              {template.systemPromptAddendum}
            </Box>
          </>
        )}

        {/* Question flow */}
        {questions.length > 0 && (
          <>
            <Divider sx={{ mb: 2, borderColor: 'var(--color-border)' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5, display: 'block' }}>
              Question Flow ({questions.length} question{questions.length !== 1 ? 's' : ''})
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {questions.map((q, idx) => {
                const isNewSection = idx === 0 || questions[idx - 1]?.section !== q.section;
                return (
                  <Box key={q._id || q.key}>
                    {isNewSection && q.section && (
                      <Typography variant="overline" sx={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', fontWeight: 700, opacity: 0.7, display: 'block', mt: idx > 0 ? 1.5 : 0, mb: 0.5 }}>
                        {q.section}
                      </Typography>
                    )}
                    <Box sx={{ p: 1.25, borderRadius: `${RADIUS.md}px`, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--color-text-secondary)', minWidth: 20, lineHeight: 1.6 }}>{idx + 1}.</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'var(--color-text)', flex: 1, lineHeight: 1.5 }}>{q.questionText}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', pl: 3 }}>
                        <Chip label={INPUT_TYPE_LABELS[q.inputType] || q.inputType} size="small" sx={{ height: 18, fontSize: '0.63rem', fontWeight: 600, background: 'rgba(25,118,210,0.1)', color: '#1976d2', border: 'none' }} />
                        {q.isRequired
                          ? <Chip label="Required" size="small" sx={{ height: 18, fontSize: '0.63rem', fontWeight: 600, background: 'rgba(211,47,47,0.1)', color: '#d32f2f', border: 'none' }} />
                          : <Chip label="Optional" size="small" sx={{ height: 18, fontSize: '0.63rem', background: 'var(--color-border)', color: 'var(--color-text-secondary)', border: 'none' }} />}
                        {q.dependsOn?.key && (
                          <Chip label={`if ${q.dependsOn.key}`} size="small" sx={{ height: 18, fontSize: '0.63rem', background: 'rgba(230,81,0,0.1)', color: '#e65100', border: 'none' }} />
                        )}
                      </Box>
                      {(q.inputType === 'select' || q.inputType === 'multiselect') && q.options?.length > 0 && (
                        <Box sx={{ pl: 3, mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {q.options.map((opt) => (
                            <Chip key={opt} label={opt} size="small" sx={{ height: 16, fontSize: '0.6rem', background: 'var(--color-border)', color: 'var(--color-text-secondary)', border: 'none' }} />
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------------
 * Version history dialog
 * ------------------------------------------------------------------------ */
function HistoryDialog({ templateId, templateName, onClose, onRolledBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rollbackTarget, setRollbackTarget] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  useEffect(() => {
    if (!templateId) return;
    api.get(`/admin/templates/${templateId}/history`)
      .then(({ data: d }) => setData(d))
      .catch(() => setData({ history: [] }))
      .finally(() => setLoading(false));
  }, [templateId]);

  const handleRollback = async (version) => {
    setRolling(true);
    try {
      await api.post(`/admin/templates/${templateId}/rollback`, { version });
      setSnack({ open: true, msg: `Rolled back to v${version}. New version created.`, severity: 'success' });
      setRollbackTarget(null);
      onRolledBack();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Rollback failed.', severity: 'error' });
    } finally {
      setRolling(false);
    }
  };

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, background: 'var(--color-surface)' } }}>
        <DialogTitle sx={{ fontWeight: 700, pr: 6, fontFamily: TYPOGRAPHY.fontFamily.display }}>
          🕘 History: {templateName}
          {data && <Typography component="span" variant="caption" sx={{ ml: 1, color: 'var(--color-text-secondary)' }}>current v{data.version || 1}</Typography>}
          <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>✕</IconButton>
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={60} />)}
            </Box>
          ) : !data?.history?.length ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No previous versions — this template has not been edited yet.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {data.history.map((entry) => (
                <Box key={entry.version} sx={{ p: 1.5, borderRadius: `${RADIUS.md}px`, border: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={`v${entry.version}`} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: 'rgba(25,118,210,0.1)', color: '#1976d2' }} />
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                        {entry.updatedAt ? new Date(entry.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </Typography>
                    </Box>
                    <Button
                      size="small" variant="outlined"
                      disabled={rolling}
                      onClick={() => setRollbackTarget(entry.version)}
                      sx={{ fontSize: '0.68rem', py: 0.3, px: 1.2, borderRadius: `${RADIUS.md}px` }}
                    >
                      Restore
                    </Button>
                  </Box>
                  {entry.snapshot?.name && (
                    <Typography variant="caption" sx={{ color: 'var(--color-text)', fontWeight: 600, display: 'block', mt: 0.75 }}>
                      {entry.snapshot.name}
                    </Typography>
                  )}
                  {entry.snapshot?.complexity && (
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                      {entry.snapshot.complexity} · {entry.snapshot.isActive ? 'Active' : 'Inactive'}
                      {entry.snapshot.pricePayPerDoc > 0 ? ` · ₹${entry.snapshot.pricePayPerDoc / 100}` : ' · Free'}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Rollback confirm dialog */}
      <Dialog open={!!rollbackTarget} onClose={() => setRollbackTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Restore v{rollbackTarget}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
            The current template will be snapshotted as a new version before restoring. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ pb: 2, px: 3 }}>
          <Button onClick={() => setRollbackTarget(null)} disabled={rolling}>Cancel</Button>
          <Button variant="contained" color="error" disabled={rolling} onClick={() => handleRollback(rollbackTarget)}>
            {rolling ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Restore'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>{snack.msg}</Alert>
      </Snackbar>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Template edit/create form
 * ------------------------------------------------------------------------ */
const EMPTY_FORM = {
  name: '', slug: '', category: 'consumer', complexity: 'simple',
  estimatedMinutes: 10, pricePayPerDoc: 0,
  isAlwaysFree: false, isActive: true, isFeatured: false,
  systemPromptAddendum: '',
};

function TemplateForm({ template, onSave, onClose, saving }) {
  const isEdit = !!template?._id;
  const [form, setForm] = useState(isEdit ? {
    name: template.name || '',
    slug: template.slug || '',
    category: template.category || 'consumer',
    complexity: template.complexity || 'simple',
    estimatedMinutes: template.estimatedMinutes || 10,
    pricePayPerDoc: template.pricePayPerDoc || 0,
    isAlwaysFree: template.isAlwaysFree || false,
    isActive: template.isActive !== false,
    isFeatured: template.isFeatured || false,
    systemPromptAddendum: template.systemPromptAddendum || '',
  } : EMPTY_FORM);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } };

  return (
    <Box sx={{ width: { xs: '100vw', sm: 480 }, p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
          {isEdit ? 'Edit Template' : 'New Template'}
        </GradientHeading>
        <IconButton onClick={onClose} size="small">✕</IconButton>
      </Box>
      <Divider sx={{ borderColor: 'var(--color-border)' }} />

      <TextField size="small" label="Name" value={form.name} onChange={(e) => set('name', e.target.value)} sx={fieldSx} />
      <TextField size="small" label="Slug" value={form.slug} onChange={(e) => set('slug', e.target.value)}
        disabled={isEdit} helperText={isEdit ? 'Slug cannot be changed after creation' : 'e.g. consumer_complaint'} sx={fieldSx} />

      <Box sx={{ display: 'flex', gap: 2 }}>
        <FormControl size="small" fullWidth sx={fieldSx}>
          <InputLabel>Category</InputLabel>
          <Select label="Category" value={form.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORY_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" fullWidth sx={fieldSx}>
          <InputLabel>Complexity</InputLabel>
          <Select label="Complexity" value={form.complexity} onChange={(e) => set('complexity', e.target.value)}>
            {COMPLEXITY_OPTIONS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <TextField size="small" label="Est. Minutes" type="number" value={form.estimatedMinutes}
          onChange={(e) => set('estimatedMinutes', Number(e.target.value))} sx={{ ...fieldSx, flex: 1 }} />
        <TextField size="small" label="Price (paise)" type="number" value={form.pricePayPerDoc}
          onChange={(e) => set('pricePayPerDoc', Number(e.target.value))}
          helperText="0 = free. ₹99 = 9900" sx={{ ...fieldSx, flex: 1 }} />
      </Box>

      <TextField
        size="small" label="System Prompt Addendum" multiline rows={4}
        value={form.systemPromptAddendum}
        onChange={(e) => set('systemPromptAddendum', e.target.value)}
        sx={fieldSx}
        helperText="Additional AI instructions for document generation"
      />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        <FormControlLabel control={<Switch checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} size="small" />} label={<Typography variant="caption">Active</Typography>} />
        <FormControlLabel control={<Switch checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} size="small" />} label={<Typography variant="caption">Featured</Typography>} />
        <FormControlLabel control={<Switch checked={form.isAlwaysFree} onChange={(e) => set('isAlwaysFree', e.target.checked)} size="small" />} label={<Typography variant="caption">Always Free</Typography>} />
      </Box>

      <Button
        variant="contained" fullWidth disabled={saving || !form.name || !form.slug}
        onClick={() => onSave(form, template?._id)}
        sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)', py: 1.2 }}
      >
        {saving ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : isEdit ? 'Save Changes' : 'Create Template'}
      </Button>
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * Main page
 * ------------------------------------------------------------------------ */
export default function AdminTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null); // { id, name }
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    api.get('/admin/templates')
      .then(({ data }) => setTemplates(data.templates || data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filtered = templates.filter((t) =>
    !search || t.name?.toLowerCase().includes(search.toLowerCase()) || t.slug?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (form, id) => {
    setSaving(true);
    try {
      if (id) {
        await api.put(`/admin/templates/${id}`, form);
        setSnack({ open: true, msg: 'Template updated.', severity: 'success' });
      } else {
        await api.post('/admin/templates', form);
        setSnack({ open: true, msg: 'Template created.', severity: 'success' });
      }
      setDrawerOpen(false);
      setEditTarget(null);
      fetchTemplates();
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Save failed.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => { setEditTarget(null); setDrawerOpen(true); };
  const openEdit = (t) => { setEditTarget(t); setDrawerOpen(true); };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
            📋 Templates
          </GradientHeading>
          <Button variant="contained" size="small" onClick={openCreate}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
            + New Template
          </Button>
        </Box>

        <GlassCard sx={{ p: 2, mb: 2 }}>
          <TextField size="small" placeholder="Search templates…" fullWidth
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
        </GlassCard>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <GlassCard sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 700, color: 'var(--color-text-secondary)', fontSize: '0.75rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' } }}>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Complexity</TableCell>
                  <TableCell>Price</TableCell>
                  <TableCell>Ver.</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton variant="text" height={20} /></TableCell>)}
                      </TableRow>
                    ))
                  : filtered.map((t) => {
                      const cc = COMPLEXITY_COLORS[t.complexity] || COMPLEXITY_COLORS.simple;
                      return (
                        <TableRow key={t._id} sx={{ '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontSize: 18 }}>{CATEGORY_ICONS[t.category] || '📄'}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{t.name}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'var(--color-text-secondary)' }}>{t.slug}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', textTransform: 'capitalize' }}>{t.category}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={t.complexity} size="small" sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: cc.bg, color: cc.color }} />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                              {t.isAlwaysFree ? 'Free' : t.pricePayPerDoc === 0 ? '₹0' : `₹${t.pricePayPerDoc / 100}`}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                              v{t.version || 1}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {t.isActive
                                ? <Chip label="Active" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, background: 'rgba(46,125,50,0.1)', color: '#2e7d32' }} />
                                : <Chip label="Inactive" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, background: 'rgba(211,47,47,0.1)', color: '#d32f2f' }} />}
                              {t.isFeatured && <Chip label="Featured" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, background: 'rgba(2,136,209,0.1)', color: '#0288d1' }} />}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'flex-end' }}>
                              <Button size="small" variant="outlined" onClick={() => setPreviewTemplate(t)}
                                sx={{ fontSize: '0.7rem', py: 0.3, px: 1.2, borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}>
                                Preview
                              </Button>
                              <Button size="small" variant="outlined" onClick={() => setHistoryTarget({ id: t._id, name: t.name })}
                                sx={{ fontSize: '0.7rem', py: 0.3, px: 1.2, borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                                History
                              </Button>
                              <Button size="small" variant="outlined" onClick={() => openEdit(t)}
                                sx={{ fontSize: '0.7rem', py: 0.3, px: 1.2, borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                                Edit
                              </Button>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No templates found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </GlassCard>
      </Box>

      {/* Edit / create drawer */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
        PaperProps={{ sx: { background: 'var(--color-surface)' } }}>
        <TemplateForm
          template={editTarget}
          onSave={handleSave}
          onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
          saving={saving}
        />
      </Drawer>

      {/* Citizen preview modal */}
      <TemplatePreviewModal template={previewTemplate} onClose={() => setPreviewTemplate(null)} />

      {/* Version history dialog */}
      {historyTarget && (
        <HistoryDialog
          templateId={historyTarget.id}
          templateName={historyTarget.name}
          onClose={() => setHistoryTarget(null)}
          onRolledBack={() => { setHistoryTarget(null); fetchTemplates(); setSnack({ open: true, msg: 'Template restored.', severity: 'success' }); }}
        />
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}

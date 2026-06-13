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

  const fieldSx = {
    '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` },
  };

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

export default function AdminTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
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
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Edit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton variant="text" height={20} /></TableCell>)}
                      </TableRow>
                    ))
                  : filtered.map((t) => {
                      const cc = COMPLEXITY_COLORS[t.complexity] || COMPLEXITY_COLORS.simple;
                      return (
                        <TableRow key={t._id} sx={{ '& td': { borderBottom: '1px solid var(--color-border)', py: 1 } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography sx={{ fontSize: 18 }}>{t.icon || '📄'}</Typography>
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
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {t.isActive
                                ? <Chip label="Active" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, background: 'rgba(46,125,50,0.1)', color: '#2e7d32' }} />
                                : <Chip label="Inactive" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, background: 'rgba(211,47,47,0.1)', color: '#d32f2f' }} />}
                              {t.isFeatured && <Chip label="Featured" size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, background: 'rgba(2,136,209,0.1)', color: '#0288d1' }} />}
                            </Box>
                          </TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="outlined" onClick={() => openEdit(t)}
                              sx={{ fontSize: '0.7rem', py: 0.3, px: 1.2, borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                {!loading && filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No templates found</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </GlassCard>
      </Box>

      <Drawer anchor="right" open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
        PaperProps={{ sx: { background: 'var(--color-surface)' } }}>
        <TemplateForm
          template={editTarget}
          onSave={handleSave}
          onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
          saving={saving}
        />
      </Drawer>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </AnimatedPage>
  );
}

/**
 * client/src/pages/lawyer/CaseManagement.jsx
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

import { fetchMyClients, selectClients, selectLawyerLoading } from '../../store/slices/lawyerSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import HearingTimeline from '../../components/case/HearingTimeline';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';
import api from '../../services/api';

function CaseCard({ caseData, clientName, delay }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState(false);

  const isUrgent = caseData.nextHearingDate && (() => {
    const days = Math.ceil((new Date(caseData.nextHearingDate) - new Date()) / 86400000);
    return days >= 0 && days <= 7;
  })();

  const handleSaveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/cases/${caseData._id}/alerts`, { notes: note });
      setSnack(true);
      setNote('');
      setNotesOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <Box sx={{
        borderRadius: `${RADIUS.xl}px`,
        border: isUrgent ? '1.5px solid var(--color-warning)' : '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
        boxShadow: SHADOWS.sm,
        mb: 2,
      }}>
        {isUrgent && <Box sx={{ height: 3, background: 'linear-gradient(90deg, var(--color-warning), var(--color-error))' }} />}

        <Box sx={{ p: 2.5, cursor: 'pointer' }} onClick={() => setExpanded((v) => !v)}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box sx={{ flex: 1, pr: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                {caseData.caseTitle || caseData.cnrNumber}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                {clientName && `👤 ${clientName} · `}
                🏛️ {caseData.court || 'Court not specified'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
              {isUrgent && <Chip size="small" label="⚠️ Soon" sx={{ height: 20, fontSize: '0.65rem', background: 'var(--color-warning)', color: '#fff', fontWeight: 700 }} />}
              <Chip size="small" label={caseData.status || 'Active'} sx={{ height: 20, fontSize: '0.65rem', background: 'rgba(46,125,50,0.1)', color: 'var(--color-success)', fontWeight: 600 }} />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: '0.75rem', letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
              {caseData.cnrNumber}
            </Typography>
            {caseData.nextHearingDate && (
              <Typography variant="caption" sx={{ color: isUrgent ? 'var(--color-warning)' : 'var(--color-primary)', fontWeight: 700 }}>
                📅 {new Date(caseData.nextHearingDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            <Button size="small" variant="text" onClick={(e) => { e.stopPropagation(); setNotesOpen((v) => !v); }}
              sx={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 600, py: 0.25 }}>
              📝 {t('case.add_note', 'Add Note')}
            </Button>
            <Typography sx={{ fontSize: 14, color: 'var(--color-text-secondary)', ml: 'auto', mt: 0.25, transition: 'transform 0.25s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▾</Typography>
          </Box>
        </Box>

        {/* Notes input */}
        <Collapse in={notesOpen}>
          <Box sx={{ px: 2.5, pb: 2, borderTop: '1px solid var(--color-border)', pt: 1.75 }} onClick={(e) => e.stopPropagation()}>
            <TextField
              fullWidth
              multiline
              rows={2}
              size="small"
              placeholder={t('case.note_placeholder', 'Add a note about this case…')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              sx={{ mb: 1, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px`, background: 'var(--color-bg)' } }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="contained" onClick={handleSaveNote} disabled={saving || !note.trim()}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)', fontSize: '0.75rem' }}>
                {saving ? '…' : t('case.save_note', 'Save')}
              </Button>
              <Button size="small" onClick={() => { setNotesOpen(false); setNote(''); }}
                sx={{ borderRadius: `${RADIUS.md}px`, color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </Box>
          </Box>
        </Collapse>

        {/* Timeline */}
        <Collapse in={expanded}>
          <Box sx={{ px: 2.5, pb: 2.5, pt: 1.5, borderTop: '1px solid var(--color-border)' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', mb: 1.5 }}>
              {t('case.timeline', 'Hearing Timeline')}
            </Typography>
            <HearingTimeline hearings={caseData.hearings || []} />
          </Box>
        </Collapse>
      </Box>

      <Snackbar open={snack} autoHideDuration={2500} onClose={() => setSnack(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" sx={{ borderRadius: 2 }}>Note saved!</Alert>
      </Snackbar>
    </motion.div>
  );
}

function CaseManagement() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const prefersReducedMotion = useReducedMotion();
  const clients = useSelector(selectClients);
  const loading = useSelector(selectLawyerLoading);
  const [search, setSearch] = useState('');

  useEffect(() => { dispatch(fetchMyClients()); }, [dispatch]);

  const allCases = clients.flatMap((c) =>
    (c.sharedCases || []).map((cs) => ({ ...cs, clientName: c.user?.name }))
  );

  const filtered = allCases.filter((cs) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (cs.caseTitle || '').toLowerCase().includes(q) ||
      (cs.cnrNumber || '').toLowerCase().includes(q) ||
      (cs.clientName || '').toLowerCase().includes(q);
  });

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 900, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <GradientHeading variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 0.5 }}>
            {t('case.management_title', 'Case Management')}
          </GradientHeading>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
            {filtered.length} {t('case.cases', 'cases shared with you')}
          </Typography>
        </motion.div>

        <TextField
          fullWidth placeholder={t('case.search_placeholder', 'Search by case title, CNR or client…')}
          value={search} onChange={(e) => setSearch(e.target.value)} size="small"
          InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.full}px`, background: 'var(--color-surface)', '& fieldset': { borderColor: 'var(--color-border)' } },
          }}
        />

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={110} sx={{ borderRadius: `${RADIUS.xl}px`, mb: 2 }} />
          ))
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography sx={{ fontSize: 52, mb: 2 }}>⚖️</Typography>
            <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 1 }}>
              {search ? t('case.no_match', 'No cases match') : t('case.empty', 'No cases yet')}
            </GradientHeading>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
              {t('case.cases_mgmt_empty_desc', 'Cases will appear here once clients share them with you.')}
            </Typography>
          </Box>
        ) : (
          <AnimatePresence>
            {filtered.map((cs, i) => (
              <CaseCard key={cs._id || i} caseData={cs} clientName={cs.clientName} delay={i * 0.06} />
            ))}
          </AnimatePresence>
        )}
      </Box>
    </AnimatedPage>
  );
}

export default CaseManagement;

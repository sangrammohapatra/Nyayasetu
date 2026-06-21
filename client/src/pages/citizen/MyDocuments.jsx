/**
 * client/src/pages/citizen/MyDocuments.jsx
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

import {
  listDocuments, deleteDocument, shareDocument, getPDF,
  selectDocuments,
} from '../../store/slices/documentSlice';
import { selectUserPlan } from '../../store/slices/authSlice';
import { useOfflineDocuments } from '../../hooks/useOfflineDocuments';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GradientHeading from '../../components/ui/GradientHeading';
import DocumentCard, { DocumentCardSkeleton, CATEGORY_ICONS } from '../../components/document/DocumentCard';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

const PAGE_SIZE = 10;

/* ---------------------------------------------------------------------------
 * Empty state SVG illustration
 * ------------------------------------------------------------------------ */
function EmptyState({ onCreateNew }) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
        <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg"
          style={{ width: 180, maxWidth: '60vw', marginBottom: 24 }}>
          {/* Papers stack */}
          <rect x="40" y="50" width="90" height="110" rx="6" fill="var(--color-border)" opacity="0.4" />
          <rect x="50" y="40" width="90" height="110" rx="6" fill="var(--color-border)" opacity="0.6" />
          <rect x="60" y="30" width="90" height="110" rx="6" fill="var(--color-surface)"
            stroke="var(--color-border)" strokeWidth="1.5" />
          {/* Lines on paper */}
          {[55, 65, 75, 85, 95].map((y) => (
            <rect key={y} x="75" y={y} width={y === 55 ? 55 : 45} height="4" rx="2" fill="var(--color-border)" />
          ))}
          {/* + icon */}
          <circle cx="155" cy="35" r="20" fill="var(--color-primary)" opacity="0.9" />
          <path d="M155 27v16M147 35h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 1 }}>
          {t('myDocs.empty_title', 'No documents yet')}
        </GradientHeading>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3, maxWidth: 300, mx: 'auto' }}>
          {t('myDocs.empty_desc', 'Create your first legal document. Our AI will guide you every step of the way.')}
        </Typography>
        <Button variant="contained" onClick={onCreateNew}
          sx={{
            borderRadius: `${RADIUS.md}px`, fontWeight: 700,
            background: 'var(--color-primary)',
            '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
          }}>
          {t('myDocs.create_first', '+ Create Your First Document')}
        </Button>
      </Box>
    </motion.div>
  );
}

/* ---------------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------------ */
function MyDocuments() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const plan = useSelector(selectUserPlan);
  const allDocuments = useSelector(selectDocuments);
  const { isPinned } = useOfflineDocuments();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const observerRef = useRef(null);
  const sentinelRef = useRef(null);

  // Initial load
  useEffect(() => {
    loadPage(1, true);
  }, [categoryFilter, statusFilter]);

  const loadPage = useCallback(async (p, reset = false) => {
    setLoading(true);
    try {
      const result = await dispatch(listDocuments({ page: p, limit: PAGE_SIZE }));
      const total = result.payload?.total || 0;
      const fetched = (result.payload?.documents || result.payload?.items || []).length;
      setHasMore(p * PAGE_SIZE < total);
      if (!reset) setPage(p);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loading) {
          const next = page + 1;
          setPage(next);
          loadPage(next);
        }
      },
      { threshold: 0.1 }
    );
    observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, page, loadPage]);

  const filtered = allDocuments.filter((d) => {
    const matchSearch = !search || d.title?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || (d.template?.category || d.category) === categoryFilter;
    const matchStatus = !statusFilter || d.status === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });

  const handleView = (id) => navigate(`/citizen/documents/${id}`);

  const handleDownload = async (doc) => {
    const isPaid = doc.isPaid || plan === 'basic' || plan === 'pro';
    if (!isPaid) { navigate(`/citizen/documents/${doc._id}`); return; }
    try {
      const result = await dispatch(getPDF(doc._id));
      if (result.payload?.pdfUrl) window.open(result.payload.pdfUrl, '_blank');
    } catch (_) {}
  };

  const handleShare = async (id) => {
    const result = await dispatch(shareDocument(id));
    if (result.error) {
      setSnack({ open: true, msg: result.payload || 'Failed to share document.', severity: 'error' });
      return;
    }
    if (result.payload?.shareUrl) {
      navigator.clipboard.writeText(result.payload.shareUrl).catch(() => {});
      setSnack({ open: true, msg: 'Share link copied!', severity: 'success' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await dispatch(deleteDocument(deleteTarget._id));
    setDeleteTarget(null);
    setSnack({ open: true, msg: 'Document deleted.', severity: 'info' });
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 900, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        {/* Header */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box>
              <GradientHeading variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
                {t('myDocs.title', 'My Documents')}
              </GradientHeading>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.25 }}>
                {filtered.length} {t('myDocs.count', 'documents')}
              </Typography>
            </Box>
            <Button variant="contained" onClick={() => navigate('/citizen/documents/new')}
              sx={{
                borderRadius: `${RADIUS.md}px`, fontWeight: 700,
                background: 'var(--color-primary)',
                '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
              }}>
              + {t('myDocs.new', 'New')}
            </Button>
          </Box>
        </motion.div>

        {/* Filters */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
            <TextField
              placeholder={t('myDocs.search_placeholder', 'Search documents…')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{
                flex: 1, minWidth: 180,
                '& .MuiOutlinedInput-root': {
                  borderRadius: `${RADIUS.full}px`,
                  '& fieldset': { borderColor: 'var(--color-border)' },
                },
              }}
              InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }}
            />

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>{t('myDocs.category', 'Category')}</InputLabel>
              <Select value={categoryFilter} label={t('myDocs.category', 'Category')}
                onChange={(e) => setCategoryFilter(e.target.value)}
                sx={{ borderRadius: `${RADIUS.md}px`, '& fieldset': { borderColor: 'var(--color-border)' } }}>
                <MenuItem value="">{t('myDocs.all', 'All')}</MenuItem>
                {Object.keys(CATEGORY_ICONS).map((cat) => (
                  <MenuItem key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: '0.8rem' }}>{t('myDocs.status', 'Status')}</InputLabel>
              <Select value={statusFilter} label={t('myDocs.status', 'Status')}
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ borderRadius: `${RADIUS.md}px`, '& fieldset': { borderColor: 'var(--color-border)' } }}>
                <MenuItem value="">{t('myDocs.all', 'All')}</MenuItem>
                <MenuItem value="completed">Ready</MenuItem>
                <MenuItem value="generating">Generating</MenuItem>
                <MenuItem value="active">Draft</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </motion.div>

        {/* Document list */}
        <AnimatePresence mode="popLayout">
          {loading && filtered.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Array.from({ length: 5 }).map((_, i) => <DocumentCardSkeleton key={i} />)}
            </Box>
          ) : filtered.length === 0 ? (
            <EmptyState key="empty" onCreateNew={() => navigate('/citizen/documents/new')} />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {filtered.map((doc, i) => (
                <DocumentCard
                  key={doc._id}
                  doc={doc}
                  plan={plan}
                  delay={(i % PAGE_SIZE) * 0.04}
                  onView={handleView}
                  onDownload={handleDownload}
                  onShare={handleShare}
                  onDelete={setDeleteTarget}
                  offlineSaved={isPinned(doc._id)}
                />
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} style={{ height: 1 }} />

              {loading && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {Array.from({ length: 3 }).map((_, i) => <DocumentCardSkeleton key={i} />)}
                </Box>
              )}

              {!hasMore && filtered.length > PAGE_SIZE && (
                <Typography variant="caption" sx={{ textAlign: 'center', color: 'var(--color-text-secondary)', py: 2, display: 'block' }}>
                  {t('myDocs.all_loaded', 'All documents loaded')}
                </Typography>
              )}
            </Box>
          )}
        </AnimatePresence>

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
          PaperProps={{ sx: { borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' } }}>
          <DialogTitle sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)' }}>
            {t('myDocs.delete_title', 'Delete Document?')}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
              {t('myDocs.delete_confirm', 'This action cannot be undone. The document and its PDF will be permanently deleted.')}
            </Typography>
            {deleteTarget && (
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: `${RADIUS.md}px`, background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>
                  {deleteTarget.title}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button onClick={() => setDeleteTarget(null)} variant="outlined"
              sx={{ borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
              {t('myDocs.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleDeleteConfirm} variant="contained"
              sx={{ borderRadius: `${RADIUS.md}px`, background: 'var(--color-error)', fontWeight: 700,
                '&:hover': { background: 'var(--color-error)' } }}>
              {t('myDocs.delete', 'Delete')}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snack.open} autoHideDuration={3500}
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}
            sx={{ borderRadius: 2 }}>
            {snack.msg}
          </Alert>
        </Snackbar>
      </Box>
    </AnimatedPage>
  );
}

export default MyDocuments;

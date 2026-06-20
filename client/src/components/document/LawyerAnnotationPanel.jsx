/**
 * client/src/components/document/LawyerAnnotationPanel.jsx
 *
 * Shown to lawyers when reviewing a client document.
 * Allows:
 *   - Viewing & adding inline annotations
 *   - Submitting an edited version of the full document
 *   - Advancing the approval status (under_review → lawyer_reviewed)
 */

import React, { useState } from 'react';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import api from '../../services/api';
import { RADIUS } from '../../theme/tokens';

// ─── Status display ───────────────────────────────────────────────────────────

const STATUS_META = {
  draft:              { label: 'Draft',               bg: 'rgba(117,117,117,0.12)', color: '#757575' },
  shared_with_lawyer: { label: 'Shared with You',     bg: 'rgba(237,108,2,0.12)',   color: '#ed6c02' },
  under_review:       { label: 'Under Review',        bg: 'rgba(2,136,209,0.12)',   color: '#0288d1' },
  lawyer_reviewed:    { label: 'Reviewed',            bg: 'rgba(46,125,50,0.12)',   color: '#2e7d32' },
  finalized:          { label: 'Finalized by Client', bg: 'rgba(46,125,50,0.18)',   color: '#1b5e20' },
};

// ─── Approval status button label map ────────────────────────────────────────

const NEXT_STATUS = {
  shared_with_lawyer: { next: 'under_review',    label: 'Start Review' },
  under_review:       { next: 'lawyer_reviewed', label: 'Mark as Reviewed' },
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function LawyerAnnotationPanel({ document: doc, onDocumentUpdated }) {
  const [tab, setTab] = useState(0); // 0=Annotations, 1=Edit Document
  const [note, setNote] = useState('');
  const [editedContent, setEditedContent] = useState(doc?.lawyerEditedContent || doc?.content || '');
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  if (!doc) return null;

  const statusMeta = STATUS_META[doc.approvalStatus] || STATUS_META.draft;
  const nextStep   = NEXT_STATUS[doc.approvalStatus];
  const annotations = doc.lawyerAnnotations || [];

  const notify = (msg, severity = 'success') => setSnack({ open: true, msg, severity });

  // ── Add annotation ────────────────────────────────────────────────────────

  const handleAddAnnotation = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/documents/${doc._id}/annotations`, { note: note.trim() });
      notify('Annotation added');
      setNote('');
      onDocumentUpdated?.({ ...doc, lawyerAnnotations: [...annotations, data.annotation], approvalStatus: data.approvalStatus });
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to add annotation', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Save edited content ───────────────────────────────────────────────────

  const handleSaveEdit = async () => {
    if (!editedContent.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/documents/${doc._id}/lawyer-edit`, { content: editedContent });
      notify('Edited version saved');
      onDocumentUpdated?.({ ...doc, lawyerEditedContent: editedContent });
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to save edit', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Advance approval status ───────────────────────────────────────────────

  const handleAdvanceStatus = async () => {
    if (!nextStep) return;
    setSaving(true);
    try {
      await api.patch(`/documents/${doc._id}/approval-status`, { status: nextStep.next });
      notify(`Document marked as "${STATUS_META[nextStep.next]?.label}"`);
      onDocumentUpdated?.({ ...doc, approvalStatus: nextStep.next });
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to update status', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Status header */}
      <Box sx={{
        p: 2, borderRadius: `${RADIUS.xl}px`,
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap',
      }}>
        <Box>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 0.25 }}>
            Review Status
          </Typography>
          <Chip
            label={statusMeta.label}
            size="small"
            sx={{ fontWeight: 700, background: statusMeta.bg, color: statusMeta.color, height: 24 }}
          />
        </Box>
        {nextStep && (
          <Button
            variant="contained" size="small" onClick={handleAdvanceStatus} disabled={saving}
            sx={{
              fontWeight: 700, fontSize: '0.78rem',
              borderRadius: `${RADIUS.md}px`,
              background: 'var(--color-primary)',
              '&:hover': { background: 'var(--color-primary)' },
            }}
          >
            {saving ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : `✓ ${nextStep.label}`}
          </Button>
        )}
        {doc.approvalStatus === 'lawyer_reviewed' && (
          <Chip label="Awaiting client finalization" size="small"
            sx={{ fontWeight: 600, fontSize: '0.7rem', background: 'rgba(2,136,209,0.1)', color: '#0288d1' }} />
        )}
      </Box>

      {/* Tabs: Annotations | Edit */}
      <Box sx={{ borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', overflow: 'hidden' }}>
        <Tabs
          value={tab} onChange={(_, v) => setTab(v)}
          sx={{
            borderBottom: '1px solid var(--color-border)', px: 1,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', minHeight: 40, color: 'var(--color-text-secondary)' },
            '& .Mui-selected': { color: 'var(--color-primary) !important' },
            '& .MuiTabs-indicator': { background: 'var(--color-primary)' },
          }}
        >
          <Tab label={`📝 Annotations (${annotations.length})`} />
          <Tab label="✏️ Edit Document" />
        </Tabs>

        <Box sx={{ p: 2 }}>
          {tab === 0 && (
            <>
              {/* Existing annotations */}
              {annotations.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  {annotations.map((ann, i) => (
                    <Box key={ann._id || i} sx={{
                      p: 1.5, mb: 1, borderRadius: `${RADIUS.md}px`,
                      border: '1px solid var(--color-border)',
                      background: 'rgba(237,108,2,0.04)',
                      borderLeft: '3px solid #ed6c02',
                    }}>
                      {ann.clauseText && (
                        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 0.5, fontStyle: 'italic' }}>
                          Re: "{ann.clauseText.slice(0, 80)}…"
                        </Typography>
                      )}
                      <Typography variant="body2" sx={{ color: 'var(--color-text)', lineHeight: 1.55 }}>
                        {ann.note}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mt: 0.5 }}>
                        {ann.lawyerName} · {ann.createdAt ? new Date(ann.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* Add annotation form */}
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text)', display: 'block', mb: 0.75 }}>
                Add Note / Annotation
              </Typography>
              <TextField
                fullWidth multiline rows={3} size="small"
                placeholder="Add a note or feedback for the client…"
                value={note} onChange={(e) => setNote(e.target.value)}
                sx={{
                  mb: 1,
                  '& .MuiOutlinedInput-root': {
                    background: 'var(--color-bg)',
                    '& fieldset': { borderColor: 'var(--color-border)' },
                  },
                  '& .MuiInputBase-input': { color: 'var(--color-text)', fontSize: '0.875rem' },
                }}
              />
              <Button
                fullWidth variant="outlined" size="small"
                onClick={handleAddAnnotation} disabled={!note.trim() || saving}
                sx={{
                  fontWeight: 600, borderRadius: `${RADIUS.md}px`,
                  borderColor: 'var(--color-primary)', color: 'var(--color-primary)',
                  '&:hover': { background: 'var(--color-primary-alpha)' },
                }}
              >
                {saving ? <CircularProgress size={16} /> : '📎 Save Annotation'}
              </Button>
            </>
          )}

          {tab === 1 && (
            <>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 1, lineHeight: 1.5 }}>
                Edit the document content below. Your changes will be saved as a separate lawyer-edited version — the original draft is preserved.
              </Typography>
              <TextField
                fullWidth multiline rows={14} size="small"
                value={editedContent} onChange={(e) => setEditedContent(e.target.value)}
                sx={{
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': {
                    background: 'var(--color-bg)',
                    fontFamily: 'monospace',
                    fontSize: '0.82rem',
                    '& fieldset': { borderColor: 'var(--color-border)' },
                  },
                  '& .MuiInputBase-input': { color: 'var(--color-text)' },
                }}
              />
              <Button
                fullWidth variant="contained" size="small"
                onClick={handleSaveEdit} disabled={!editedContent.trim() || saving}
                sx={{
                  fontWeight: 700, borderRadius: `${RADIUS.md}px`,
                  background: 'var(--color-primary)',
                }}
              >
                {saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : '💾 Save Edited Version'}
              </Button>
              {doc.lawyerEditedAt && (
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mt: 1, textAlign: 'center' }}>
                  Last saved {new Date(doc.lawyerEditedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))} sx={{ borderRadius: 2 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

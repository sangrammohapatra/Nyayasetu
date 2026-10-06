import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Link from '@mui/material/Link';

import { RADIUS } from '../../theme/tokens';

function DocumentPreview({ label, url }) {
  const [failed, setFailed] = useState(false);
  const looksPdf = /\.pdf(\?|$)/i.test(url || '');

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>
        {label}
      </Typography>
      {url && !looksPdf && !failed && (
        <Box
          component="img"
          src={url}
          alt={label}
          onError={() => setFailed(true)}
          sx={{
            display: 'block',
            mt: 1,
            maxWidth: '100%',
            maxHeight: 320,
            borderRadius: `${RADIUS.md}px`,
            border: '1px solid var(--color-border)',
            objectFit: 'contain',
            background: 'var(--color-bg)',
          }}
        />
      )}
      {url ? (
        <Link href={url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-block', mt: 1, fontSize: '0.8rem' }}>
          Open document
        </Link>
      ) : (
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.5 }}>
          Not uploaded
        </Typography>
      )}
    </Box>
  );
}

function Field({ label, value }) {
  const text = value == null || value === '' ? '—' : value;
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 700, display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--color-text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {text}
      </Typography>
    </Box>
  );
}

/**
 * Full application the admin reads before approving or rejecting.
 * sections: [{ title, items: [{ label, value }] }]
 * documents: [{ label, url }]
 */
export default function ApplicationReviewDialog({
  open,
  onClose,
  name,
  status,
  submittedAt,
  sections = [],
  documents = [],
  priorRejection,
  canVerify,
  canReject,
  canReset,
  busy,
  onApprove,
  onReject,
  onReset,
}) {
  const [reason, setReason] = useState('');

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pr: 3 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{name || 'Application'}</Typography>
          {submittedAt && (
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
              Submitted {submittedAt}
            </Typography>
          )}
        </Box>
        {status && (
          <Chip
            label={status.label}
            size="small"
            sx={{ fontWeight: 700, background: status.bg, color: status.color }}
          />
        )}
      </DialogTitle>
      <DialogContent dividers sx={{ background: 'var(--color-bg)' }}>
        {sections.map((section) => (
          <Box key={section.title} sx={{ mb: 3 }}>
            <Typography variant="overline" sx={{ color: 'var(--color-text-secondary)', letterSpacing: '0.08em' }}>
              {section.title}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.5,
                mt: 1,
              }}
            >
              {section.items.map((item) => (
                <Box key={item.label} sx={{ gridColumn: item.full ? '1 / -1' : undefined }}>
                  <Field label={item.label} value={item.value} />
                </Box>
              ))}
            </Box>
          </Box>
        ))}

        <Typography variant="overline" sx={{ color: 'var(--color-text-secondary)', letterSpacing: '0.08em' }}>
          Documents
        </Typography>
        <Box sx={{ mt: 1 }}>
          {documents.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>No documents uploaded</Typography>
          ) : (
            documents.map((doc) => <DocumentPreview key={doc.label} label={doc.label} url={doc.url} />)
          )}
        </Box>

        {priorRejection && (
          <Box sx={{ mt: 1 }}>
            <Field label="Previous rejection reason" value={priorRejection} />
          </Box>
        )}

        {canReject && (
          <TextField
            fullWidth
            multiline
            minRows={2}
            label="Rejection reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            sx={{ mt: 2 }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={handleClose} sx={{ mr: 'auto' }}>Close</Button>
        {canReset && (
          <Button variant="outlined" disabled={busy} onClick={onReset}>
            {busy ? <CircularProgress size={16} /> : 'Reset to pending'}
          </Button>
        )}
        {canReject && (
          <Button variant="outlined" color="error" disabled={busy} onClick={() => onReject(reason.trim())}>
            Reject
          </Button>
        )}
        {canVerify && (
          <Button variant="contained" disabled={busy} onClick={onApprove} sx={{ background: 'var(--color-primary)' }}>
            {busy ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Approve'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

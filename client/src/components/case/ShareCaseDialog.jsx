import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';

import api from '../../services/api';
import { useGate } from '../../hooks/useFeatureAccess';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';

function lawyerLabel(lawyer) {
  const specs = (lawyer.specialisations || []).slice(0, 2).join(' · ');
  return specs || '';
}

export default function ShareCaseDialog({ open, caseData, onClose, onShared }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { allowed } = useGate('case_share_lawyer');
  const [query, setQuery] = useState('');
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sharingId, setSharingId] = useState(null);
  const [error, setError] = useState('');

  const sharedRef = caseData?.sharedWithLawyer;
  const sharedName = sharedRef && typeof sharedRef === 'object' ? sharedRef.name : '';
  const sharedId = sharedRef && typeof sharedRef === 'object' ? sharedRef._id : sharedRef;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setError('');
      setSharingId(null);
      setLawyers([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !allowed) return undefined;
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/lawyers', {
          params: { q: query.trim() || undefined, limit: 8, page: 1 },
        });
        if (!cancelled) setLawyers(data.items || []);
      } catch (err) {
        if (!cancelled) {
          setLawyers([]);
          setError(err.response?.data?.message || t('case.share_search_error', 'Could not load lawyers.'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [open, allowed, query, t]);

  const share = async (lawyer) => {
    if (!caseData?._id || !lawyer.userId) return;
    setSharingId(lawyer.userId);
    setError('');
    try {
      const { data } = await api.post(`/cases/${caseData._id}/share-lawyer`, {
        lawyerId: lawyer.userId,
      });
      onShared?.(data.lawyerName || lawyer.name);
    } catch (err) {
      setError(err.response?.data?.message || t('case.share_error', 'Could not share this case. Please try again.'));
      setSharingId(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => { if (!sharingId) onClose?.(); }}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: `${RADIUS.xl}px`,
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        },
      }}
    >
      <DialogTitle sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, color: 'var(--color-text)' }}>
        {t('case.share_with_lawyer', 'Share with a lawyer')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 2 }}>
          {caseData?.caseTitle || caseData?.cnrNumber}
        </Typography>

        {!allowed ? (
          <Typography variant="body2" sx={{ color: 'var(--color-text)' }}>
            {t('case.share_upgrade', 'Sharing a case with a lawyer is included on the Pro plan.')}
          </Typography>
        ) : (
          <>
            {sharedName && (
              <Typography variant="body2" sx={{ color: 'var(--color-text)', mb: 1.5 }}>
                {t('case.share_current', 'Currently shared with {{name}}.', { name: sharedName })}
              </Typography>
            )}
            <TextField
              fullWidth
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('case.share_search', 'Search lawyers by name')}
              InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }}
              sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
            />
            {error && (
              <Typography variant="body2" sx={{ color: 'var(--color-error)', mb: 1.5 }}>
                {error}
              </Typography>
            )}
            <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} variant="rectangular" height={52} sx={{ borderRadius: `${RADIUS.md}px`, mb: 1 }} />
                ))
              ) : lawyers.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', py: 3, textAlign: 'center' }}>
                  {t('case.share_empty', 'No lawyers match that search.')}
                </Typography>
              ) : (
                lawyers.map((lawyer) => {
                  const already = sharedId && String(sharedId) === String(lawyer.userId);
                  return (
                    <Box
                      key={lawyer.userId || lawyer.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 1.25,
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                          {lawyer.name || t('case.lawyer_general', 'Advocate')}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                          {lawyerLabel(lawyer) || t('case.lawyer_general', 'Advocate')}
                          {!lawyer.isVerified ? ` · ${t('case.share_unverified', 'Pending verification')}` : ''}
                        </Typography>
                      </Box>
                      {already ? (
                        <Chip size="small" label={t('case.shared', 'Shared')} sx={{ fontWeight: 700 }} />
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          disabled={!lawyer.userId || !!sharingId}
                          onClick={() => share(lawyer)}
                          sx={{
                            borderRadius: `${RADIUS.md}px`,
                            fontWeight: 700,
                            background: 'var(--color-primary)',
                            flexShrink: 0,
                          }}
                        >
                          {sharingId === lawyer.userId
                            ? t('case.fetching', '…')
                            : t('case.share_action', 'Share')}
                        </Button>
                      )}
                    </Box>
                  );
                })
              )}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={!!sharingId}
          sx={{ borderRadius: `${RADIUS.md}px`, color: 'var(--color-text-secondary)' }}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        {!allowed && (
          <Button
            variant="contained"
            onClick={() => navigate('/pricing')}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}
          >
            {t('case.upgrade', 'Upgrade')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

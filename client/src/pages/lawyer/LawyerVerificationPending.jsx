import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';

import { selectLawyerProfile } from '../../store/slices/authSlice';
import { logout } from '../../store/slices/authSlice';
import GlassCard from '../../components/ui/GlassCard';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { TYPOGRAPHY } from '../../theme/tokens';

const STATUS_META = {
  pending: {
    icon: '⏳',
    label: 'Under Review',
    chipColor: '#ed6c02',
    chipBg: 'rgba(237,108,2,0.12)',
    heading: 'Your profile is under review',
    body: 'Our team is verifying your credentials. This usually takes 1–2 business days. You will receive an email and WhatsApp notification once your profile is approved.',
  },
  under_review: {
    icon: '🔍',
    label: 'Under Review',
    chipColor: '#0288d1',
    chipBg: 'rgba(2,136,209,0.12)',
    heading: 'We are reviewing your documents',
    body: 'Your documents are being verified by our compliance team. You will be notified as soon as the review is complete.',
  },
  rejected: {
    icon: '❌',
    label: 'Rejected',
    chipColor: '#d32f2f',
    chipBg: 'rgba(211,47,47,0.12)',
    heading: 'Verification was not successful',
    body: 'Your profile could not be verified at this time. Please update your documents and contact support if you need help.',
  },
};

export default function LawyerVerificationPending() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const lawyerProfile = useSelector(selectLawyerProfile);

  const status = lawyerProfile?.verificationStatus || 'pending';
  const meta = STATUS_META[status] || STATUS_META.pending;
  const rejectionReason = lawyerProfile?.rejectionReason;

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
    <AnimatedPage>
      <Box
        sx={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4 },
        }}
      >
        <GlassCard
          sx={{
            maxWidth: 520,
            width: '100%',
            p: { xs: 3, sm: 5 },
            textAlign: 'center',
            borderRadius: 4,
          }}
        >
          {/* Icon */}
          <Box sx={{ fontSize: 56, mb: 2, lineHeight: 1 }}>{meta.icon}</Box>

          {/* Status chip */}
          <Chip
            label={meta.label}
            size="small"
            sx={{
              mb: 2.5,
              fontWeight: 700,
              fontSize: '0.75rem',
              background: meta.chipBg,
              color: meta.chipColor,
              border: `1px solid ${meta.chipColor}33`,
            }}
          />

          {/* Heading */}
          <Typography
            variant="h5"
            sx={{
              fontFamily: TYPOGRAPHY.fontFamily.display,
              fontWeight: 700,
              color: 'var(--color-text)',
              mb: 1.5,
            }}
          >
            {meta.heading}
          </Typography>

          {/* Body */}
          <Typography
            variant="body2"
            sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.7, mb: 2 }}
          >
            {meta.body}
          </Typography>

          {/* Rejection reason */}
          {status === 'rejected' && rejectionReason && (
            <Box
              sx={{
                mt: 1,
                mb: 2,
                p: 2,
                borderRadius: 2,
                background: 'rgba(211,47,47,0.07)',
                border: '1px solid rgba(211,47,47,0.2)',
                textAlign: 'left',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#d32f2f', display: 'block', mb: 0.5 }}>
                Reason
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text)', lineHeight: 1.6 }}>
                {rejectionReason}
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 3, borderColor: 'var(--color-border)' }} />

          {/* What to do next */}
          <Box sx={{ textAlign: 'left', mb: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              What you can do
            </Typography>
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5, color: 'var(--color-text-secondary)' }}>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2">Complete your profile and upload all required documents</Typography>
              </Box>
              <Box component="li" sx={{ mb: 0.5 }}>
                <Typography variant="body2">Ensure your Bar Council number is accurate</Typography>
              </Box>
              <Box component="li">
                <Typography variant="body2">
                  Contact{' '}
                  <Box component="span" sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    support@nyayasetu.in
                  </Box>
                  {' '}for queries
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate('/lawyer/settings')}
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                background: 'var(--color-primary)',
                '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
              }}
            >
              Go to Settings
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={handleLogout}
              sx={{ borderRadius: 2, fontWeight: 600, borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              Log Out
            </Button>
          </Box>
        </GlassCard>
      </Box>
    </AnimatedPage>
  );
}

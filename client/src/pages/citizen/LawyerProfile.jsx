/**
 * client/src/pages/citizen/LawyerProfile.jsx
 *
 * Public-facing lawyer profile page accessible to citizens.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';

import { getLawyerProfile, selectCurrentLawyer, selectLawyerProfileLoading } from '../../store/slices/lawyerSlice';
import { selectUserPlan, selectIsAuthenticated } from '../../store/slices/authSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import ConsultationBooking from '../../components/lawyer/ConsultationBooking';
import FeatureGate from '../../components/ui/FeatureGate';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

// ─── Star rating ──────────────────────────────────────────────────────────────
function StarRating({ rating = 0, size = 18 }) {
  return (
    <Box sx={{ display: 'inline-flex', gap: 0.25 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Typography key={i} sx={{ fontSize: size, lineHeight: 1, color: i < Math.round(rating) ? '#F59E0B' : 'var(--color-border)' }}>
          {i < Math.floor(rating) ? '★' : i < rating ? '⭐' : '☆'}
        </Typography>
      ))}
    </Box>
  );
}

// ─── Review card ──────────────────────────────────────────────────────────────
function ReviewCard({ review, delay }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }}>
      <Box sx={{ p: 2, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Avatar sx={{ width: 32, height: 32, background: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 700 }}>
            {review.citizenName?.charAt(0).toUpperCase() || '?'}
          </Avatar>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>
              {review.citizenName || 'Anonymous'}
            </Typography>
            <StarRating rating={review.score} size={12} />
          </Box>
          {review.createdAt && (
            <Typography variant="caption" sx={{ ml: 'auto', color: 'var(--color-text-secondary)' }}>
              {new Date(review.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </Typography>
          )}
        </Box>
        {review.review && (
          <Typography variant="caption" sx={{ color: 'var(--color-text)', lineHeight: 1.6 }}>
            "{review.review}"
          </Typography>
        )}
      </Box>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function LawyerProfile() {
  const { lawyerId } = useParams();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const lawyer = useSelector(selectCurrentLawyer);
  const loading = useSelector(selectLawyerProfileLoading);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const plan = useSelector(selectUserPlan);

  const [bookingOpen, setBookingOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (lawyerId) dispatch(getLawyerProfile(lawyerId));
  }, [lawyerId, dispatch]);

  const handleBooking = () => {
    if (!isAuthenticated) { navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname)); return; }
    setBookingOpen(true);
  };

  if (loading) {
    return (
      <AnimatedPage>
        <Box sx={{ p: { xs: 2, sm: 4 }, maxWidth: 900, mx: 'auto' }}>
          <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
            <Skeleton variant="circular" width={96} height={96} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="40%" height={32} />
              <Skeleton variant="text" width="60%" height={20} sx={{ mt: 1 }} />
              <Skeleton variant="text" width="30%" height={20} sx={{ mt: 1 }} />
            </Box>
          </Box>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: `${RADIUS.xl}px`, mb: 2 }} />
          <Skeleton variant="rectangular" height={150} sx={{ borderRadius: `${RADIUS.xl}px` }} />
        </Box>
      </AnimatedPage>
    );
  }

  if (!lawyer) {
    return (
      <AnimatedPage>
        <Box sx={{ textAlign: 'center', py: 10 }}>
          <Typography sx={{ fontSize: 52, mb: 2 }}>🔍</Typography>
          <Typography variant="h6" sx={{ color: 'var(--color-text)' }}>{t('lawyer.not_found', 'Lawyer not found')}</Typography>
          <Button onClick={() => navigate('/citizen/lawyers')} sx={{ mt: 2, color: 'var(--color-primary)' }}>← Back to Lawyers</Button>
        </Box>
      </AnimatedPage>
    );
  }

  const feeRupees = lawyer.consultationFee ? Math.round(lawyer.consultationFee / 100) : 0;

  const lawyerForBooking = {
    id: lawyerId,
    name: lawyer.user?.name,
    consultationFee: lawyer.consultationFee,
    isAvailable: lawyer.isAcceptingClients,
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 900, mx: 'auto', pb: { xs: 10, md: 4 } }}>

        {/* Back button */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          <Typography
            variant="body2"
            onClick={() => navigate(-1)}
            sx={{ color: 'var(--color-text-secondary)', cursor: 'pointer', mb: 2, display: 'inline-flex', alignItems: 'center', gap: 0.5,
              '&:hover': { color: 'var(--color-primary)' } }}
          >
            ← {t('common.back', 'Back')}
          </Typography>
        </motion.div>

        {/* Hero card */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <Box sx={{
            p: { xs: 3, sm: 4 }, mb: 3,
            borderRadius: `${RADIUS.xxl || 20}px`,
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%)',
            position: 'relative', overflow: 'hidden',
          }}>
            <Box sx={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />

            <Box sx={{ display: 'flex', gap: { xs: 2, sm: 3 }, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Avatar sx={{ width: { xs: 72, sm: 96 }, height: { xs: 72, sm: 96 }, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: { xs: '1.75rem', sm: '2.25rem' }, fontWeight: 800, flexShrink: 0, border: '3px solid rgba(255,255,255,0.4)' }}>
                {(lawyer.user?.name || 'L').charAt(0).toUpperCase()}
              </Avatar>

              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  <Typography variant="h4" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                    {lawyer.user?.name || 'Advocate'}
                  </Typography>
                  {lawyer.isVerified && (
                    <Tooltip title="Verified by NyayaSetu" arrow>
                      <Chip label="✅ Verified" size="small" sx={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, fontSize: '0.72rem', height: 22 }} />
                    </Tooltip>
                  )}
                  {lawyer.lawyerPlan === 'firm' && (
                    <Chip label="🥇 FIRM" size="small" sx={{ background: 'rgba(245,158,11,0.25)', color: '#FFD700', fontWeight: 800, fontSize: '0.72rem', height: 22 }} />
                  )}
                </Box>

                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)', mb: 1 }}>
                  {lawyer.experience} {t('lawyer.experience', 'years experience')}
                  {lawyer.district && ` · ${lawyer.district}`}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <StarRating rating={lawyer.averageRating || 0} size={18} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                    {(lawyer.averageRating || 0).toFixed(1)}
                    {lawyer.totalRatings > 0 && ` (${lawyer.totalRatings} reviews)`}
                  </Typography>
                </Box>

                <Typography variant="h5" sx={{ fontWeight: 800, color: '#fff', mt: 1.5 }}>
                  {feeRupees > 0 ? `₹${feeRupees} / consultation` : 'Free'}
                </Typography>
              </Box>
            </Box>

            {/* CTA buttons */}
            <Box sx={{ display: 'flex', gap: 1.5, mt: 3, flexWrap: 'wrap' }}>
              <FeatureGate feature="book_consultation" compact>
                <motion.div whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }} whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}>
                  <Button
                    variant="contained"
                    disabled={!lawyer.isAcceptingClients}
                    onClick={handleBooking}
                    sx={{
                      background: '#fff', color: 'var(--color-primary)', fontWeight: 700,
                      borderRadius: `${RADIUS.md}px`,
                      '&:hover': { background: 'rgba(255,255,255,0.9)' },
                      '&:disabled': { background: 'rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.6)' },
                    }}
                  >
                    📅 {lawyer.isAcceptingClients ? t('lawyer.book_consultation', 'Book Consultation') : t('lawyer.unavailable', 'Unavailable')}
                  </Button>
                </motion.div>
              </FeatureGate>
            </Box>
          </Box>
        </motion.div>

        <Grid container spacing={3}>
          {/* Left: Bio + Specialisations */}
          <Grid item xs={12} md={8}>
            {/* Bio */}
            {lawyer.bio && (
              <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <Box sx={{ p: 3, mb: 2.5, borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm }}>
                  <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 1.5 }}>
                    {t('lawyer.about', 'About')}
                  </GradientHeading>
                  <Typography variant="body2" sx={{ color: 'var(--color-text)', lineHeight: 1.75 }}>
                    {lawyer.bio}
                  </Typography>
                </Box>
              </motion.div>
            )}

            {/* Specialisations */}
            {lawyer.specialisations?.length > 0 && (
              <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
                <Box sx={{ p: 3, mb: 2.5, borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm }}>
                  <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 1.5 }}>
                    {t('lawyer.specialisations', 'Specialisations')}
                  </GradientHeading>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {lawyer.specialisations.map((s) => (
                      <Chip key={s} label={s} sx={{
                        background: 'var(--color-primary-alpha)', color: 'var(--color-primary)',
                        fontWeight: 600, border: '1px solid var(--color-primary)',
                      }} />
                    ))}
                  </Box>
                </Box>
              </motion.div>
            )}

            {/* Reviews */}
            {lawyer.recentRatings?.length > 0 && (
              <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Box sx={{ p: 3, borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm }}>
                  <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 2 }}>
                    ⭐ {t('lawyer.reviews', 'Client Reviews')}
                  </GradientHeading>
                  {lawyer.recentRatings.map((r, i) => (
                    <ReviewCard key={i} review={r} delay={i * 0.08} />
                  ))}
                </Box>
              </motion.div>
            )}
          </Grid>

          {/* Right: Details sidebar */}
          <Grid item xs={12} md={4}>
            <motion.div initial={prefersReducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }}>
              <GlassCard sx={{ p: 2.5, mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.75 }}>
                  {t('lawyer.details', 'Details')}
                </Typography>
                {[
                  { icon: '📍', label: t('lawyer.states', 'States'), value: (lawyer.practicingStates || []).join(', ') },
                  { icon: '🎓', label: t('lawyer.experience', 'Experience'), value: `${lawyer.experience || 0} years` },
                  { icon: '💰', label: t('lawyer.fee', 'Consultation Fee'), value: feeRupees > 0 ? `₹${feeRupees}` : 'Free', bold: true },
                  { icon: '✅', label: t('lawyer.availability', 'Availability'), value: lawyer.isAcceptingClients ? '🟢 Available' : '🔴 Unavailable' },
                ].map((row) => (
                  <Box key={row.label} sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                    <Typography sx={{ fontSize: 18, flexShrink: 0, mt: 0.1 }}>{row.icon}</Typography>
                    <Box>
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>{row.label}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: row.bold ? 800 : 600, color: row.bold ? 'var(--color-primary)' : 'var(--color-text)' }}>
                        {row.value || '—'}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </GlassCard>

              {/* Rating summary */}
              <GlassCard sx={{ p: 2.5 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h2" sx={{ fontWeight: 900, color: 'var(--color-primary)', lineHeight: 1 }}>
                    {(lawyer.averageRating || 0).toFixed(1)}
                  </Typography>
                  <StarRating rating={lawyer.averageRating || 0} size={20} />
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mt: 0.5 }}>
                    {lawyer.totalRatings || 0} {t('lawyer.total_reviews', 'reviews')}
                  </Typography>
                </Box>
              </GlassCard>
            </motion.div>
          </Grid>
        </Grid>
      </Box>

      <ConsultationBooking
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        lawyer={lawyerForBooking}
      />
    </AnimatedPage>
  );
}

export default LawyerProfile;

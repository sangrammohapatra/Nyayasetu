/**
 * client/src/pages/shared/Pricing.jsx
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Accordion from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import MuiAccordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { selectUser, selectUserPlan } from '../../store/slices/authSlice';
import {
  createOrder, verifyPayment, selectSubscriptionLoading,
} from '../../store/slices/subscriptionSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import { openCheckout } from '../../services/razorpay';
import { RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const CITIZEN_PLANS = [
  {
    id: 'free',
    name: 'Free',
    icon: '🆓',
    monthly: 0,
    annual: 0,
    color: 'var(--color-text-secondary)',
    features: [
      { label: '3 documents/month', included: true },
      { label: '5 AI chats/month', included: true },
      { label: '1 case tracked', included: true },
      { label: '5 basic templates', included: true },
      { label: 'Document preview', included: true },
      { label: 'PDF download', included: false },
      { label: 'Voice input', included: false },
      { label: 'Clause explainer', included: false },
      { label: 'WhatsApp alerts', included: false },
      { label: 'Find lawyer', included: false },
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    icon: '⭐',
    monthly: 99,
    annual: 999,
    color: 'var(--color-primary)',
    popular: true,
    features: [
      { label: '15 documents/month', included: true },
      { label: '30 AI chats/month', included: true },
      { label: '5 cases tracked', included: true },
      { label: 'All templates', included: true },
      { label: 'PDF download', included: true },
      { label: 'Voice input', included: true },
      { label: 'Clause explainer', included: true },
      { label: 'WhatsApp hearing alerts', included: true },
      { label: 'View lawyer profiles', included: true },
      { label: 'Book consultation', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    icon: '🚀',
    monthly: 199,
    annual: 1999,
    color: 'var(--color-warning)',
    features: [
      { label: 'Unlimited documents', included: true },
      { label: 'Unlimited AI chats', included: true },
      { label: 'Unlimited cases', included: true },
      { label: 'All templates + premium', included: true },
      { label: 'PDF download', included: true },
      { label: 'Voice input', included: true },
      { label: 'Clause explainer', included: true },
      { label: 'WhatsApp + email alerts', included: true },
      { label: 'Book lawyer consultation', included: true },
      { label: 'Priority support', included: true },
    ],
  },
];

const LAWYER_PLANS = [
  {
    id: 'free',
    name: 'Free',
    icon: '🆓',
    monthly: 0,
    annual: 0,
    color: 'var(--color-text-secondary)',
    features: [
      { label: 'Apply for profile', included: true },
      { label: 'Client portal', included: false },
      { label: 'Verified badge', included: false },
      { label: 'Consultation bookings', included: false },
      { label: 'Analytics', included: false },
      { label: 'Team members', included: false },
    ],
  },
  {
    id: 'professional',
    name: 'Professional',
    icon: '⚖️',
    monthly: 499,
    annual: 4999,
    color: 'var(--color-primary)',
    popular: true,
    features: [
      { label: 'Apply for profile', included: true },
      { label: 'Client portal', included: true },
      { label: 'Verified badge', included: true },
      { label: 'Consultation bookings', included: true },
      { label: 'Review 20 docs/month', included: true },
      { label: 'Basic analytics', included: true },
      { label: 'Team members', included: false },
      { label: 'Custom branding', included: false },
    ],
  },
  {
    id: 'firm',
    name: 'Firm',
    icon: '🏛️',
    monthly: 1499,
    annual: 14999,
    color: 'var(--color-warning)',
    features: [
      { label: 'All Professional features', included: true },
      { label: '5 team members', included: true },
      { label: 'Advanced analytics', included: true },
      { label: 'Custom branding', included: true },
      { label: 'Priority placement', included: true },
      { label: 'Gold verified badge', included: true },
      { label: 'Unlimited doc reviews', included: true },
      { label: '92% revenue share', included: true },
    ],
  },
];

const TESTIMONIALS = [
  { name: 'Priya Sharma', role: 'Consumer rights advocate, Delhi', quote: 'I helped my neighbour file a consumer complaint in 10 minutes. NyayaSetu made it possible.', avatar: '👩' },
  { name: 'Rajesh Kumar', role: 'Factory worker, Pune', quote: 'My employment termination notice was generated and verified by a lawyer within 24 hours. Saved me ₹5,000.', avatar: '👨' },
  { name: 'Adv. Meena Joshi', role: 'Advocate, Nagpur (Lawyer plan)', quote: 'I get 8–10 new consultation requests every month through NyayaSetu. Best investment for my practice.', avatar: '👩‍⚖️' },
];

const FAQS = [
  { q: 'Can I use NyayaSetu for free?', a: 'Yes! The Free plan lets you create 3 documents and 5 AI chats per month, and track 1 court case — completely free, no credit card required.' },
  { q: 'Are the documents legally valid?', a: 'Yes. Our AI generates documents based on the exact applicable Indian laws for your state, citing actual Act sections. The documents are as valid as any lawyer-drafted notice.' },
  { q: 'Can I cancel anytime?', a: 'Absolutely. Cancel from Settings → Subscription. You keep access until the end of your billing period, with no fees or penalties.' },
  { q: 'What happens to my documents if I downgrade?', a: 'Your existing documents are always accessible. You just won\'t be able to create new ones beyond the free tier limits.' },
  { q: 'Is my data secure?', a: 'Yes. All documents use AES-256 encryption at rest. Sensitive fields like legal details are encrypted in the database and PDFs expire after 15 minutes.' },
  { q: 'Do you support all Indian languages?', a: 'We support 11 languages: English, Hindi, Bengali, Marathi, Tamil, Telugu, Gujarati, Kannada, Malayalam, Punjabi, and Urdu.' },
];

// ─── Animated price number ────────────────────────────────────────────────────

function AnimatedPrice({ value, annual }) {
  const motionVal = useMotionValue(value);
  const rounded = useTransform(motionVal, (v) => Math.round(v));
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const controls = animate(motionVal, value, { duration: 0.4, ease: 'easeOut' });
    const unsub = rounded.on('change', setDisplay);
    return () => { controls.stop(); unsub(); };
  }, [value]);

  return (
    <Box sx={{ textAlign: 'center', my: 2 }}>
      {value === 0 ? (
        <Typography variant="h3" sx={{ fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
          Free
        </Typography>
      ) : (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 0.5 }}>
            <Typography variant="body1" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)', mt: 1 }}>₹</Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, color: 'var(--color-text)', lineHeight: 1 }}>
              {display}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            /{annual ? 'year' : 'month'}
          </Typography>
          {annual && value > 0 && (
            <Typography variant="caption" sx={{ display: 'block', color: 'var(--color-success)', fontWeight: 600 }}>
              Save ₹{(Math.round(value / 10) * 2).toLocaleString('en-IN')}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({ plan, annual, currentPlan, onSelect, loading, persona }) {
  const { t } = useTranslation();
  const isCurrentPlan = plan.id === currentPlan;
  const price = annual ? plan.annual : plan.monthly;
  const isFree = price === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      whileHover={!isCurrentPlan ? { y: -6, transition: { duration: 0.2 } } : {}}
      style={{ height: '100%' }}
    >
      <Box sx={{
        height: '100%', p: 3,
        borderRadius: `${RADIUS.xl}px`,
        border: plan.popular
          ? '2px solid var(--color-primary)'
          : '1.5px solid var(--color-border)',
        background: plan.popular ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        boxShadow: plan.popular ? SHADOWS.lg : SHADOWS.sm,
        transition: 'box-shadow 0.2s',
      }}>
        {/* Popular badge */}
        {plan.popular && (
          <Box sx={{
            position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(90deg, var(--color-primary), var(--color-primary-light))',
            color: '#fff', px: 2, py: 0.4,
            borderRadius: `${RADIUS.full}px`,
            fontSize: '0.7rem', fontWeight: 800, whiteSpace: 'nowrap',
            boxShadow: SHADOWS.md,
          }}>
            ⭐ MOST POPULAR
          </Box>
        )}

        {/* Plan name */}
        <Box sx={{ textAlign: 'center', mb: 0.5 }}>
          <Typography sx={{ fontSize: 32, mb: 0.5 }}>{plan.icon}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--color-text)' }}>
            {plan.name}
          </Typography>
        </Box>

        {/* Price */}
        <AnimatedPrice value={price} annual={annual} />

        {/* Current plan badge */}
        {isCurrentPlan && (
          <Chip label="✓ Current Plan" size="small" sx={{
            mb: 2, mx: 'auto',
            background: 'rgba(46,125,50,0.12)', color: 'var(--color-success)',
            fontWeight: 700, fontSize: '0.72rem',
          }} />
        )}

        {/* Features */}
        <Box sx={{ flex: 1, mb: 2.5 }}>
          {plan.features.map((feat, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.9 }}>
              <Typography sx={{ fontSize: 14, mt: 0.1, flexShrink: 0 }}>
                {feat.included ? '✅' : '❌'}
              </Typography>
              <Typography variant="caption" sx={{
                color: feat.included ? 'var(--color-text)' : 'var(--color-text-secondary)',
                lineHeight: 1.5,
                textDecoration: feat.included ? 'none' : 'none',
                opacity: feat.included ? 1 : 0.6,
              }}>
                {feat.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* CTA */}
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button
            fullWidth
            variant={plan.popular ? 'contained' : 'outlined'}
            disabled={isCurrentPlan || loading}
            onClick={() => !isFree && onSelect(plan.id, persona)}
            sx={{
              py: 1.25, borderRadius: `${RADIUS.md}px`, fontWeight: 700, fontSize: '0.95rem',
              background: plan.popular ? 'var(--color-primary)' : 'transparent',
              borderColor: plan.popular ? 'transparent' : 'var(--color-border)',
              color: plan.popular ? '#fff' : 'var(--color-text)',
              '&:hover': {
                background: plan.popular ? 'var(--color-primary-dark, var(--color-primary))' : 'var(--color-overlay)',
              },
              '&:disabled': {
                background: 'var(--color-border)',
                color: 'var(--color-text-secondary)',
              },
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: '#fff' }} /> :
              isCurrentPlan ? 'Current Plan' :
              isFree ? 'Get Started Free' :
              `Upgrade to ${plan.name}`}
          </Button>
        </motion.div>
      </Box>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Pricing() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const user = useSelector(selectUser);
  const currentPlan = useSelector(selectUserPlan);
  const subLoading = useSelector(selectSubscriptionLoading);

  const [annual, setAnnual] = useState(false);
  const [persona, setPersona] = useState('citizen');
  const [checkoutLoading, setCheckoutLoading] = useState('');
  const [showComparison, setShowComparison] = useState(false);
  const confettiRef = useRef(null);

  const plans = persona === 'citizen' ? CITIZEN_PLANS : LAWYER_PLANS;

  const handleSelectPlan = async (planId, pTab) => {
    if (!user) { navigate('/login?returnUrl=/pricing'); return; }

    setCheckoutLoading(planId);
    try {
      const result = await dispatch(createOrder({
        plan: planId,
        billingCycle: annual ? 'annual' : 'monthly',
        persona: pTab,
      }));

      if (result.meta.requestStatus !== 'fulfilled') {
        setCheckoutLoading('');
        return;
      }

      const orderData = result.payload;
      openCheckout({
        orderId: orderData.orderId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'NyayaSetu',
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan — ${annual ? 'Annual' : 'Monthly'}`,
        prefill: { name: user.name, contact: user.phone, email: user.email },
        onSuccess: async (response) => {
          const verifyResult = await dispatch(verifyPayment({
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
            signature: response.razorpay_signature,
            plan: planId,
            billingCycle: annual ? 'annual' : 'monthly',
            persona: pTab,
          }));

          if (verifyResult.meta.requestStatus === 'fulfilled') {
            // Confetti!
            try {
              const confetti = (await import('canvas-confetti')).default;
              confetti({ particleCount: 160, spread: 80, origin: { y: 0.55 }, colors: ['#1565C0', '#E65100', '#2E7D32'] });
            } catch (_) {}
            setTimeout(() => navigate(`/${user.persona || 'citizen'}/home`), 1800);
          }
          setCheckoutLoading('');
        },
        onDismiss: () => setCheckoutLoading(''),
      });
    } catch (_) {
      setCheckoutLoading('');
    }
  };

  return (
    <AnimatedPage>
      <Box sx={{ pb: { xs: 10, md: 6 } }}>
        {/* Hero */}
        <Box sx={{
          textAlign: 'center', py: { xs: 6, md: 8 }, px: 3,
          background: 'linear-gradient(180deg, var(--color-primary-alpha) 0%, transparent 100%)',
        }}>
          {currentPlan && currentPlan !== 'free' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <Chip label={`Current: ${currentPlan.toUpperCase()}`} sx={{
                mb: 2, background: 'var(--color-primary)', color: '#fff', fontWeight: 700,
              }} />
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Typography variant={isMobile ? 'h4' : 'h3'} sx={{
              fontFamily: "'Playfair Display',serif", fontWeight: 800, color: 'var(--color-text)', mb: 1.5,
            }}>
              {t('pricing.hero', 'Legal help that fits your pocket')}
            </Typography>
            <Typography variant="h6" sx={{ color: 'var(--color-text-secondary)', fontWeight: 400, maxWidth: 520, mx: 'auto' }}>
              {t('pricing.heroSub', 'Professional legal documents from ₹0. Access justice without the lawyer fees.')}
            </Typography>
          </motion.div>
        </Box>

        <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 2, sm: 3 } }}>
          {/* Billing toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, mb: 4 }}>
            <Typography variant="body2" sx={{ fontWeight: annual ? 400 : 700, color: 'var(--color-text)' }}>
              {t('pricing.monthly', 'Monthly')}
            </Typography>
            <Switch
              checked={annual}
              onChange={(e) => setAnnual(e.target.checked)}
              sx={{ '& .MuiSwitch-thumb': { background: 'var(--color-primary)' }, '& .MuiSwitch-track': { background: 'var(--color-border)' } }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: annual ? 700 : 400, color: 'var(--color-text)' }}>
                {t('pricing.annual', 'Annual')}
              </Typography>
              <Chip label="2 months FREE" size="small" sx={{
                height: 20, fontSize: '0.67rem', fontWeight: 700,
                background: 'rgba(46,125,50,0.12)', color: 'var(--color-success)',
                border: '1px solid var(--color-success)',
              }} />
            </Box>
          </Box>

          {/* Persona tabs */}
          <Tabs value={persona} onChange={(_, v) => setPersona(v)} centered
            sx={{
              mb: 4, '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.95rem' },
              '& .Mui-selected': { color: 'var(--color-primary)' },
              '& .MuiTabs-indicator': { background: 'var(--color-primary)' },
            }}>
            <Tab value="citizen" label="🏠 For Citizens" />
            <Tab value="lawyer" label="⚖️ For Lawyers" />
          </Tabs>

          {/* Plan cards */}
          <AnimatePresence mode="wait">
            <motion.div
              key={persona}
              initial={{ opacity: 0, x: persona === 'citizen' ? -20 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: persona === 'citizen' ? 20 : -20 }}
              transition={{ duration: 0.3 }}
            >
              <Grid container spacing={3} sx={{ mb: 5 }}>
                {plans.map((plan) => (
                  <Grid item xs={12} sm={4} key={plan.id} sx={{ display: 'flex' }}>
                    <Box sx={{ width: '100%' }}>
                      <PlanCard
                        plan={plan}
                        annual={annual}
                        currentPlan={currentPlan}
                        onSelect={handleSelectPlan}
                        loading={checkoutLoading === plan.id}
                        persona={persona}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          </AnimatePresence>

          {/* Feature comparison toggle */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Button
              variant="text"
              onClick={() => setShowComparison((v) => !v)}
              sx={{ color: 'var(--color-primary)', fontWeight: 600 }}
            >
              {showComparison ? '▲ Hide' : '▼ Compare'} all features
            </Button>
            <AnimatePresence>
              {showComparison && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Box sx={{
                    mt: 2, p: 2.5, borderRadius: `${RADIUS.xl}px`,
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                    overflowX: 'auto',
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-text)', fontWeight: 700 }}>Feature</th>
                          {plans.map((p) => (
                            <th key={p.id} style={{ padding: '8px 12px', color: 'var(--color-primary)', fontWeight: 700, textAlign: 'center' }}>
                              {p.icon} {p.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {plans[0].features.map((feat, fi) => (
                          <tr key={fi} style={{ borderTop: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--color-text)', fontSize: '0.85rem' }}>{feat.label}</td>
                            {plans.map((p) => (
                              <td key={p.id} style={{ padding: '8px 12px', textAlign: 'center', fontSize: '1rem' }}>
                                {(p.features[fi] || {}).included ? '✅' : '❌'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </Box>

          {/* Testimonials */}
          <Box sx={{ mb: 5 }}>
            <Typography variant="h5" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', textAlign: 'center', mb: 3 }}>
              💬 Still not sure? Here's what our users say
            </Typography>
            <Grid container spacing={2}>
              {TESTIMONIALS.map((t, i) => (
                <Grid item xs={12} md={4} key={i}>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12 }}
                  >
                    <Box sx={{
                      p: 2.5, height: '100%',
                      borderRadius: `${RADIUS.xl}px`,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                    }}>
                      <Typography sx={{ fontSize: 32, mb: 1.5 }}>{t.avatar}</Typography>
                      <Typography variant="body2" sx={{ color: 'var(--color-text)', lineHeight: 1.65, mb: 2, fontStyle: 'italic' }}>
                        "{t.quote}"
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text)', display: 'block' }}>{t.name}</Typography>
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{t.role}</Typography>
                    </Box>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* FAQ */}
          <Box>
            <Typography variant="h5" sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)', mb: 3 }}>
              ❓ Frequently Asked Questions
            </Typography>
            {FAQS.map((faq, i) => (
              <MuiAccordion key={i} elevation={0} sx={{
                mb: 1, borderRadius: `${RADIUS.lg}px !important`,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                '&:before': { display: 'none' },
                overflow: 'hidden',
              }}>
                <AccordionSummary expandIcon={<Typography sx={{ fontSize: 14 }}>▾</Typography>}
                  sx={{ '& .MuiAccordionSummary-content': { my: 1.25 } }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>{faq.q}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>{faq.a}</Typography>
                </AccordionDetails>
              </MuiAccordion>
            ))}
          </Box>
        </Box>
      </Box>
    </AnimatedPage>
  );
}

export default Pricing;

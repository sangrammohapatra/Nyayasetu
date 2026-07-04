/**
 * client/src/pages/lawyer/EarningsPanel.jsx
 *
 * All Recharts colors derived from theme via useTheme() — NEVER hardcoded.
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { useTheme as useMuiTheme } from '@mui/material/styles';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';
import api from '../../services/api';

// ─── Stat card ────────────────────────────────────────────────────────────────
function EarningCard({ icon, label, value, sub, color, delay = 0 }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.38 }}>
      <Box sx={{
        p: 2.5, borderRadius: `${RADIUS.xl}px`,
        background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: SHADOWS.sm,
      }}>
        <Box sx={{ width: 42, height: 42, borderRadius: `${RADIUS.md}px`, background: color || 'var(--color-primary-alpha)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, mb: 1.5 }}>
          {icon}
        </Box>
        <GradientHeading variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 800, lineHeight: 1.1, mb: 0.25 }}>
          {value}
        </GradientHeading>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>{label}</Typography>
        {sub && <Typography variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>{sub}</Typography>}
      </Box>
    </motion.div>
  );
}

// ─── Payment history table ────────────────────────────────────────────────────
function PaymentRow({ payment, i }) {
  const prefersReducedMotion = useReducedMotion();
  const date = new Date(payment.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' });
  const earning = Math.round((payment.lawyerEarnings || 0) / 100);
  const type = payment.type?.replace(/_/g, ' ') || 'consultation';

  return (
    <motion.div initial={prefersReducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, py: 1.5, px: 2,
        borderBottom: '1px solid var(--color-border)',
        '&:last-child': { borderBottom: 'none' },
      }}>
        <Box sx={{ width: 36, height: 36, borderRadius: `${RADIUS.md}px`, background: 'rgba(46,125,50,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          💰
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)', textTransform: 'capitalize' }}>{type}</Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{date}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="body2" sx={{ fontWeight: 800, color: 'var(--color-success)' }}>+₹{earning}</Typography>
          <Chip size="small" label={payment.status} sx={{
            height: 18, fontSize: '0.62rem', fontWeight: 600,
            background: payment.status === 'paid' ? 'rgba(46,125,50,0.1)' : 'var(--color-border)',
            color: payment.status === 'paid' ? 'var(--color-success)' : 'var(--color-text-secondary)',
          }} />
        </Box>
      </Box>
    </motion.div>
  );
}

// ─── Custom recharts tooltip ──────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <Box sx={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: `${RADIUS.md}px`, p: 1.5, boxShadow: SHADOWS.md,
    }}>
      <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text)', display: 'block', mb: 0.5 }}>{label}</Typography>
      {payload.map((p) => (
        <Typography key={p.dataKey} variant="caption" sx={{ display: 'block', color: p.color }}>
          {p.name}: ₹{p.value.toLocaleString('en-IN')}
        </Typography>
      ))}
    </Box>
  );
}

// ─── Withdrawal status chip meta ──────────────────────────────────────────────
const WITHDRAWAL_STATUS_META = {
  pending:    { label: 'Pending',    color: '#ed6c02', bg: 'rgba(237,108,2,0.1)' },
  processing: { label: 'Processing', color: '#0288d1', bg: 'rgba(2,136,209,0.1)' },
  completed:  { label: 'Completed',  color: '#2e7d32', bg: 'rgba(46,125,50,0.1)' },
  failed:     { label: 'Failed',     color: '#c62828', bg: 'rgba(198,40,40,0.1)' },
};

function fmtPaise(paise) {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// ─── Main component ───────────────────────────────────────────────────────────
function EarningsPanel() {
  const { t } = useTranslation();
  const muiTheme = useMuiTheme();
  const prefersReducedMotion = useReducedMotion();

  // Extract all chart colors from theme — NEVER hardcoded
  const chartColors = useMemo(() => ({
    earnings:   muiTheme.palette.primary.main,
    platform:   muiTheme.palette.secondary?.main || muiTheme.palette.error.main,
    grid:       muiTheme.palette.divider,
    text:       muiTheme.palette.text.secondary,
    tooltipBg:  muiTheme.palette.background.paper,
  }), [muiTheme]);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ lifetime: 0, thisMonth: 0, pending: 0, consultationCount: 0 });
  const [chartData, setChartData] = useState([]);

  // Payouts
  const [payoutData, setPayoutData] = useState(null);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [bankForm, setBankForm] = useState({ accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSuccess, setBankSuccess] = useState(false);
  const [bankError, setBankError] = useState(null);
  const [editingBank, setEditingBank] = useState(false);
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState(null);

  const loadPayouts = () => {
    setPayoutLoading(true);
    api.get('/lawyers/me/withdrawals')
      .then(({ data: d }) => {
        setPayoutData(d);
        if (d.bankAccount) {
          setBankForm({
            accountHolderName: d.bankAccount.accountHolderName || '',
            accountNumber: '',
            ifscCode: d.bankAccount.ifscCode || '',
            bankName: d.bankAccount.bankName || '',
          });
        }
      })
      .finally(() => setPayoutLoading(false));
  };

  useEffect(() => { loadPayouts(); }, []);

  const handleBankSave = async () => {
    setBankSaving(true);
    setBankError(null);
    setBankSuccess(false);
    try {
      await api.put('/lawyers/bank-account', bankForm);
      setBankSuccess(true);
      setEditingBank(false);
      loadPayouts();
    } catch (err) {
      setBankError(err.response?.data?.message || 'Failed to save bank account');
    } finally {
      setBankSaving(false);
    }
  };

  const handleWithdraw = async () => {
    const amtPaise = Math.round(parseFloat(withdrawAmount) * 100);
    if (!amtPaise || amtPaise < 100) {
      setWithdrawError('Minimum withdrawal is ₹1');
      return;
    }
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await api.post('/lawyers/withdraw', { amount: amtPaise });
      setWithdrawDialog(false);
      setWithdrawAmount('');
      loadPayouts();
    } catch (err) {
      setWithdrawError(err.response?.data?.message || 'Withdrawal request failed');
    } finally {
      setWithdrawing(false);
    }
  };

  useEffect(() => {
    api.get('/payments/history?type=consultation&limit=200').then(({ data }) => {
      const list = data.items || data.payments || [];
      setPayments(list);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      let lifetime = 0, thisMonth = 0, pending = 0;
      const monthMap = {};

      list.forEach((p) => {
        const earning = p.lawyerEarnings || 0;
        if (p.status === 'paid') {
          lifetime += earning;
          if (new Date(p.createdAt) >= monthStart) thisMonth += earning;
        }
        if (p.status === 'created') pending += p.amount || 0;

        // Aggregate by month for chart
        const d = new Date(p.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        if (!monthMap[key]) monthMap[key] = { month: label, Earnings: 0, Platform: 0 };
        if (p.status === 'paid') {
          monthMap[key].Earnings += Math.round(earning / 100);
          monthMap[key].Platform += Math.round((p.platformEarnings || 0) / 100);
        }
      });

      setStats({
        lifetime: Math.round(lifetime / 100),
        thisMonth: Math.round(thisMonth / 100),
        pending: Math.round(pending / 100),
        consultationCount: list.filter((p) => p.status === 'paid').length,
      });

      const sorted = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
      setChartData(sorted);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 1000, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <GradientHeading variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 3 }}>
            {t('earnings.title', 'Earnings')}
          </GradientHeading>
        </motion.div>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Grid item xs={6} sm={3} key={i}>
                  <Skeleton variant="rectangular" height={120} sx={{ borderRadius: `${RADIUS.xl}px` }} />
                </Grid>
              ))
            : [
                { icon: '💰', label: t('earnings.lifetime', 'Lifetime Earnings'), value: `₹${stats.lifetime.toLocaleString('en-IN')}`, color: 'rgba(46,125,50,0.1)', delay: 0.05 },
                { icon: '📅', label: t('earnings.this_month', 'This Month'),        value: `₹${stats.thisMonth.toLocaleString('en-IN')}`, color: 'var(--color-primary-alpha)', delay: 0.12 },
                { icon: '⏳', label: t('earnings.pending', 'Pending Payout'),     value: `₹${stats.pending.toLocaleString('en-IN')}`,   color: 'rgba(230,81,0,0.1)', delay: 0.19 },
                { icon: '✅', label: t('earnings.consults', 'Paid Consultations'), value: stats.consultationCount.toString(),              color: 'rgba(2,119,189,0.1)', delay: 0.26 },
              ].map((s) => (
                <Grid item xs={6} sm={3} key={s.label}>
                  <EarningCard {...s} />
                </Grid>
              ))}
        </Grid>

        {/* Bar chart */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Box sx={{ p: 2.5, borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm, mb: 3 }}>
            <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 2.5 }}>
              {t('earnings.chart', 'Monthly Earnings (Last 6 Months)')}
            </GradientHeading>
            {chartData.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                  {t('earnings.no_data', 'No earnings data yet.')}
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: chartColors.text, fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: chartColors.text, fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ color: chartColors.text, fontSize: 12 }} />
                  <Bar dataKey="Earnings" fill={chartColors.earnings} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Platform" fill={chartColors.platform} radius={[4, 4, 0, 0]} maxBarSize={40} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        </motion.div>

        {/* Payment history */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}>
          <Box sx={{ borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm, overflow: 'hidden' }}>
            <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid var(--color-border)' }}>
              <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
                {t('earnings.history', 'Payment History')}
              </GradientHeading>
            </Box>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 2, p: 2, borderBottom: '1px solid var(--color-border)' }}>
                  <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: `${RADIUS.md}px`, flexShrink: 0 }} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="40%" height={18} />
                    <Skeleton variant="text" width="25%" height={14} sx={{ mt: 0.5 }} />
                  </Box>
                  <Skeleton variant="text" width={60} height={22} />
                </Box>
              ))
            ) : payments.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Typography sx={{ fontSize: 40, mb: 1 }}>💸</Typography>
                <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                  {t('earnings.no_payments', 'No payments yet.')}
                </Typography>
              </Box>
            ) : (
              payments.slice(0, 30).map((p, i) => <PaymentRow key={p._id || i} payment={p} i={i} />)
            )}
          </Box>
        </motion.div>

        {/* ── Payouts ─────────────────────────────────────────────────────── */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}>
          <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mt: 4, mb: 2 }}>
            {t('earnings.payouts', 'Payouts')}
          </GradientHeading>

          {!payoutLoading && (
            <>
              {/* Withdraw button */}
              <GlassCard sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                      Request a Payout
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                      {payoutData?.hasBankAccount ? 'Processed by admin within 2–3 business days' : 'Add your bank account first'}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    disabled={!payoutData?.hasBankAccount || (payoutData?.withdrawable || 0) < 100}
                    onClick={() => { setWithdrawDialog(true); setWithdrawError(null); setWithdrawAmount(''); }}
                    sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)', whiteSpace: 'nowrap' }}
                  >
                    Withdraw Funds
                  </Button>
                </Box>
              </GlassCard>

              {/* Available balance */}
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                {[
                  { label: 'Withdrawn', value: fmtPaise(payoutData?.withdrawnAmount), color: '#0288d1', icon: '🏦' },
                  { label: 'Available to Withdraw', value: fmtPaise(payoutData?.withdrawable), color: (payoutData?.withdrawable || 0) > 0 ? '#ed6c02' : 'var(--color-text-secondary)', icon: '💳' },
                ].map(({ label, value, color, icon }) => (
                  <GlassCard key={label} sx={{ p: 2, flex: '1 1 160px', minWidth: 0 }}>
                    <Typography sx={{ fontSize: 24, mb: 0.5 }}>{icon}</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color, fontFamily: TYPOGRAPHY.fontFamily.display }}>
                      {value}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      {label}
                    </Typography>
                  </GlassCard>
                ))}
              </Box>

              {/* Bank account */}
              <GlassCard sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                    🏦 Bank Account
                  </Typography>
                  {payoutData?.hasBankAccount && !editingBank && (
                    <Button size="small" onClick={() => setEditingBank(true)}
                      sx={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.75rem' }}>
                      Edit
                    </Button>
                  )}
                </Box>

                {payoutData?.hasBankAccount && !editingBank ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="body2" sx={{ color: 'var(--color-text)' }}>
                      {payoutData.bankAccount.accountHolderName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                      A/C: {payoutData.bankAccount.maskedAccountNumber}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                      {payoutData.bankAccount.bankName} &nbsp;|&nbsp; IFSC: {payoutData.bankAccount.ifscCode}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {bankSuccess && (
                      <Alert severity="success" sx={{ borderRadius: `${RADIUS.md}px` }} onClose={() => setBankSuccess(false)}>
                        Bank account saved successfully.
                      </Alert>
                    )}
                    {bankError && (
                      <Alert severity="error" sx={{ borderRadius: `${RADIUS.md}px` }}>{bankError}</Alert>
                    )}
                    {[
                      { key: 'accountHolderName', label: 'Account Holder Name' },
                      { key: 'accountNumber', label: 'Account Number' },
                      { key: 'ifscCode', label: 'IFSC Code' },
                      { key: 'bankName', label: 'Bank Name' },
                    ].map(({ key, label }) => (
                      <TextField
                        key={key} size="small" label={label} required
                        value={bankForm[key]}
                        onChange={(e) => setBankForm((f) => ({ ...f, [key]: e.target.value }))}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
                      />
                    ))}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {editingBank && (
                        <Button variant="outlined" onClick={() => setEditingBank(false)} disabled={bankSaving}
                          sx={{ flex: 1, borderRadius: `${RADIUS.md}px`, borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                          Cancel
                        </Button>
                      )}
                      <Button variant="contained" onClick={handleBankSave} disabled={bankSaving}
                        sx={{ flex: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
                        {bankSaving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Save Bank Account'}
                      </Button>
                    </Box>
                  </Box>
                )}
              </GlassCard>

              {/* Withdrawal history */}
              <GlassCard sx={{ p: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
                  Withdrawal History
                </Typography>
                {!payoutData?.withdrawals?.length ? (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                      No withdrawal requests yet
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {payoutData.withdrawals.map((w, i) => {
                      const meta = WITHDRAWAL_STATUS_META[w.status] || WITHDRAWAL_STATUS_META.pending;
                      return (
                        <React.Fragment key={w._id}>
                          {i > 0 && <Divider sx={{ my: 1, borderColor: 'var(--color-border)' }} />}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                                {fmtPaise(w.amount)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                                {new Date(w.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                                {w.reference && ` · Ref: ${w.reference}`}
                              </Typography>
                            </Box>
                            <Chip
                              label={meta.label} size="small"
                              sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700, background: meta.bg, color: meta.color }}
                            />
                          </Box>
                        </React.Fragment>
                      );
                    })}
                  </Box>
                )}
              </GlassCard>
            </>
          )}
        </motion.div>
      </Box>

      {/* Withdraw dialog */}
      <Dialog
        open={withdrawDialog}
        onClose={() => !withdrawing && setWithdrawDialog(false)}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: `${RADIUS.xl}px`, background: 'var(--color-surface)' } }}
      >
        <DialogTitle sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
          Request Withdrawal
        </DialogTitle>
        <DialogContent>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 2 }}>
            Available: <strong>{fmtPaise(payoutData?.withdrawable)}</strong>
          </Typography>
          {withdrawError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: `${RADIUS.md}px` }}>{withdrawError}</Alert>
          )}
          <TextField
            fullWidth size="small" label="Amount (₹)" type="number"
            inputProps={{ min: 1, step: 0.01 }}
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
          />
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', mt: 1, display: 'block' }}>
            Processed to: {payoutData?.bankAccount?.bankName} · {payoutData?.bankAccount?.maskedAccountNumber}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setWithdrawDialog(false)} disabled={withdrawing}
            sx={{ color: 'var(--color-text-secondary)' }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleWithdraw} disabled={withdrawing || !withdrawAmount}
            sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
            {withdrawing ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Request Payout'}
          </Button>
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}

export default EarningsPanel;

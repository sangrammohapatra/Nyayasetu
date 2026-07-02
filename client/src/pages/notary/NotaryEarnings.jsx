/**
 * NotaryEarnings.jsx
 *
 * Notary's earnings overview, bank account setup, and withdrawal request flow.
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';
import api from '../../services/api';

const STATUS_META = {
  pending:    { label: 'Pending',    color: '#ed6c02', bg: 'rgba(237,108,2,0.1)' },
  processing: { label: 'Processing', color: '#0288d1', bg: 'rgba(2,136,209,0.1)' },
  completed:  { label: 'Completed',  color: '#2e7d32', bg: 'rgba(46,125,50,0.1)' },
  failed:     { label: 'Failed',     color: '#c62828', bg: 'rgba(198,40,40,0.1)' },
};

function fmt(paise) {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function NotaryEarnings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bank account form
  const [bankForm, setBankForm] = useState({ accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '' });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankSuccess, setBankSuccess] = useState(false);
  const [bankError, setBankError] = useState(null);
  const [editingBank, setEditingBank] = useState(false);

  // Withdrawal dialog
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get('/notaries/me/withdrawals')
      .then(({ data: d }) => {
        setData(d);
        if (d.bankAccount) {
          setBankForm({
            accountHolderName: d.bankAccount.accountHolderName || '',
            accountNumber: '',
            ifscCode: d.bankAccount.ifscCode || '',
            bankName: d.bankAccount.bankName || '',
          });
        }
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load earnings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleBankSave = async () => {
    setBankSaving(true);
    setBankError(null);
    setBankSuccess(false);
    try {
      await api.put('/notaries/bank-account', bankForm);
      setBankSuccess(true);
      setEditingBank(false);
      load();
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
      await api.post('/notaries/withdraw', { amount: amtPaise });
      setWithdrawDialog(false);
      setWithdrawAmount('');
      load();
    } catch (err) {
      setWithdrawError(err.response?.data?.message || 'Withdrawal request failed');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <AnimatedPage>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress sx={{ color: 'var(--color-primary)' }} />
        </Box>
      </AnimatedPage>
    );
  }

  if (error) {
    return (
      <AnimatedPage>
        <Box sx={{ p: 3 }}>
          <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
        </Box>
      </AnimatedPage>
    );
  }

  const withdrawable = data?.withdrawable || 0;
  const hasBankAccount = data?.hasBankAccount;

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 720, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 800, mb: 0.5 }}>
          Earnings & Payouts
        </GradientHeading>
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mb: 3 }}>
          Track your earnings and withdraw to your bank account
        </Typography>

        {/* Summary cards */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Earned', value: fmt(data?.totalEarnings), color: '#2e7d32', icon: '💰' },
            { label: 'Pending (awaiting delivery)', value: fmt(data?.pendingEarnings), color: '#ed6c02', icon: '⏳' },
            { label: 'Withdrawn', value: fmt(data?.withdrawnAmount), color: '#0288d1', icon: '🏦' },
            { label: 'Available to Withdraw', value: fmt(withdrawable), color: withdrawable > 0 ? '#ed6c02' : 'var(--color-text-secondary)', icon: '💳' },
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

        {/* Withdraw button */}
        <GlassCard sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                Request a Payout
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                {hasBankAccount ? 'Processed by admin within 2–3 business days' : 'Add your bank account first'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              disabled={!hasBankAccount || withdrawable < 100}
              onClick={() => { setWithdrawDialog(true); setWithdrawError(null); setWithdrawAmount(''); }}
              sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)', whiteSpace: 'nowrap' }}
            >
              Withdraw Funds
            </Button>
          </Box>
        </GlassCard>

        {/* Bank account section */}
        <GlassCard sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
              🏦 Bank Account
            </Typography>
            {hasBankAccount && !editingBank && (
              <Button size="small" onClick={() => setEditingBank(true)}
                sx={{ color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.75rem' }}>
                Edit
              </Button>
            )}
          </Box>

          {hasBankAccount && !editingBank ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2" sx={{ color: 'var(--color-text)' }}>
                {data.bankAccount.accountHolderName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>
                A/C: {data.bankAccount.maskedAccountNumber}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                {data.bankAccount.bankName} &nbsp;|&nbsp; IFSC: {data.bankAccount.ifscCode}
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
          {data?.withdrawals?.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                No withdrawal requests yet
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {data?.withdrawals?.map((w, i) => {
                const meta = STATUS_META[w.status] || STATUS_META.pending;
                return (
                  <React.Fragment key={w._id}>
                    {i > 0 && <Divider sx={{ my: 1, borderColor: 'var(--color-border)' }} />}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                          {fmt(w.amount)}
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
            Available: <strong>{fmt(withdrawable)}</strong>
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
            Processed to: {data?.bankAccount?.bankName} · {data?.bankAccount?.maskedAccountNumber}
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

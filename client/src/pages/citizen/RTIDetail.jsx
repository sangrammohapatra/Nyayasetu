/**
 * client/src/pages/citizen/RTIDetail.jsx
 *
 * Full detail view for a single RTI application.
 * Shows timeline, current status, all questions, and contextual action buttons:
 *  - Mark as Filed
 *  - Record Response
 *  - Generate + Download First Appeal
 *  - Generate + Download CIC Appeal
 *  - Close / Withdraw
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';

import AnimatedPage from '../../components/ui/AnimatedPage';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import RTIStatusBadge from '../../components/rti/RTIStatusBadge';
import RTITimeline from '../../components/rti/RTITimeline';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

import {
  getRTIDetail,
  markRTIAsFiled,
  updateRTIStatus,
  draftFirstAppeal,
  draftCICAppeal,
  deleteRTI,
  selectCurrentRTI,
  selectRTILoading,
  selectRTIAppealLoading,
  selectRTIError,
} from '../../store/slices/rtiSlice';
import { showSnackbar } from '../../store/slices/uiSlice';
import api from '../../services/api';

// ─── Utility ──────────────────────────────────────────────────────────────────

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

// ─── Countdown banner ─────────────────────────────────────────────────────────

function DeadlineBanner({ rti }) {
  const { daysUntilDeadline: days, deadlineUrgency: urgency, status } = rti;
  if (!['filed', 'first_appeal_due'].includes(status) || days === null) return null;

  const configs = {
    overdue:  { bg: '#FFEBEE', border: '#FFCDD2', color: '#B71C1C', msg: `${Math.abs(days)} day(s) overdue — file First Appeal now`, icon: '🚨' },
    critical: { bg: '#FFF3E0', border: '#FFE0B2', color: '#E65100', msg: `Only ${days} day(s) left`, icon: '⏰' },
    warning:  { bg: '#FFFDE7', border: '#FFF9C4', color: '#F57F17', msg: `${days} days left`,         icon: '⚠️' },
    normal:   { bg: 'var(--color-primary-alpha)', border: 'var(--color-primary)', color: 'var(--color-primary)', msg: `${days} days remaining`, icon: '📅' },
  };

  const cfg = configs[urgency] || configs.normal;

  return (
    <Box sx={{ p: 2, borderRadius: `${RADIUS.lg}px`, background: cfg.bg, border: `1.5px solid ${cfg.border}`, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography sx={{ fontSize: 24 }}>{cfg.icon}</Typography>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 700, color: cfg.color, fontSize: '0.9rem' }}>
          30-Day Response Deadline: {formatDate(rti.responseDeadline)}
        </Typography>
        <Typography sx={{ color: cfg.color, fontSize: '0.8rem' }}>{cfg.msg}</Typography>
      </Box>
    </Box>
  );
}

// ─── Mark as Filed dialog ─────────────────────────────────────────────────────

function MarkFiledDialog({ open, onClose, onSubmit, loading }) {
  const [filedDate, setFiledDate] = useState(new Date().toISOString().split('T')[0]);
  const [ref, setRef] = useState('');
  const [feeMode, setFeeMode] = useState('online');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Mark as Filed</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', mb: 2 }}>
          After filing at rtionline.gov.in or physically, record the details here to start the 30-day countdown.
        </Typography>
        <TextField
          fullWidth label="Date Filed" type="date" value={filedDate}
          onChange={(e) => setFiledDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        />
        <TextField
          fullWidth label="Reference / Acknowledgement Number (optional)" value={ref}
          onChange={(e) => setRef(e.target.value)}
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        />
        <FormControl fullWidth>
          <InputLabel>Payment Mode</InputLabel>
          <Select value={feeMode} label="Payment Mode" onChange={(e) => setFeeMode(e.target.value)} sx={{ borderRadius: `${RADIUS.md}px` }}>
            <MenuItem value="online">Online (RTI Portal)</MenuItem>
            <MenuItem value="ipo">Indian Postal Order</MenuItem>
            <MenuItem value="court_fee_stamp">Court Fee Stamp</MenuItem>
            <MenuItem value="demand_draft">Demand Draft</MenuItem>
            <MenuItem value="free">BPL — Fee Exempt</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: `${RADIUS.md}px` }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!filedDate || loading}
          onClick={() => onSubmit({ filedDate, referenceNumber: ref, feeMode })}
          sx={{ background: 'var(--color-primary)', borderRadius: `${RADIUS.md}px`, fontWeight: 700 }}
        >
          {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Start 30-Day Timer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Record Response dialog ────────────────────────────────────────────────────

function ResponseDialog({ open, onClose, onSubmit, loading }) {
  const [responseDate, setResponseDate] = useState(new Date().toISOString().split('T')[0]);
  const [responseText, setResponseText] = useState('');
  const [satisfactory, setSatisfactory] = useState(true);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Record PIO Response</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth label="Response Date" type="date" value={responseDate}
          onChange={(e) => setResponseDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ mb: 2, mt: 1, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        />
        <TextField
          fullWidth multiline rows={4} label="PIO Response Summary (optional)"
          value={responseText} onChange={(e) => setResponseText(e.target.value)}
          placeholder="Summarize what the PIO said..."
          sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        />
        <FormControlLabel
          control={<Switch checked={satisfactory} onChange={(e) => setSatisfactory(e.target.checked)} />}
          label={satisfactory ? '✅ Response is satisfactory' : '❌ Response is unsatisfactory / incomplete'}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: `${RADIUS.md}px` }}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!responseDate || loading}
          onClick={() => onSubmit({ responseDate, responseText, isResponseSatisfactory: satisfactory, status: satisfactory ? 'response_received' : 'first_appeal_due' })}
          sx={{ background: satisfactory ? '#2E7D32' : '#E65100', borderRadius: `${RADIUS.md}px`, fontWeight: 700 }}
        >
          {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Save Response'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── First Appeal dialog ───────────────────────────────────────────────────────

function AppealDialog({ open, onClose, rtiId, appealContent, onMarkFiled, appealLoading, loading }) {
  const [faaName, setFaaName] = useState('');
  const [faaAddress, setFaaAddress] = useState('');
  const [appealDate, setAppealDate] = useState(new Date().toISOString().split('T')[0]);
  const [appealRef, setAppealRef] = useState('');

  const handleDownload = () => {
    window.open(`/api/rti/${rtiId}/download/first-appeal`);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>First Appeal (Section 19(1))</DialogTitle>
      <DialogContent>
        {appealLoading ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <CircularProgress size={40} sx={{ color: 'var(--color-primary)' }} />
            <Typography sx={{ mt: 2, color: 'var(--color-text-secondary)' }}>AI is drafting your First Appeal...</Typography>
          </Box>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2, borderRadius: `${RADIUS.md}px` }}>
              The First Appeal goes to the <strong>First Appellate Authority (FAA)</strong> — usually a senior officer in the same ministry/department.
            </Alert>
            <TextField fullWidth label="FAA Name / Designation" value={faaName} onChange={(e) => setFaaName(e.target.value)}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
            <TextField fullWidth multiline rows={2} label="FAA Address" value={faaAddress} onChange={(e) => setFaaAddress(e.target.value)}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
            <TextField fullWidth label="Date of Filing Appeal" type="date" value={appealDate} onChange={(e) => setAppealDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
            <TextField fullWidth label="Reference Number (if received)" value={appealRef} onChange={(e) => setAppealRef(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }} />
            <Button
              fullWidth variant="outlined"
              onClick={handleDownload}
              sx={{ mt: 2, borderRadius: `${RADIUS.md}px`, fontWeight: 700, borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
            >
              📥 Download First Appeal PDF
            </Button>
          </>
        )}
      </DialogContent>
      {!appealLoading && (
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={onClose} sx={{ borderRadius: `${RADIUS.md}px` }}>Close</Button>
          <Button
            variant="contained"
            disabled={!appealDate || loading}
            onClick={() => onMarkFiled({ firstAppealFiledDate: appealDate, firstAppealReferenceNumber: appealRef, faaName, faaAddress, status: 'first_appeal_filed' })}
            sx={{ background: 'var(--color-primary)', borderRadius: `${RADIUS.md}px`, fontWeight: 700 }}
          >
            {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Mark First Appeal as Filed'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RTIDetail() {
  const { id }    = useParams();
  const dispatch  = useDispatch();
  const navigate  = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const rti          = useSelector(selectCurrentRTI);
  const loading      = useSelector(selectRTILoading);
  const appealLoading = useSelector(selectRTIAppealLoading);
  const error        = useSelector(selectRTIError);

  const [dialogs, setDialogs] = useState({ filed: false, response: false, firstAppeal: false, cic: false });
  const [appealContent, setAppealContent] = useState(null);
  const [cicContent, setCicContent]       = useState(null);

  useEffect(() => {
    dispatch(getRTIDetail(id));
  }, [dispatch, id]);

  const openDialog = (key) => setDialogs((d) => ({ ...d, [key]: true }));
  const closeDialog = (key) => setDialogs((d) => ({ ...d, [key]: false }));

  const handleMarkFiled = async (payload) => {
    const result = await dispatch(markRTIAsFiled({ rtiId: id, ...payload }));
    if (!result.error) {
      dispatch(showSnackbar({ message: 'RTI marked as filed — 30-day countdown started!', severity: 'success' }));
      closeDialog('filed');
    }
  };

  const handleRecordResponse = async (payload) => {
    const result = await dispatch(updateRTIStatus({ rtiId: id, ...payload }));
    if (!result.error) {
      const msg = payload.isResponseSatisfactory ? 'Response recorded as satisfactory.' : 'Response recorded — you can now file a First Appeal.';
      dispatch(showSnackbar({ message: msg, severity: 'success' }));
      closeDialog('response');
    }
  };

  const handleOpenFirstAppeal = async () => {
    openDialog('firstAppeal');
    if (!appealContent) {
      const result = await dispatch(draftFirstAppeal(id));
      if (result.payload?.appealContent) setAppealContent(result.payload.appealContent);
    }
  };

  const handleMarkFirstAppealFiled = async (payload) => {
    const result = await dispatch(updateRTIStatus({ rtiId: id, ...payload }));
    if (!result.error) {
      dispatch(showSnackbar({ message: 'First Appeal filed — FAA has 30 days to respond.', severity: 'success' }));
      closeDialog('firstAppeal');
    }
  };

  const handleOpenCIC = async () => {
    openDialog('cic');
    if (!cicContent) {
      const result = await dispatch(draftCICAppeal(id));
      if (result.payload?.cicContent) setCicContent(result.payload.cicContent);
    }
  };

  const handleMarkFirstAppealDecided = async (isGoodResult) => {
    await dispatch(updateRTIStatus({ rtiId: id, status: isGoodResult ? 'closed' : 'first_appeal_decided' }));
    dispatch(showSnackbar({ message: isGoodResult ? 'Matter closed.' : 'First appeal decided — you can now file a CIC appeal.', severity: 'success' }));
  };

  const handleClose = async () => {
    if (!window.confirm('Mark this RTI as closed (resolved)?')) return;
    await dispatch(updateRTIStatus({ rtiId: id, status: 'closed' }));
    dispatch(showSnackbar({ message: 'RTI marked as closed.', severity: 'success' }));
  };

  const handleWithdraw = async () => {
    if (!window.confirm('Withdraw this RTI application?')) return;
    await dispatch(updateRTIStatus({ rtiId: id, status: 'withdrawn' }));
    dispatch(showSnackbar({ message: 'RTI withdrawn.', severity: 'info' }));
  };

  const handleDelete = async () => {
    if (!window.confirm('Permanently delete this RTI draft?')) return;
    await dispatch(deleteRTI(id));
    navigate('/citizen/rti');
  };

  if (loading && !rti) {
    return (
      <AnimatedPage>
        <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 840, mx: 'auto' }}>
          <Skeleton variant="rounded" height={140} sx={{ mb: 3, borderRadius: `${RADIUS.xl}px` }} />
          <Skeleton variant="rounded" height={200} sx={{ mb: 3, borderRadius: `${RADIUS.lg}px` }} />
          <Skeleton variant="rounded" height={300} sx={{ borderRadius: `${RADIUS.lg}px` }} />
        </Box>
      </AnimatedPage>
    );
  }

  if (!rti) return null;

  // ─── Contextual actions based on current status ─────────────────────────────
  const actions = {
    canMarkFiled:          rti.status === 'drafted',
    canRecordResponse:     rti.status === 'filed',
    canFileFirstAppeal:    ['first_appeal_due', 'filed'].includes(rti.status),
    canFileFirstAppealBtn: rti.status === 'first_appeal_due',
    canMarkFAAdecided:     rti.status === 'first_appeal_filed',
    canFileCIC:            rti.status === 'first_appeal_decided',
    canClose:              !['closed', 'withdrawn', 'drafted'].includes(rti.status),
    canWithdraw:           !['closed', 'withdrawn'].includes(rti.status),
    canDelete:             rti.status === 'drafted',
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 840, mx: 'auto', pb: { xs: 10, md: 4 } }}>

        {/* Back + title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Button variant="text" onClick={() => navigate('/citizen/rti')}
            sx={{ color: 'var(--color-text-secondary)', minWidth: 0, px: 1 }}>
            ← Back
          </Button>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>RTI Tracker</Typography>
        </Box>

        {/* Hero card */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <GlassCard elevation={1} sx={{ p: { xs: 2, sm: 3 }, mb: 3, border: '1.5px solid var(--color-border)' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <GradientHeading variant="h5" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 0.5, lineHeight: 1.3 }}>
                  {rti.title}
                </GradientHeading>
                <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                  {rti.ministry}
                  {rti.govLevel === 'state' && ` (${rti.state})`}
                </Typography>
              </Box>
              <RTIStatusBadge status={rti.status} size="medium" />
            </Box>

            <DeadlineBanner rti={rti} />

            {/* Key dates */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {rti.filedDate && (
                <Chip label={`Filed: ${formatDate(rti.filedDate)}`} size="small"
                  sx={{ background: 'var(--color-overlay)', fontSize: '0.72rem' }} />
              )}
              {rti.responseDeadline && rti.status === 'filed' && (
                <Chip label={`Deadline: ${formatDate(rti.responseDeadline)}`} size="small"
                  sx={{ background: 'rgba(230,81,0,0.1)', color: '#E65100', border: '1px solid rgba(230,81,0,0.3)', fontSize: '0.72rem', fontWeight: 700 }} />
              )}
              {rti.referenceNumber && (
                <Chip label={`Ref: ${rti.referenceNumber}`} size="small"
                  sx={{ background: 'var(--color-overlay)', fontSize: '0.72rem' }} />
              )}
            </Box>
          </GlassCard>
        </motion.div>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>

          {/* Timeline */}
          <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <GlassCard elevation={0} sx={{ p: 2.5, border: '1.5px solid var(--color-border)', height: '100%' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 2, color: 'var(--color-text)' }}>
                📊 RTI Progress
              </Typography>
              <RTITimeline
                status={rti.status}
                filedDate={rti.filedDate}
                responseDeadline={rti.responseDeadline}
                firstAppealFiledDate={rti.firstAppealFiledDate}
                cicFiledDate={rti.cicFiledDate}
              />
            </GlassCard>
          </motion.div>

          {/* Actions */}
          <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <GlassCard elevation={0} sx={{ p: 2.5, border: '1.5px solid var(--color-border)', height: '100%' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 2, color: 'var(--color-text)' }}>
                ⚡ Actions
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {/* Download PDF */}
                <Button
                  variant="outlined" fullWidth
                  onClick={() => window.open(`/api/rti/${id}/download/application`)}
                  sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                >
                  📥 Download RTI Application PDF
                </Button>

                {actions.canMarkFiled && (
                  <Button variant="contained" fullWidth onClick={() => openDialog('filed')}
                    sx={{ background: '#1565C0', borderRadius: `${RADIUS.md}px`, fontWeight: 700 }}>
                    📬 Mark as Filed → Start 30-Day Timer
                  </Button>
                )}

                {actions.canRecordResponse && (
                  <Button variant="contained" fullWidth onClick={() => openDialog('response')}
                    sx={{ background: '#2E7D32', borderRadius: `${RADIUS.md}px`, fontWeight: 700 }}>
                    📄 Record PIO Response
                  </Button>
                )}

                {actions.canFileFirstAppealBtn && (
                  <Button variant="contained" fullWidth onClick={handleOpenFirstAppeal}
                    sx={{ background: '#E65100', borderRadius: `${RADIUS.md}px`, fontWeight: 700 }}>
                    ⚖️ Generate & File First Appeal
                  </Button>
                )}

                {rti.status === 'first_appeal_filed' && (
                  <>
                    <Button variant="outlined" fullWidth onClick={() => window.open(`/api/rti/${id}/download/first-appeal`)}
                      sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: '#E65100', color: '#E65100' }}>
                      📥 Download First Appeal PDF
                    </Button>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button variant="outlined" fullWidth size="small" onClick={() => handleMarkFirstAppealDecided(false)}
                        sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600 }}>
                        FAA decided (unsatisfactory)
                      </Button>
                      <Button variant="contained" size="small" fullWidth onClick={() => handleMarkFirstAppealDecided(true)}
                        sx={{ background: '#2E7D32', borderRadius: `${RADIUS.md}px`, fontWeight: 700 }}>
                        ✅ Resolved!
                      </Button>
                    </Box>
                  </>
                )}

                {actions.canFileCIC && (
                  <Button variant="contained" fullWidth onClick={handleOpenCIC}
                    sx={{ background: '#B71C1C', borderRadius: `${RADIUS.md}px`, fontWeight: 700 }}>
                    🏛️ Generate & File CIC Second Appeal
                  </Button>
                )}

                {rti.status === 'cic_filed' && (
                  <Button variant="outlined" fullWidth onClick={() => window.open(`/api/rti/${id}/download/cic-appeal`)}
                    sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: '#B71C1C', color: '#B71C1C' }}>
                    📥 Download CIC Appeal PDF
                  </Button>
                )}

                <Divider sx={{ borderColor: 'var(--color-border)' }} />

                {actions.canClose && (
                  <Button variant="outlined" fullWidth size="small" onClick={handleClose}
                    sx={{ borderRadius: `${RADIUS.md}px`, borderColor: '#2E7D32', color: '#2E7D32' }}>
                    ✅ Mark as Closed / Resolved
                  </Button>
                )}
                {actions.canWithdraw && (
                  <Button variant="text" fullWidth size="small" onClick={handleWithdraw}
                    sx={{ borderRadius: `${RADIUS.md}px`, color: 'var(--color-text-secondary)' }}>
                    Withdraw Application
                  </Button>
                )}
                {actions.canDelete && (
                  <Button variant="text" fullWidth size="small" onClick={handleDelete}
                    sx={{ borderRadius: `${RADIUS.md}px`, color: 'var(--color-error)' }}>
                    Delete Draft
                  </Button>
                )}
              </Box>
            </GlassCard>
          </motion.div>
        </Box>

        {/* Questions */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <GlassCard elevation={0} sx={{ p: 2.5, border: '1.5px solid var(--color-border)', mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 2 }}>
              📝 RTI Questions ({rti.subjects?.length || 0})
            </Typography>
            {rti.subjects?.map((q, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: '2px' }}>
                  {i + 1}
                </Box>
                <Typography sx={{ fontSize: '0.87rem', lineHeight: 1.6 }}>{q}</Typography>
              </Box>
            ))}
          </GlassCard>
        </motion.div>

        {/* PIO Details */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <GlassCard elevation={0} sx={{ p: 2.5, border: '1.5px solid var(--color-border)', mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.5 }}>🏛️ PIO Details</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              {[
                ['Ministry / Dept', rti.ministry],
                ['PIO Designation', rti.pioDesignation || 'Public Information Officer'],
                ['PIO Email', rti.pioEmail || '—'],
                ['Gov Level', rti.govLevel === 'central' ? 'Central Government' : `State — ${rti.state || ''}`],
              ].map(([label, val]) => (
                <Box key={label}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>{label}</Typography>
                  <Typography sx={{ fontSize: '0.85rem' }}>{val}</Typography>
                </Box>
              ))}
              <Box sx={{ gridColumn: '1 / -1' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text-secondary)' }}>PIO Address</Typography>
                <Typography sx={{ fontSize: '0.85rem', whiteSpace: 'pre-line' }}>{rti.pioAddress}</Typography>
              </Box>
            </Box>
          </GlassCard>
        </motion.div>

        {/* Notes */}
        {rti.notes && (
          <GlassCard elevation={0} sx={{ p: 2.5, border: '1.5px solid var(--color-border)' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>📌 Notes</Typography>
            <Typography sx={{ fontSize: '0.87rem', color: 'var(--color-text-secondary)', whiteSpace: 'pre-line' }}>{rti.notes}</Typography>
          </GlassCard>
        )}
      </Box>

      {/* Dialogs */}
      <MarkFiledDialog open={dialogs.filed} onClose={() => closeDialog('filed')} onSubmit={handleMarkFiled} loading={loading} />
      <ResponseDialog open={dialogs.response} onClose={() => closeDialog('response')} onSubmit={handleRecordResponse} loading={loading} />
      <AppealDialog
        open={dialogs.firstAppeal}
        onClose={() => closeDialog('firstAppeal')}
        rtiId={id}
        appealContent={appealContent}
        onMarkFiled={handleMarkFirstAppealFiled}
        appealLoading={appealLoading}
        loading={loading}
      />

      {/* CIC Dialog */}
      <Dialog open={dialogs.cic} onClose={() => closeDialog('cic')} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>CIC Second Appeal (Section 19(3))</DialogTitle>
        <DialogContent>
          {appealLoading ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <CircularProgress size={40} sx={{ color: '#B71C1C' }} />
              <Typography sx={{ mt: 2, color: 'var(--color-text-secondary)' }}>AI is drafting your CIC Appeal...</Typography>
            </Box>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 2, borderRadius: `${RADIUS.md}px` }}>
                CIC appeals are filed at <strong>cic.gov.in</strong>. The Commission can impose penalties of ₹250/day on the PIO.
              </Alert>
              <Button fullWidth variant="outlined" onClick={() => window.open(`/api/rti/${id}/download/cic-appeal`)}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, borderColor: '#B71C1C', color: '#B71C1C' }}>
                📥 Download CIC Appeal PDF
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => closeDialog('cic')} sx={{ borderRadius: `${RADIUS.md}px` }}>Close</Button>
          {!appealLoading && (
            <Button variant="contained" disabled={loading}
              onClick={async () => {
                await dispatch(updateRTIStatus({ rtiId: id, status: 'cic_filed', cicFiledDate: new Date().toISOString() }));
                dispatch(showSnackbar({ message: 'CIC appeal marked as filed.', severity: 'success' }));
                closeDialog('cic');
              }}
              sx={{ background: '#B71C1C', borderRadius: `${RADIUS.md}px`, fontWeight: 700 }}>
              {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Mark CIC Appeal as Filed'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </AnimatedPage>
  );
}

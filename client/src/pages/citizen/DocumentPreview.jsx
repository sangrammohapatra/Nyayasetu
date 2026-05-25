/**
 * client/src/pages/citizen/DocumentPreview.jsx
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import {
  getDocument, getPDF, shareDocument,
  selectCurrentDocument, selectDocumentError, clearDocumentError,
} from '../../store/slices/documentSlice';
import { selectUserPlan } from '../../store/slices/authSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import ClauseExplainer from '../../components/document/ClauseExplainer';
import FeatureGate from '../../components/ui/FeatureGate';
import GlassCard from '../../components/ui/GlassCard';
import { openCheckout } from '../../services/razorpay';
import { RADIUS, SHADOWS } from '../../theme/tokens';
import api from '../../services/api';

/* ---------------------------------------------------------------------------
 * Pulse skeleton — shown while document is still generating
 * ------------------------------------------------------------------------ */
function GeneratingSkeleton() {
  const { t } = useTranslation();
  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <Typography sx={{ fontSize: 40 }}>⚖️</Typography>
        </motion.div>
        <Box>
          <Skeleton variant="text" width={220} height={28} />
          <Skeleton variant="text" width={140} height={18} sx={{ mt: 0.5 }} />
        </Box>
      </Box>
      {[100, 80, 95, 70, 85].map((w, i) => (
        <Skeleton key={i} variant="text" width={`${w}%`} height={18}
          sx={{ mt: i === 0 ? 0 : 1.5, borderRadius: 1 }} />
      ))}
      <Skeleton variant="rectangular" width="100%" height={100} sx={{ mt: 3, borderRadius: 2 }} />
      {[90, 75, 88].map((w, i) => (
        <Skeleton key={i} variant="text" width={`${w}%`} height={18} sx={{ mt: 1.5 }} />
      ))}
      <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }}
        />
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
          {t('preview.generating', 'AI is generating your document…')}
        </Typography>
      </Box>
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * Document text renderer — makes clauses clickable
 * ------------------------------------------------------------------------ */
function DocumentText({ content, onClauseClick }) {
  if (!content) return null;

  const paragraphs = content.split(/\n{2,}/).filter(Boolean);
  let clauseIndex = 0;

  return (
    <Box sx={{ fontFamily: "'DM Sans', sans-serif" }}>
      {paragraphs.map((para, pIdx) => {
        const isClause = /^\d+\.|^[IVX]+\./.test(para.trim());
        const thisIndex = isClause ? clauseIndex++ : null;

        return (
          <motion.div
            key={pIdx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: pIdx * 0.04, duration: 0.3 }}
          >
            {isClause ? (
              <Box
                onClick={(e) => onClauseClick(e, thisIndex, para.trim())}
                sx={{
                  p: 1.75, mb: 1.5,
                  borderRadius: `${RADIUS.md}px`,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, background 0.15s',
                  '&:hover': {
                    borderColor: 'var(--color-primary)',
                    background: 'var(--color-primary-alpha)',
                  },
                }}
              >
                <Typography variant="body2" sx={{ lineHeight: 1.7, color: 'var(--color-text)' }}>
                  {para.trim()}
                </Typography>
                <Typography variant="caption" sx={{
                  color: 'var(--color-primary)', fontWeight: 600, mt: 0.5, display: 'block',
                }}>
                  💡 Tap to explain in simple terms
                </Typography>
              </Box>
            ) : /^#+\s/.test(para.trim()) ? (
              <Typography variant="h6" sx={{
                fontFamily: "'Playfair Display',serif", fontWeight: 700,
                color: 'var(--color-text)', mt: pIdx > 0 ? 3 : 0, mb: 1.5,
              }}>
                {para.replace(/^#+\s/, '')}
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ lineHeight: 1.7, color: 'var(--color-text)', mb: 1.5 }}>
                {para.trim()}
              </Typography>
            )}
          </motion.div>
        );
      })}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * Right panel — Citations + Next Steps + Actions
 * ------------------------------------------------------------------------ */
function RightPanel({ document: doc, onDownload, onShare, onConnectLawyer, plan }) {
  const { t } = useTranslation();
  const isPaid = doc?.isPaid || plan === 'basic' || plan === 'pro';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Actions */}
      <GlassCard sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
          📋 {t('preview.actions', 'Document Actions')}
        </Typography>

        {isPaid ? (
          <Button fullWidth variant="contained" onClick={onDownload}
            sx={{
              mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700,
              background: 'var(--color-primary)',
              '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
            }}>
            📥 {t('preview.downloadPDF', 'Download PDF')}
          </Button>
        ) : (
          <Button fullWidth variant="contained" onClick={onDownload}
            sx={{
              mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700,
              background: 'var(--color-warning)',
              '&:hover': { background: 'var(--color-warning)' },
            }}>
            🔒 {t('preview.upgradePDF', 'Upgrade to Download PDF')}
          </Button>
        )}

        <Button fullWidth variant="outlined" onClick={onShare}
          sx={{
            borderRadius: `${RADIUS.md}px`, fontWeight: 600,
            borderColor: 'var(--color-border)', color: 'var(--color-text)',
            '&:hover': { borderColor: 'var(--color-primary)', background: 'var(--color-primary-alpha)' },
          }}>
          🔗 {t('preview.share', 'Copy Share Link')}
        </Button>
      </GlassCard>

      {/* Legal citations */}
      {doc?.legalCitations?.length > 0 && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1 }}>
            📚 {t('preview.citations', 'Legal Citations')}
          </Typography>
          {doc.legalCitations.map((cite, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}>
              <Accordion elevation={0} sx={{
                mb: 0.75, borderRadius: `${RADIUS.md}px !important`,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                '&:before': { display: 'none' },
                overflow: 'hidden',
              }}>
                <AccordionSummary
                  expandIcon={<Typography sx={{ fontSize: 14 }}>▾</Typography>}
                  sx={{ py: 0.5, minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.75 } }}
                >
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-primary)', display: 'block' }}>
                      {cite.act}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                      {cite.section}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                  <Typography variant="caption" sx={{ color: 'var(--color-text)', lineHeight: 1.55, display: 'block' }}>
                    {cite.description}
                  </Typography>
                  {cite.url && (
                    <Typography
                      component="a" href={cite.url} target="_blank" rel="noopener noreferrer"
                      variant="caption"
                      sx={{ color: 'var(--color-primary)', display: 'block', mt: 0.5, textDecoration: 'underline' }}>
                      View on Indian Kanoon →
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            </motion.div>
          ))}
        </Box>
      )}

      {/* Next steps */}
      {doc?.nextSteps?.length > 0 && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
            🗺️ {t('preview.nextSteps', 'What to Do Next')}
          </Typography>
          <Stepper orientation="vertical" sx={{ '& .MuiStepConnector-line': { borderColor: 'var(--color-border)' } }}>
            {doc.nextSteps.map((step, i) => (
              <Step key={i} active>
                <StepLabel
                  StepIconProps={{
                    sx: {
                      color: 'var(--color-primary)',
                      '&.Mui-active': { color: 'var(--color-primary)' },
                    },
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {step.instruction}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Box sx={{ pb: 1 }}>
                    {step.authority && (
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
                        📍 {step.authority}
                      </Typography>
                    )}
                    {step.fee && (
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
                        💰 Fee: {step.fee}
                      </Typography>
                    )}
                    {step.timelineExpected && (
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
                        ⏱ {step.timelineExpected}
                      </Typography>
                    )}
                    {step.onlineLink && (
                      <Typography component="a" href={step.onlineLink} target="_blank" rel="noopener noreferrer"
                        variant="caption" sx={{ color: 'var(--color-primary)', textDecoration: 'underline', display: 'block' }}>
                        Apply online →
                      </Typography>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}

      {/* Lawyer CTA */}
      <GlassCard sx={{ p: 2, border: '1.5px solid var(--color-primary) !important' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 0.75 }}>
          👨‍⚖️ {t('preview.lawyerCTA', 'Get Expert Review')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 1.5, lineHeight: 1.55 }}>
          {t('preview.lawyerDesc', 'A verified advocate can review this document for just ₹499.')}
        </Typography>
        <Button fullWidth variant="outlined" onClick={onConnectLawyer} size="small"
          sx={{
            borderRadius: `${RADIUS.md}px`, fontWeight: 600, fontSize: '0.8rem',
            borderColor: 'var(--color-primary)', color: 'var(--color-primary)',
            '&:hover': { background: 'var(--color-primary-alpha)' },
          }}>
          {t('preview.findLawyer', 'Connect with a Lawyer')}
        </Button>
      </GlassCard>
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------------ */
function DocumentPreview() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const doc = useSelector(selectCurrentDocument);
  const plan = useSelector(selectUserPlan);
  const docError = useSelector(selectDocumentError);

  const [mobileTab, setMobileTab] = useState(0);
  const [clauseAnchor, setClauseAnchor] = useState(null);
  const [activeClauseIndex, setActiveClauseIndex] = useState(null);
  const [activeClauseText, setActiveClauseText] = useState('');
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const pollRef = useRef(null);

  const isGenerating = !doc || doc.status === 'generating' || doc.status === 'active';

  // Load document & poll while generating
  useEffect(() => {
    dispatch(getDocument(documentId));

    const startPoll = () => {
      pollRef.current = setInterval(() => {
        dispatch(getDocument(documentId));
      }, 2000);
    };

    startPoll();
    return () => clearInterval(pollRef.current);
  }, [documentId, dispatch]);

  // Stop polling once document is complete
  useEffect(() => {
    if (doc && doc.status === 'completed') {
      clearInterval(pollRef.current);
    }
  }, [doc]);

  const handleClauseClick = useCallback((event, index, text) => {
    setClauseAnchor(event.currentTarget);
    setActiveClauseIndex(index);
    setActiveClauseText(text);
  }, []);

  const handleClauseClose = () => {
    setClauseAnchor(null);
    setActiveClauseIndex(null);
  };

  const handleDownload = async () => {
    const isPaid = doc?.isPaid || plan === 'basic' || plan === 'pro';
    if (isPaid) {
      try {
        const result = await dispatch(getPDF(documentId));
        if (result.payload?.pdfUrl) {
          window.open(result.payload.pdfUrl, '_blank');
        }
      } catch (_) {}
    } else {
      // Open Razorpay checkout for pay-per-doc
      try {
        const { data } = await api.post('/payments/create-order', { documentId });
        openCheckout({
          orderId: data.orderId,
          amount: data.amount,
          currency: 'INR',
          name: 'NyayaSetu',
          description: `PDF — ${doc?.title}`,
          onSuccess: async (response) => {
            await api.post('/payments/verify', {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              documentId,
            });
            dispatch(getDocument(documentId));
            setSnack({ open: true, msg: 'Payment successful! Your PDF is ready.', severity: 'success' });
          },
          onDismiss: () => {},
        });
      } catch (err) {
        setSnack({ open: true, msg: 'Could not initiate payment. Please try again.', severity: 'error' });
      }
    }
  };

  const handleShare = async () => {
    const result = await dispatch(shareDocument(documentId));
    if (result.payload?.shareUrl) {
      navigator.clipboard.writeText(result.payload.shareUrl).catch(() => {});
      setSnack({ open: true, msg: 'Share link copied to clipboard!', severity: 'success' });
    }
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 }, maxWidth: 1200, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              onClick={() => navigate('/citizen/documents')}
              sx={{ cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1.1rem', lineHeight: 1 }}>
              ←
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant={isMobile ? 'h6' : 'h5'} sx={{
                fontFamily: "'Playfair Display',serif", fontWeight: 700, color: 'var(--color-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {doc?.title || t('preview.loading', 'Loading document…')}
              </Typography>
              {doc?.createdAt && (
                <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                  {new Date(doc.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                  {doc.isPaid && <Chip label="✓ PAID" size="small" sx={{ ml: 1, height: 16, fontSize: '0.62rem', background: 'rgba(46,125,50,0.12)', color: 'var(--color-success)' }} />}
                </Typography>
              )}
            </Box>
          </Box>
        </motion.div>

        {/* Mobile tabs */}
        {isMobile && doc?.status === 'completed' && (
          <Tabs value={mobileTab} onChange={(_, v) => setMobileTab(v)} sx={{
            mb: 2, borderBottom: '1px solid var(--color-border)',
            '& .MuiTab-root': { fontSize: '0.78rem', fontWeight: 600, textTransform: 'none', color: 'var(--color-text-secondary)', minWidth: 0, px: 1.5 },
            '& .Mui-selected': { color: 'var(--color-primary)' },
            '& .MuiTabs-indicator': { background: 'var(--color-primary)' },
          }}>
            <Tab label={t('preview.tabDoc', '📄 Document')} />
            <Tab label={t('preview.tabCitations', '📚 Citations')} />
            <Tab label={t('preview.tabSteps', '🗺️ Next Steps')} />
          </Tabs>
        )}

        {isGenerating ? (
          <GeneratingSkeleton />
        ) : isMobile ? (
          /* Mobile: single column with tabs */
          <Box>
            {mobileTab === 0 && (
              <Box sx={{ p: 2, background: 'var(--color-surface)', borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)' }}>
                <DocumentText content={doc.content} onClauseClick={handleClauseClick} />
                <Box sx={{ mt: 3 }}>
                  <Button fullWidth variant="contained" onClick={handleDownload}
                    sx={{ mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
                    {doc.isPaid || plan !== 'free' ? '📥 Download PDF' : '🔒 Upgrade to Download'}
                  </Button>
                  <Button fullWidth variant="outlined" onClick={handleShare}
                    sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                    🔗 Copy Share Link
                  </Button>
                </Box>
              </Box>
            )}
            {mobileTab === 1 && (
              <Box>
                {(doc.legalCitations || []).map((cite, i) => (
                  <Box key={i} sx={{ p: 2, mb: 1.5, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-primary)' }}>{cite.act} — {cite.section}</Typography>
                    <Typography variant="caption" sx={{ color: 'var(--color-text)', display: 'block', mt: 0.5 }}>{cite.description}</Typography>
                  </Box>
                ))}
              </Box>
            )}
            {mobileTab === 2 && (
              <RightPanel document={doc} onDownload={handleDownload} onShare={handleShare}
                onConnectLawyer={() => navigate('/citizen/lawyers')} plan={plan} />
            )}
          </Box>
        ) : (
          /* Desktop: two-column layout */
          <Grid container spacing={3}>
            <Grid item md={8}>
              <Box sx={{
                p: { sm: 3, md: 4 },
                background: 'var(--color-surface)', borderRadius: `${RADIUS.xl}px`,
                border: '1px solid var(--color-border)', boxShadow: SHADOWS.sm,
              }}>
                <DocumentText content={doc?.content} onClauseClick={handleClauseClick} />
              </Box>
            </Grid>
            <Grid item md={4}>
              <Box sx={{ position: 'sticky', top: 80 }}>
                <RightPanel document={doc} onDownload={handleDownload} onShare={handleShare}
                  onConnectLawyer={() => navigate('/citizen/lawyers')} plan={plan} />
              </Box>
            </Grid>
          </Grid>
        )}

        {/* Clause explainer popover */}
        <ClauseExplainer
          anchorEl={clauseAnchor}
          onClose={handleClauseClose}
          documentId={documentId}
          clauseIndex={activeClauseIndex}
          clauseText={activeClauseText}
        />

        {/* Snackbar feedback */}
        <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack((s) => ({ ...s, open: false }))}
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

export default DocumentPreview;

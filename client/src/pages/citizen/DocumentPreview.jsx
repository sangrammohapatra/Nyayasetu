/**
 * client/src/pages/citizen/DocumentPreview.jsx
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

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
  getDocument, getPDF, shareDocument, regenerateDocument, updateApprovalStatus,
  selectCurrentDocument, selectDocumentError, clearDocumentError, selectPdfUrlExpiresAt,
} from '../../store/slices/documentSlice';
import { selectUserPlan } from '../../store/slices/authSlice';
import {
  getDocumentNotarizationStatus,
  verifyNotarizationPayment,
  selectDocumentNotarizationStatus,
} from '../../store/slices/notarySlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import ClauseExplainer from '../../components/document/ClauseExplainer';
import { useOfflineDocuments } from '../../hooks/useOfflineDocuments';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import FeatureGate from '../../components/ui/FeatureGate';
import GlassCard from '../../components/ui/GlassCard';
import GradientHeading from '../../components/ui/GradientHeading';
import ConsultationChat from '../../components/consultation/ConsultationChat';
import NotarizationBooking from '../../components/notary/NotarizationBooking';
import StampDutyCalculator from '../../components/document/StampDutyCalculator';
import { TYPOGRAPHY } from '../../theme/tokens';
import { openCheckout } from '../../services/razorpay';
import { RADIUS, SHADOWS } from '../../theme/tokens';
import api from '../../services/api';
import socketService from '../../services/socket';
import { NOTARIZATION_FEE_DISPLAY } from '../../constants/notarization';

// ─── Approval status meta ─────────────────────────────────────────────────────

const APPROVAL_META = {
  draft:              { label: 'Draft',            bg: 'rgba(117,117,117,0.12)', color: '#757575' },
  shared_with_lawyer: { label: 'Shared w/ Lawyer', bg: 'rgba(237,108,2,0.12)',   color: '#ed6c02' },
  under_review:       { label: 'Under Review',     bg: 'rgba(2,136,209,0.12)',   color: '#0288d1' },
  lawyer_reviewed:    { label: 'Lawyer Reviewed',  bg: 'rgba(46,125,50,0.12)',   color: '#2e7d32' },
  finalized:          { label: 'Finalized',        bg: 'rgba(46,125,50,0.18)',   color: '#1b5e20' },
};

/* ---------------------------------------------------------------------------
 * Pulse skeleton — shown while document is still generating
 * ------------------------------------------------------------------------ */
function GeneratingSkeleton() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  return (
    <Box sx={{ p: { xs: 2, sm: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <motion.div animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.4, repeat: Infinity }}>
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
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }}
        />
        <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
          {t('myDocs.generating', 'AI is generating your document…')}
        </Typography>
      </Box>
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * AI Review Banner — Pass 2 self-review results
 * ------------------------------------------------------------------------ */
const SEVERITY_COLOR = {
  critical: '#d32f2f',
  warning:  '#ed6c02',
  info:     '#0288d1',
};
const SEVERITY_DOT = { critical: '🔴', warning: '🟡', info: '🔵' };

function ReviewBanner({ aiReview, onDismiss }) {
  const issues      = aiReview?.issues || [];
  const hasCritical = issues.some((i) => i.severity === 'critical');
  const headerColor = hasCritical ? '#d32f2f' : '#ed6c02';

  if (issues.length === 0) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.25, mb: 2,
        borderRadius: `${RADIUS.lg}px`,
        background: 'rgba(46,125,50,0.07)',
        border: '1px solid rgba(46,125,50,0.25)',
      }}>
        <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 600, flex: 1 }}>
          ✅ AI self-review passed — document looks complete and jurisdiction-accurate
        </Typography>
        <Box onClick={onDismiss} sx={{ cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1rem', lineHeight: 1, px: 0.5 }}>×</Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      mb: 2.5,
      borderRadius: `${RADIUS.lg}px`,
      border: `1.5px solid ${headerColor}`,
      overflow: 'hidden',
      background: 'var(--color-surface)',
    }}>
      <Box sx={{
        px: 2, py: 1.5,
        background: hasCritical ? 'rgba(211,47,47,0.06)' : 'rgba(237,108,2,0.06)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'flex-start', gap: 1.5,
      }}>
        <Typography sx={{ fontSize: '1.15rem', lineHeight: 1, mt: '1px' }}>
          {hasCritical ? '⚠️' : '📋'}
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: headerColor, mb: 0.25 }}>
            AI Self-Review: {hasCritical ? 'Action Required Before Filing' : 'Review Recommended'}
          </Typography>
          {aiReview?.summary && (
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.45 }}>
              {aiReview.summary}
            </Typography>
          )}
        </Box>
        <Box onClick={onDismiss} sx={{ cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1.1rem', lineHeight: 1, px: 0.5, mt: '-2px' }}>×</Box>
      </Box>

      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {issues.map((issue, i) => (
          <Box key={i} sx={{
            p: 1.25,
            borderRadius: `${RADIUS.md}px`,
            borderLeft: `3px solid ${SEVERITY_COLOR[issue.severity] || '#757575'}`,
            background: issue.severity === 'critical'
              ? 'rgba(211,47,47,0.04)'
              : issue.severity === 'warning'
              ? 'rgba(237,108,2,0.04)'
              : 'rgba(2,136,209,0.04)',
          }}>
            <Typography variant="caption" sx={{
              fontWeight: 700, display: 'block', mb: 0.25,
              color: SEVERITY_COLOR[issue.severity] || '#757575',
              textTransform: 'capitalize',
            }}>
              {SEVERITY_DOT[issue.severity]} {issue.category.replace('_', ' ')}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text)', display: 'block', lineHeight: 1.5 }}>
              {issue.description}
            </Typography>
            {issue.suggestion && (
              <Typography variant="caption" sx={{
                color: 'var(--color-text-secondary)', display: 'block',
                lineHeight: 1.5, mt: 0.25, fontStyle: 'italic',
              }}>
                → {issue.suggestion}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * Document text renderer — makes clauses clickable
 * ------------------------------------------------------------------------ */
function DocumentText({ content, onClauseClick, activeClauseIndex = null }) {
  const prefersReducedMotion = useReducedMotion();
  if (!content) return null;

  const paragraphs = content.split(/\n{2,}/).filter(Boolean);
  let clauseIndex = 0;

  return (
    <Box sx={{ fontFamily: "'DM Sans', sans-serif" }}>
      {paragraphs.map((para, pIdx) => {
        const isClause = /^\d+\.|^[IVX]+\./.test(para.trim());
        const thisIndex = isClause ? clauseIndex++ : null;
        const isActive = isClause && activeClauseIndex === thisIndex;

        return (
          <motion.div
            key={pIdx}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: pIdx * 0.04, duration: 0.3 }}
          >
            {isClause ? (
              <Box
                onClick={(e) => onClauseClick(e, thisIndex, para.trim())}
                sx={{
                  p: 1.75, mb: 1.5,
                  borderRadius: `${RADIUS.md}px`,
                  border: isActive ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                  borderLeft: isActive ? '3px solid var(--color-primary)' : '1px solid var(--color-border)',
                  background: isActive ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
                  cursor: 'pointer',
                  transition: 'border-color 0.3s, background 0.3s, border-left-width 0.3s',
                  '&:hover': {
                    borderColor: 'var(--color-primary)',
                    borderLeft: '3px solid var(--color-primary)',
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
                fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700,
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
// Derives a display label from both request status AND payment status
function notarizationStatusLabel(req) {
  if (!req) return null;
  if (req.status === 'accepted' && req.payment?.status !== 'paid') {
    return { label: `Notary Accepted — Pay ${NOTARIZATION_FEE_DISPLAY} to Confirm`, color: '#ff6d00', bg: 'rgba(255,109,0,0.1)' };
  }
  const map = {
    pending:       { label: 'Awaiting Notary Acceptance', color: '#ed6c02', bg: 'rgba(237,108,2,0.1)' },
    accepted:      { label: 'Paid — KYC Being Scheduled',  color: '#0288d1', bg: 'rgba(2,136,209,0.1)' },
    kyc_scheduled: { label: 'Video KYC Scheduled',         color: '#7b1fa2', bg: 'rgba(123,31,162,0.1)' },
    kyc_completed: { label: 'KYC Done — Stamping Soon',    color: '#00897b', bg: 'rgba(0,137,123,0.1)' },
    stamped:       { label: 'Notarized ✓',                 color: '#2e7d32', bg: 'rgba(46,125,50,0.1)' },
    dispatched:    { label: 'Notarized + Dispatched ✓',    color: '#1b5e20', bg: 'rgba(27,94,32,0.1)' },
  };
  return map[req.status] || { label: req.status, color: '#757575', bg: 'rgba(0,0,0,0.05)' };
}

function RightPanel({ document: doc, onDownload, downloading, onShare, onRegenerate, regenerating, onSign, signing, onDownloadSigned, onConnectLawyer, onOpenChat, linkedConsultation, plan, onNotarize, onPayNotarization, payingNotarization, notarizationRequest, onSaveOffline, savedOffline, isOnline, onFinalize, finalizing }) {
  const { t } = useTranslation();
  const isPaid = doc?.isPaid || plan === 'basic' || plan === 'pro';
  const approvalMeta = APPROVAL_META[doc?.approvalStatus] || APPROVAL_META.draft;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Approval status */}
      {doc?.approvalStatus && doc.approvalStatus !== 'draft' && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          p: 1.5, borderRadius: `${RADIUS.lg}px`,
          background: approvalMeta.bg, border: `1px solid ${approvalMeta.color}22`,
        }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: approvalMeta.color }}>
            {approvalMeta.label}
          </Typography>
          {doc.approvalStatus === 'lawyer_reviewed' && (
            <Chip label="Lawyer reviewed ✓" size="small"
              sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, background: 'rgba(46,125,50,0.15)', color: '#2e7d32' }} />
          )}
        </Box>
      )}

      {/* Lawyer annotations summary */}
      {doc?.lawyerAnnotations?.length > 0 && (
        <GlassCard sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1 }}>
            📝 Lawyer Notes ({doc.lawyerAnnotations.length})
          </Typography>
          {doc.lawyerAnnotations.slice(0, 2).map((ann, i) => (
            <Box key={i} sx={{
              p: 1.25, mb: 0.75, borderRadius: `${RADIUS.md}px`,
              background: 'rgba(237,108,2,0.05)', borderLeft: '3px solid #ed6c02',
            }}>
              <Typography variant="caption" sx={{ color: 'var(--color-text)', lineHeight: 1.5, display: 'block' }}>
                {ann.note.slice(0, 120)}{ann.note.length > 120 ? '…' : ''}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                — {ann.lawyerName}
              </Typography>
            </Box>
          ))}
          {doc.lawyerAnnotations.length > 2 && (
            <Typography variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              +{doc.lawyerAnnotations.length - 2} more notes
            </Typography>
          )}
        </GlassCard>
      )}

      {/* Lawyer's edited version notice */}
      {doc?.lawyerEditedContent && (
        <Box sx={{
          p: 1.5, borderRadius: `${RADIUS.lg}px`,
          background: 'rgba(2,136,209,0.08)', border: '1px solid rgba(2,136,209,0.25)',
        }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#0288d1', display: 'block', mb: 0.5 }}>
            ✏️ Lawyer edited this document
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            A revised version is available from your lawyer.
          </Typography>
          {doc.approvalStatus === 'lawyer_reviewed' && (
            <Button
              size="small" variant="outlined" fullWidth
              onClick={onFinalize}
              disabled={finalizing}
              sx={{
                mt: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700, fontSize: '0.78rem',
                borderColor: '#2e7d32', color: '#2e7d32',
                '&:hover': { background: 'rgba(46,125,50,0.08)' },
                '&.Mui-disabled': { opacity: 0.6 },
              }}
            >
              {finalizing ? '⏳ Finalizing…' : '✓ Finalize Document'}
            </Button>
          )}
        </Box>
      )}

      {/* Actions */}
      <GlassCard sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
          📋 {t('myDocs.actions', 'Document Actions')}
        </Typography>

        {isPaid ? (
          <Button fullWidth variant="contained" onClick={onDownload} disabled={downloading}
            sx={{
              mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700,
              background: 'var(--color-primary)',
              '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
            }}>
            📥 {t('myDocs.download_pdf', 'Download PDF')}
          </Button>
        ) : (
          <Button fullWidth variant="contained" onClick={onDownload} disabled={downloading}
            sx={{
              mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700,
              background: 'var(--color-warning)',
              '&:hover': { background: 'var(--color-warning)' },
            }}>
            🔒 {t('myDocs.upgrade_to_download', 'Upgrade to Download PDF')}
          </Button>
        )}

        <Button fullWidth variant="outlined" onClick={onShare}
          sx={{
            mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 600,
            borderColor: 'var(--color-border)', color: 'var(--color-text)',
            '&:hover': { borderColor: 'var(--color-primary)', background: 'var(--color-primary-alpha)' },
          }}>
          🔗 {t('myDocs.share', 'Copy Share Link')}
        </Button>

        <Button
          fullWidth
          variant="outlined"
          onClick={savedOffline ? undefined : onSaveOffline}
          disabled={savedOffline || !isOnline}
          sx={{
            mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 600,
            borderColor: savedOffline ? '#2e7d32' : 'var(--color-border)',
            color: savedOffline ? '#2e7d32' : 'var(--color-text)',
            background: savedOffline ? 'rgba(46,125,50,0.07)' : undefined,
            cursor: savedOffline ? 'default' : 'pointer',
            '&:hover': savedOffline ? {} : { borderColor: '#2e7d32', background: 'rgba(46,125,50,0.07)' },
            '&.Mui-disabled': { opacity: 0.55 },
          }}
        >
          {savedOffline ? '✓ Saved for offline' : isOnline ? '⬇ Save for offline' : 'No connection to save'}
        </Button>

        {isPaid && (
          <Button fullWidth variant="outlined" onClick={onRegenerate} disabled={regenerating}
            sx={{
              borderRadius: `${RADIUS.md}px`, fontWeight: 600,
              borderColor: 'var(--color-border)', color: 'var(--color-text)',
              '&:hover': { borderColor: 'var(--color-primary)', background: 'var(--color-primary-alpha)' },
              '&.Mui-disabled': { opacity: 0.6 },
            }}>
            {regenerating ? '⏳ Regenerating…' : `🔄 ${t('myDocs.regenerate', 'Regenerate Document')}`}
          </Button>
        )}

        {/* Digital signature section */}
        {doc?.isSigned && (
          <Chip
            label="✓ Digitally Signed"
            size="small"
            sx={{
              mt: 1, width: '100%', height: 26, fontSize: '0.72rem', fontWeight: 700,
              borderRadius: `${RADIUS.md}px`,
              background: 'rgba(27,94,32,0.12)', color: '#1b5e20',
              border: '1px solid rgba(27,94,32,0.3)',
            }}
          />
        )}
        {doc?.signatureStatus === 'pending' && (
          <Chip
            label="⏳ Signature Pending…"
            size="small"
            sx={{
              mt: 1, width: '100%', height: 26, fontSize: '0.72rem', fontWeight: 700,
              borderRadius: `${RADIUS.md}px`,
              background: 'rgba(2,136,209,0.1)', color: '#0288d1',
              border: '1px solid rgba(2,136,209,0.3)',
            }}
          />
        )}
        {doc?.isPaid && !doc?.isSigned && doc?.signatureStatus !== 'pending' && (
          <Button fullWidth variant="outlined" onClick={onSign} disabled={signing}
            sx={{
              mt: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 600,
              borderColor: '#1b5e20', color: '#1b5e20',
              '&:hover': { background: 'rgba(27,94,32,0.06)', borderColor: '#1b5e20' },
              '&.Mui-disabled': { opacity: 0.6 },
            }}>
            {signing ? '✍️ Signing…' : '✍️ Sign Document'}
          </Button>
        )}
        {doc?.isSigned && (
          <Button fullWidth variant="outlined" onClick={onDownloadSigned}
            sx={{
              mt: 0.75, borderRadius: `${RADIUS.md}px`, fontWeight: 600,
              borderColor: '#1b5e20', color: '#1b5e20',
              '&:hover': { background: 'rgba(27,94,32,0.06)', borderColor: '#1b5e20' },
            }}>
            📥 Download Signed PDF
          </Button>
        )}
      </GlassCard>

      {/* Legal citations */}
      {doc?.legalCitations?.length > 0 && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1 }}>
            📚 {t('myDocs.citations', 'Legal Citations')}
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
            🗺️ {t('myDocs.next_steps', 'What to Do Next')}
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

      {/* Version history */}
      {doc?.previousVersions?.length > 0 && (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1 }}>
            📜 {t('myDocs.version_history', 'Version History')}
          </Typography>
          {[...doc.previousVersions].reverse().map((v, i) => (
            <Accordion key={i} elevation={0} sx={{
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
                    Version {v.version}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                    {new Date(v.regeneratedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
                {v.regenerationReason && (
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 0.75 }}>
                    {v.regenerationReason}
                  </Typography>
                )}
                {v.content && (
                  <Typography variant="caption" sx={{
                    color: 'var(--color-text)', lineHeight: 1.55,
                    display: 'block', fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 120, overflow: 'auto',
                    background: 'var(--color-bg)', borderRadius: 1, p: 0.75,
                  }}>
                    {v.content.slice(0, 300)}{v.content.length > 300 ? '…' : ''}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Notarization */}
      <GlassCard sx={{ p: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 0.75 }}>
          🔏 Online Notarization
        </Typography>
        {notarizationRequest ? (() => {
          const meta = notarizationStatusLabel(notarizationRequest);
          const needsPayment = notarizationRequest.status === 'accepted' && notarizationRequest.payment?.status !== 'paid';
          return (
            <>
              {/* Status badge */}
              <Box sx={{
                px: 1.5, py: 1, mb: 1.25, borderRadius: `${RADIUS.md}px`,
                background: meta.bg,
                border: `1px solid ${meta.color}33`,
              }}>
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', color: meta.color }}>
                  {meta.label}
                </Typography>
                {notarizationRequest.notary?.name && (
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                    Notary: {notarizationRequest.notary.name}
                  </Typography>
                )}
                {notarizationRequest.scheduledAt && notarizationRequest.status === 'kyc_scheduled' && (
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
                    KYC: {new Date(notarizationRequest.scheduledAt).toLocaleString('en-IN')}
                  </Typography>
                )}
              </Box>

              {/* Pay button — shown when notary accepted but citizen hasn't paid yet */}
              {needsPayment && (
                <Button
                  fullWidth variant="contained" size="small"
                  onClick={onPayNotarization}
                  disabled={payingNotarization}
                  sx={{
                    mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700,
                    background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)',
                    '&:hover': { background: 'linear-gradient(135deg, #0d1b6e 0%, #1a237e 100%)' },
                  }}
                >
                  💳 Pay {NOTARIZATION_FEE_DISPLAY} to Confirm
                </Button>
              )}

              {/* Video KYC join link */}
              {notarizationRequest.videoLink && notarizationRequest.status === 'kyc_scheduled' && (
                <Button
                  fullWidth variant="outlined" size="small"
                  href={notarizationRequest.videoLink} target="_blank" rel="noopener noreferrer"
                  sx={{ mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700, borderColor: '#7b1fa2', color: '#7b1fa2' }}
                >
                  📹 Join Video KYC
                </Button>
              )}

              {/* Notarized PDF download */}
              {notarizationRequest.notarizedPdfUrl && (
                <Button
                  fullWidth variant="outlined" size="small"
                  href={notarizationRequest.notarizedPdfUrl} target="_blank" rel="noopener noreferrer"
                  sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, borderColor: '#2e7d32', color: '#2e7d32' }}
                >
                  📥 Download Notarized PDF
                </Button>
              )}
            </>
          );
        })() : (
          <>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 1.5, lineHeight: 1.55 }}>
              Get this document legally notarized online via Video KYC for just <strong>{NOTARIZATION_FEE_DISPLAY}</strong>. No physical visit needed.
            </Typography>
            <Button
              fullWidth variant="contained" size="small"
              onClick={onNotarize}
              sx={{
                borderRadius: `${RADIUS.md}px`, fontWeight: 700, fontSize: '0.8rem',
                background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #0d1b6e 0%, #1a237e 100%)' },
              }}
            >
              🔏 I Need This Notarized
            </Button>
          </>
        )}
      </GlassCard>

      {/* Stamp Duty Calculator */}
      <StampDutyCalculator doc={doc} />

      {/* Lawyer CTA / Chat */}
      <GlassCard sx={{ p: 2, border: '1.5px solid var(--color-primary) !important' }}>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 0.75 }}>
          👨‍⚖️ {linkedConsultation ? 'Lawyer Consultation' : t('myDocs.lawyer_cta', 'Get Expert Review')}
        </Typography>
        {linkedConsultation ? (
          <>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 1.5, lineHeight: 1.55 }}>
              You have an active consultation with{' '}
              <strong>{linkedConsultation.lawyer?.name || 'your lawyer'}</strong>.
              Chat directly about this document.
            </Typography>
            <Button fullWidth variant="contained" onClick={onOpenChat} size="small"
              sx={{
                mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700, fontSize: '0.8rem',
                background: 'var(--color-primary)',
                '&:hover': { background: 'var(--color-primary)' },
              }}>
              💬 Open Chat
            </Button>
          </>
        ) : (
          <>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 1.5, lineHeight: 1.55 }}>
              {t('myDocs.lawyer_desc', 'A verified advocate can review this document for just ₹499.')}
            </Typography>
            <Button fullWidth variant="outlined" onClick={onConnectLawyer} size="small"
              sx={{
                borderRadius: `${RADIUS.md}px`, fontWeight: 600, fontSize: '0.8rem',
                borderColor: 'var(--color-primary)', color: 'var(--color-primary)',
                '&:hover': { background: 'var(--color-primary-alpha)' },
              }}>
              {t('myDocs.find_lawyer', 'Connect with a Lawyer')}
            </Button>
          </>
        )}
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
  const prefersReducedMotion = useReducedMotion();

  const doc = useSelector(selectCurrentDocument);
  const plan = useSelector(selectUserPlan);
  const pdfUrlExpiresAt = useSelector(selectPdfUrlExpiresAt);
  const docError = useSelector(selectDocumentError);
  const notarizationRequest = useSelector(selectDocumentNotarizationStatus);
  const { isPinned, pin } = useOfflineDocuments();
  const isOnline = useOfflineStatus();
  const savedOffline = isPinned(documentId);

  const [mobileTab, setMobileTab] = useState(0);
  const [clauseAnchor, setClauseAnchor] = useState(null);
  const [activeClauseIndex, setActiveClauseIndex] = useState(null);
  const [activeClauseText, setActiveClauseText] = useState('');
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const [regenerating, setRegenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [signing, setSigning] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [payingNotarization, setPayingNotarization] = useState(false);
  const [signedPdfUrl, setSignedPdfUrl] = useState(null);
  const [reviewDismissed, setReviewDismissed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [linkedConsultation, setLinkedConsultation] = useState(null);
  const [notarizeOpen, setNotarizeOpen] = useState(false);
  const pollRef = useRef(null);

  // Document has no status field — completion is tracked via session.status and content
  const isGenerating = !doc || (!doc.content && doc.session?.status !== 'completed');

  // Load document & poll while still generating (content is empty).
  // Uses exponential backoff (2s → 4s → 8s → 16s → 30s cap) since AI
  // generation can take 30-120s — no point hammering every 4s the whole time.
  useEffect(() => {
    setReviewDismissed(false); // reset banner when navigating to a new document
    dispatch(getDocument(documentId));

    const pollStartedAt = Date.now();
    const MAX_POLL_MS = 3 * 60 * 1000; // give up after 3 minutes — covers orphaned/stuck sessions
    const BACKOFF_STEPS_MS = [2000, 4000, 8000, 16000, 30000];
    let attempt = 0;

    const scheduleNext = () => {
      const delay = BACKOFF_STEPS_MS[Math.min(attempt, BACKOFF_STEPS_MS.length - 1)];
      attempt += 1;
      pollRef.current = setTimeout(() => {
        if (Date.now() - pollStartedAt > MAX_POLL_MS) {
          setSnack({
            open: true,
            msg: 'This is taking longer than expected. Please refresh the page or try again later.',
            severity: 'error',
          });
          return;
        }
        dispatch(getDocument(documentId));
        scheduleNext();
      }, delay);
    };

    scheduleNext();

    return () => clearTimeout(pollRef.current);
  }, [documentId, dispatch]);

  // Fetch linked consultation (for chat button)
  useEffect(() => {
    if (!documentId) return;
    api.get(`/documents/${documentId}/consultation`)
      .then(({ data }) => setLinkedConsultation(data.consultation))
      .catch(() => setLinkedConsultation(null));
  }, [documentId]);

  // Fetch notarization status for this document
  useEffect(() => {
    if (documentId) dispatch(getDocumentNotarizationStatus(documentId));
  }, [documentId, dispatch]);

  // Re-fetch notarization status when any notarization-related socket notification arrives
  useEffect(() => {
    const handleNotification = (notification) => {
      if (
        notification.type?.startsWith('notarization_') ||
        notification.type === 'payment_success'
      ) {
        dispatch(getDocumentNotarizationStatus(documentId));
      }
    };
    socketService.on('notification', handleNotification);
    return () => socketService.off('notification', handleNotification);
  }, [documentId, dispatch]);

  // Stop polling once the AI has filled in the content, or if the document
  // is orphaned (its session was deleted, so it can never complete).
  useEffect(() => {
    const isComplete =
      doc?.session?.status === 'completed' ||
      (doc?.content && doc.content.length > 0);
    const isOrphaned = doc && !doc.content && doc.session == null;
    if (isComplete || isOrphaned) {
      clearTimeout(pollRef.current);
    }
    if (isOrphaned) {
      setSnack({
        open: true,
        msg: 'This document could not be generated because its session was removed. Please start a new one.',
        severity: 'error',
      });
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
    if (downloading) return;
    setDownloading(true);
    try {
      const canDownload = doc?.isPaid || plan === 'basic' || plan === 'pro';
      if (canDownload) {
        // Always fetch a URL from the server. If the previously cached URL is still
        // within its validity window the server returns from Redis (N14); otherwise
        // a fresh signed URL is generated. Either way the client never uses a
        // potentially-expired URL from Redux state directly.
        const result = await dispatch(getPDF(documentId));
        if (result.payload?.pdfUrl) {
          window.open(result.payload.pdfUrl, '_blank');
        } else if (result.error || result.payload?.error) {
          // PDF locked (free-tier doc that isn't always-free) — send to pricing
          const errCode = result.payload?.error || result.payload?.code;
          if (errCode === 'PDF_LOCKED' || result.meta?.requestStatus === 'rejected') {
            setSnack({ open: true, msg: 'PDF download requires a paid plan. Redirecting to pricing…', severity: 'info' });
            setTimeout(() => navigate('/citizen/pricing'), 1500);
          } else {
            setSnack({ open: true, msg: result.payload?.message || 'Could not download PDF. Please try again.', severity: 'error' });
          }
        }
      } else {
        // Free user, unpaid doc — offer pay-per-doc via Razorpay
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
        } catch {
          setSnack({ open: true, msg: 'Could not initiate payment. Please try again.', severity: 'error' });
        }
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const result = await dispatch(shareDocument({ documentId }));
    if (result.payload?.shareUrl) {
      navigator.clipboard.writeText(result.payload.shareUrl).catch(() => {});
      const expiryLabel = result.payload.expiresAt
        ? ` Valid until ${new Date(result.payload.expiresAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}.`
        : '';
      setSnack({ open: true, msg: `Share link copied to clipboard!${expiryLabel}`, severity: 'success' });
    }
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    const result = await dispatch(regenerateDocument(documentId));
    if (result.meta?.requestStatus === 'fulfilled') {
      setSnack({ open: true, msg: 'Document regeneration started. Refreshing in a moment…', severity: 'info' });
      setTimeout(() => dispatch(getDocument(documentId)), 3000);
    } else {
      setSnack({ open: true, msg: result.payload || 'Regeneration failed. Please try again.', severity: 'error' });
    }
    setRegenerating(false);
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    const result = await dispatch(updateApprovalStatus({ documentId, status: 'finalized' }));
    if (updateApprovalStatus.fulfilled.match(result)) {
      setSnack({ open: true, msg: 'Document finalized successfully!', severity: 'success' });
      dispatch(getDocument(documentId));
    } else {
      setSnack({ open: true, msg: result.payload || 'Failed to finalize document. Please try again.', severity: 'error' });
    }
    setFinalizing(false);
  };

  const handleSign = async () => {
    setSigning(true);
    try {
      const { data } = await api.post(`/documents/${documentId}/sign`);
      if (data.pending) {
        window.location.href = data.redirectUrl;
      } else {
        setSignedPdfUrl(data.signedPdfUrl);
        dispatch(getDocument(documentId));
        setSnack({ open: true, msg: 'Document digitally signed successfully!', severity: 'success' });
      }
    } catch (err) {
      setSnack({ open: true, msg: err.response?.data?.message || 'Signing failed. Please try again.', severity: 'error' });
    } finally {
      setSigning(false);
    }
  };

  const handleDownloadSigned = async () => {
    try {
      if (signedPdfUrl) {
        window.open(signedPdfUrl, '_blank');
        return;
      }
      const { data } = await api.get(`/documents/${documentId}/signed-pdf`);
      setSignedPdfUrl(data.signedPdfUrl);
      window.open(data.signedPdfUrl, '_blank');
    } catch {
      setSnack({ open: true, msg: 'Could not fetch signed PDF. Please try again.', severity: 'error' });
    }
  };

  const handlePayNotarization = () => {
    if (payingNotarization) return;
    if (!notarizationRequest?.payment?.razorpayOrderId) return;
    setPayingNotarization(true);
    openCheckout({
      orderId: notarizationRequest.payment.razorpayOrderId,
      amount: notarizationRequest.payment.amount,
      currency: 'INR',
      name: 'NyayaSetu',
      description: `Notarization — ${doc?.title || 'Document'}`,
      onSuccess: async (response) => {
        try {
          await dispatch(verifyNotarizationPayment({
            requestId: notarizationRequest._id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }));
          dispatch(getDocumentNotarizationStatus(documentId));
          setSnack({ open: true, msg: 'Payment successful! The notary will now schedule your Video KYC.', severity: 'success' });
        } finally {
          setPayingNotarization(false);
        }
      },
      onDismiss: () => setPayingNotarization(false),
    });
  };

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 }, maxWidth: 1200, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        {/* Header */}
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <Box
              onClick={() => navigate('/citizen/documents')}
              sx={{ cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1.1rem', lineHeight: 1 }}>
              ←
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <GradientHeading variant={isMobile ? 'h6' : 'h5'} sx={{
                fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {doc?.title || t('myDocs.loading', 'Loading document…')}
              </GradientHeading>
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
        {isMobile && doc?.content && (
          <Tabs value={mobileTab} onChange={(_, v) => setMobileTab(v)} sx={{
            mb: 2, borderBottom: '1px solid var(--color-border)',
            '& .MuiTab-root': { fontSize: '0.78rem', fontWeight: 600, textTransform: 'none', color: 'var(--color-text-secondary)', minWidth: 0, px: 1.5 },
            '& .Mui-selected': { color: 'var(--color-primary)' },
            '& .MuiTabs-indicator': { background: 'var(--color-primary)' },
          }}>
            <Tab label={t('myDocs.tab_document', '📄 Document')} />
            <Tab label={t('myDocs.tab_citations', '📚 Citations')} />
            <Tab label={t('myDocs.tab_more', '🧰 More')} />
            {doc?.previousVersions?.length > 0 && <Tab label="📜 History" />}
          </Tabs>
        )}

        {/* AI self-review banner (Pass 2 results) */}
        {!isGenerating && doc?.aiReview && !reviewDismissed && (
          <ReviewBanner
            aiReview={doc.aiReview}
            onDismiss={() => setReviewDismissed(true)}
          />
        )}

        {isGenerating ? (
          <GeneratingSkeleton />
        ) : isMobile ? (
          /* Mobile: single column with tabs */
          <Box>
            {mobileTab === 0 && (
              <Box sx={{ p: 2, background: 'var(--color-surface)', borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)' }}>
                <DocumentText content={doc.content} onClauseClick={handleClauseClick} activeClauseIndex={activeClauseIndex} />
                <Box sx={{ mt: 3 }}>
                  <Button fullWidth variant="contained" onClick={handleDownload}
                    sx={{ mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
                    {doc.isPaid || plan !== 'free' ? '📥 Download PDF' : '🔒 Upgrade to Download'}
                  </Button>
                  <Button fullWidth variant="outlined" onClick={handleShare}
                    sx={{ mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                    🔗 Copy Share Link
                  </Button>
                  {(doc.isPaid || plan === 'basic' || plan === 'pro') && (
                    <Button fullWidth variant="outlined" onClick={handleRegenerate} disabled={regenerating}
                      sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: 'var(--color-border)', color: 'var(--color-text)', mb: 1 }}>
                      {regenerating ? '⏳ Regenerating…' : '🔄 Regenerate Document'}
                    </Button>
                  )}
                  {doc?.isSigned && (
                    <Chip label="✓ Digitally Signed" size="small" sx={{
                      mb: 1, width: '100%', height: 26, fontSize: '0.72rem', fontWeight: 700,
                      borderRadius: `${RADIUS.md}px`,
                      background: 'rgba(27,94,32,0.12)', color: '#1b5e20',
                      border: '1px solid rgba(27,94,32,0.3)',
                    }} />
                  )}
                  {doc?.signatureStatus === 'pending' && (
                    <Chip label="⏳ Signature Pending…" size="small" sx={{
                      mb: 1, width: '100%', height: 26, fontSize: '0.72rem', fontWeight: 700,
                      borderRadius: `${RADIUS.md}px`,
                      background: 'rgba(2,136,209,0.1)', color: '#0288d1',
                      border: '1px solid rgba(2,136,209,0.3)',
                    }} />
                  )}
                  {doc?.isPaid && !doc?.isSigned && doc?.signatureStatus !== 'pending' && (
                    <Button fullWidth variant="outlined" onClick={handleSign} disabled={signing}
                      sx={{
                        mb: 1, borderRadius: `${RADIUS.md}px`, fontWeight: 600,
                        borderColor: '#1b5e20', color: '#1b5e20',
                        '&:hover': { background: 'rgba(27,94,32,0.06)' },
                        '&.Mui-disabled': { opacity: 0.6 },
                      }}>
                      {signing ? '✍️ Signing…' : '✍️ Sign Document'}
                    </Button>
                  )}
                  {doc?.isSigned && (
                    <Button fullWidth variant="outlined" onClick={handleDownloadSigned}
                      sx={{
                        borderRadius: `${RADIUS.md}px`, fontWeight: 600,
                        borderColor: '#1b5e20', color: '#1b5e20',
                        '&:hover': { background: 'rgba(27,94,32,0.06)' },
                      }}>
                      📥 Download Signed PDF
                    </Button>
                  )}
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
              <RightPanel document={doc} onDownload={handleDownload} downloading={downloading} onShare={handleShare}
                onRegenerate={handleRegenerate} regenerating={regenerating}
                onSign={handleSign} signing={signing} onDownloadSigned={handleDownloadSigned}
                onConnectLawyer={() => navigate('/citizen/lawyers')}
                onOpenChat={() => setChatOpen(true)}
                linkedConsultation={linkedConsultation}
                plan={plan}
                onNotarize={() => setNotarizeOpen(true)}
                onPayNotarization={handlePayNotarization}
                payingNotarization={payingNotarization}
                notarizationRequest={notarizationRequest}
                onSaveOffline={() => pin(documentId)}
                savedOffline={savedOffline}
                isOnline={isOnline}
                onFinalize={handleFinalize}
                finalizing={finalizing} />
            )}
            {mobileTab === 3 && doc?.previousVersions?.length > 0 && (
              <Box sx={{ p: 1 }}>
                {[...doc.previousVersions].reverse().map((v, i) => (
                  <Box key={i} sx={{ p: 1.5, mb: 1.5, borderRadius: `${RADIUS.lg}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-primary)' }}>Version {v.version}</Typography>
                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block' }}>
                      {new Date(v.regeneratedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </Typography>
                    {v.regenerationReason && (
                      <Typography variant="caption" sx={{ color: 'var(--color-text)', display: 'block', mt: 0.5 }}>{v.regenerationReason}</Typography>
                    )}
                  </Box>
                ))}
              </Box>
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
                <DocumentText content={doc?.content} onClauseClick={handleClauseClick} activeClauseIndex={activeClauseIndex} />
              </Box>
            </Grid>
            <Grid item md={4}>
              <Box sx={{ position: 'sticky', top: 80 }}>
                <RightPanel document={doc} onDownload={handleDownload} downloading={downloading} onShare={handleShare}
                  onRegenerate={handleRegenerate} regenerating={regenerating}
                  onSign={handleSign} signing={signing} onDownloadSigned={handleDownloadSigned}
                  onConnectLawyer={() => navigate('/citizen/lawyers')}
                  onOpenChat={() => setChatOpen(true)}
                  linkedConsultation={linkedConsultation}
                  plan={plan}
                  onNotarize={() => setNotarizeOpen(true)}
                  onPayNotarization={handlePayNotarization}
                  payingNotarization={payingNotarization}
                  notarizationRequest={notarizationRequest}
                  onSaveOffline={() => pin(documentId)}
                  savedOffline={savedOffline}
                  isOnline={isOnline}
                  onFinalize={handleFinalize}
                  finalizing={finalizing} />
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

      {/* Real-time chat panel */}
      {linkedConsultation && (
        <ConsultationChat
          consultationId={linkedConsultation._id}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          otherPartyName={linkedConsultation.lawyer?.name || 'Your Lawyer'}
        />
      )}

      {/* Notarization booking drawer */}
      {doc && (
        <NotarizationBooking
          open={notarizeOpen}
          onClose={() => setNotarizeOpen(false)}
          document={doc}
          onSuccess={() => {
            setNotarizeOpen(false);
            dispatch(getDocumentNotarizationStatus(documentId));
            setSnack({ open: true, msg: 'Notarization request submitted! The notary will contact you shortly.', severity: 'success' });
          }}
        />
      )}
    </AnimatedPage>
  );
}

export default DocumentPreview;

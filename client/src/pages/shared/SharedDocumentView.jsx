/**
 * client/src/pages/shared/SharedDocumentView.jsx
 * Public read-only view of a shared document — no auth required.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import StepContent from '@mui/material/StepContent';
import Divider from '@mui/material/Divider';

import api from '../../services/api';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

/* ---------------------------------------------------------------------------
 * Inline document text renderer (no clause-click — read-only)
 * ------------------------------------------------------------------------ */
function DocumentText({ content }) {
  if (!content) return null;
  const paragraphs = content.split(/\n{2,}/).filter(Boolean);
  return (
    <Box sx={{ fontFamily: "'DM Sans', sans-serif" }}>
      {paragraphs.map((para, i) => {
        const isClause = /^\d+\.|^[IVX]+\./.test(para.trim());
        return (
          <Typography
            key={i}
            variant="body2"
            sx={{
              mb: 1.5,
              lineHeight: 1.75,
              color: 'var(--color-text)',
              fontWeight: isClause ? 600 : 400,
              pl: isClause ? 0 : 0,
            }}
          >
            {para}
          </Typography>
        );
      })}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------------ */
export default function SharedDocumentView() {
  const { shareToken } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchDoc() {
      try {
        const { data } = await api.get(`/documents/shared/${shareToken}`);
        setDoc(data.document);
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          'This share link is invalid or has expired.';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchDoc();
  }, [shareToken]);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <CircularProgress sx={{ color: 'var(--color-primary)' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, background: 'var(--color-bg)' }}>
        <Typography sx={{ fontSize: 48, mb: 2 }}>🔗</Typography>
        <Alert severity="error" sx={{ mb: 3, maxWidth: 480, width: '100%', borderRadius: `${RADIUS.lg}px` }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/')}
          sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)' }}>
          Go to NyayaSetu
        </Button>
      </Box>
    );
  }

  const expiresAt = doc?.shareTokenExpiresAt ? new Date(doc.shareTokenExpiresAt) : null;
  const isExpired = expiresAt && expiresAt < new Date();

  return (
    <Box sx={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      {/* Top bar */}
      <Box sx={{
        px: { xs: 2, sm: 4 }, py: 1.5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: SHADOWS.sm,
      }}>
        <Typography
          sx={{
            fontFamily: TYPOGRAPHY.fontFamily.display,
            fontWeight: 800,
            fontSize: { xs: '1rem', sm: '1.2rem' },
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary, var(--color-primary)))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          ⚖️ NyayaSetu
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={() => navigate('/register')}
          sx={{
            borderRadius: `${RADIUS.md}px`, fontWeight: 700,
            background: 'var(--color-primary)', fontSize: '0.78rem',
          }}
        >
          Create Free Account
        </Button>
      </Box>

      <Box sx={{ maxWidth: 900, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, sm: 4 } }}>
        {/* Document header */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 1 }}>
            <Typography
              variant="h5"
              sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, color: 'var(--color-text)', flex: 1, minWidth: 0 }}
            >
              {doc.title}
            </Typography>
            <Chip label="Shared Document" size="small"
              sx={{ background: 'rgba(var(--color-primary-rgb, 63,81,181), 0.1)', color: 'var(--color-primary)', fontWeight: 600, fontSize: '0.7rem' }} />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {doc.sharedBy && (
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                Shared by {doc.sharedBy}
              </Typography>
            )}
            {doc.createdAt && (
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                Created {new Date(doc.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
              </Typography>
            )}
            {expiresAt && !isExpired && (
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
                Link expires {expiresAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
              </Typography>
            )}
            {isExpired && (
              <Chip label="Link Expired" size="small" color="error"
                sx={{ fontSize: '0.68rem', height: 20 }} />
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' }, alignItems: 'flex-start' }}>
          {/* Document content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{
              p: { xs: 2.5, sm: 4 },
              background: 'var(--color-surface)',
              borderRadius: `${RADIUS.xl}px`,
              border: '1px solid var(--color-border)',
              boxShadow: SHADOWS.sm,
              mb: 3,
            }}>
              <DocumentText content={doc.content} />
            </Box>

            {/* Legal citations */}
            {doc.legalCitations?.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
                  📚 Legal Citations
                </Typography>
                {doc.legalCitations.map((cite, i) => (
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
                          sx={{ color: 'var(--color-primary)', display: 'block', mt: 0.5, textDecoration: 'underline' }}
                        >
                          View on Indian Kanoon →
                        </Typography>
                      )}
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Box>

          {/* Right sidebar — next steps + CTA */}
          <Box sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
            {doc.nextSteps?.length > 0 && (
              <Box sx={{
                p: 2, mb: 2,
                background: 'var(--color-surface)',
                borderRadius: `${RADIUS.xl}px`,
                border: '1px solid var(--color-border)',
                boxShadow: SHADOWS.sm,
              }}>
                <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 1.5 }}>
                  🗺️ What to Do Next
                </Typography>
                <Stepper orientation="vertical" sx={{ '& .MuiStepConnector-line': { borderColor: 'var(--color-border)' } }}>
                  {doc.nextSteps.map((step, i) => (
                    <Step key={i} active>
                      <StepLabel StepIconProps={{ sx: { color: 'var(--color-primary)', '&.Mui-active': { color: 'var(--color-primary)' } } }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {step.instruction}
                        </Typography>
                      </StepLabel>
                      <StepContent>
                        <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', lineHeight: 1.55 }}>
                          {step.details}
                        </Typography>
                      </StepContent>
                    </Step>
                  ))}
                </Stepper>
              </Box>
            )}

            {/* CTA */}
            <Box sx={{
              p: 2,
              background: 'var(--color-surface)',
              borderRadius: `${RADIUS.xl}px`,
              border: '1.5px solid var(--color-primary)',
              boxShadow: SHADOWS.sm,
            }}>
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)', mb: 0.75 }}>
                ⚖️ Create Your Own Legal Documents
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 1.5, lineHeight: 1.55 }}>
                Generate lawyer-quality legal documents in minutes with NyayaSetu — India's AI legal assistant.
              </Typography>
              <Button fullWidth variant="contained" onClick={() => navigate('/register')}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 700, background: 'var(--color-primary)', mb: 1 }}>
                Get Started Free
              </Button>
              <Button fullWidth variant="outlined" onClick={() => navigate('/login')}
                sx={{ borderRadius: `${RADIUS.md}px`, fontWeight: 600, borderColor: 'var(--color-border)', color: 'var(--color-text)', fontSize: '0.8rem' }}>
                Already have an account? Sign in
              </Button>
            </Box>
          </Box>
        </Box>

        {/* Footer */}
        <Divider sx={{ my: 4, borderColor: 'var(--color-border)' }} />
        <Box sx={{ textAlign: 'center', pb: 4 }}>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            This document was generated and shared via{' '}
            <Typography component="span" variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              NyayaSetu
            </Typography>
            {' '}— AI-powered legal assistance for India.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

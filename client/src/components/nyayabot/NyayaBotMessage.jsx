/**
 * NyayaBotMessage.jsx
 * Renders a single message from user or NyayaBot.
 * NyayaBot messages include: markdown content, legal citations,
 * document template suggestions, follow-up question chips, thumbs feedback.
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import {
  Box, Chip, IconButton, Link, Tooltip,
  Collapse, Divider, Button
} from '@mui/material';
import {
  ThumbUp, ThumbDown, ContentCopy, Check,
  ExpandMore, OpenInNew, AutoStories, Balance
} from '@mui/icons-material';
import { motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { rateNyayaBotMessage } from '../../store/slices/nyayabotSlice';
import { useNavigate } from 'react-router-dom';
import { TYPOGRAPHY } from '../../theme/tokens';
import { normalizeNyayaBotMessage } from '../../utils/nyayabotContent';

// ─── NyayaBot avatar SVG ──────────────────────────────────────────────────────
function BotAvatarSmall() {
  return (
    <Box
      sx={{
        width: 28, height: 28, borderRadius: '9px',
        bgcolor: 'var(--color-primary-alpha)',
        border: '1px solid color-mix(in srgb, var(--color-primary) 30%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, mt: 0.25,
      }}
    >
      <Balance sx={{ fontSize: 15, color: 'var(--color-primary)' }} />
    </Box>
  );
}

// ─── Citation card ────────────────────────────────────────────────────────────
function CitationsAccordion({ citations }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!citations?.length) return null;

  return (
    <Box
      sx={{
        mt: 1.5, borderRadius: 1.5,
        border: '1px solid var(--color-primary-alpha)',
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 1.5, py: 1, cursor: 'pointer',
          bgcolor: 'var(--color-primary-alpha)',
          color: 'var(--color-primary)',
          fontSize: '0.8rem', fontWeight: 600,
          userSelect: 'none',
        }}
      >
        <AutoStories sx={{ fontSize: 16 }} />
        {t('nyayabot.legalCitations')} ({citations.length})
        <ExpandMore
          sx={{
            ml: 'auto', fontSize: 18,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </Box>
      <Collapse in={open}>
        <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {citations.map((c, i) => (
            <Box
              key={i}
              sx={{
                p: 1, borderRadius: 1,
                bgcolor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Box sx={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--color-text)', mb: 0.25 }}>
                {c.act} ({c.year})
              </Box>
              <Box sx={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', mb: 0.5 }}>
                {c.fullName} — {c.section}
              </Box>
              {c.url && (
                <Link
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{
                    fontSize: '0.75rem', display: 'inline-flex',
                    alignItems: 'center', gap: 0.4,
                    color: 'var(--color-primary)',
                  }}
                >
                  {t('nyayabot.viewOnKanoon')}
                  <OpenInNew sx={{ fontSize: 12 }} />
                </Link>
              )}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

// ─── Document suggestions ─────────────────────────────────────────────────────
function TemplateSuggestions({ templates }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!templates?.length) return null;

  const complexityColor = { simple: 'success', moderate: 'warning', complex: 'error' };

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', mb: 0.75 }}>
        {t('nyayabot.suggestedDocuments')}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {templates.map((tmpl, i) => (
          <Chip
            key={i}
            label={tmpl.title}
            size="small"
            color={complexityColor[tmpl.complexity] || 'default'}
            variant="outlined"
            clickable
            onClick={() => navigate(`/documents/generate/${tmpl.slug}`)}
            sx={{ fontSize: '0.75rem', fontWeight: 500 }}
          />
        ))}
      </Box>
    </Box>
  );
}

// ─── Follow-up questions ──────────────────────────────────────────────────────
function FollowUpChips({ questions, onSelect }) {
  const { t } = useTranslation();
  if (!questions?.length) return null;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box sx={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-text-secondary)', mb: 0.85 }}>
        {t('nyayabot.followUpQuestions')}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {questions.map((q, i) => (
          <Button
            key={i}
            size="small"
            variant="outlined"
            onClick={() => onSelect(q)}
            sx={{
              justifyContent: 'flex-start',
              textTransform: 'none',
              textAlign: 'left',
              fontWeight: 500,
              fontSize: '0.78rem',
              lineHeight: 1.4,
              color: 'var(--color-text)',
              py: 0.7, px: 1.25,
              borderRadius: '12px',
              borderColor: 'var(--color-border)',
              '&:hover': {
                borderColor: 'var(--color-primary)',
                bgcolor: 'var(--color-primary-alpha)',
              },
            }}
          >
            {q}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

// ─── Main NyayaBotMessage component ──────────────────────────────────────────

export default function NyayaBotMessage({ message, onFollowUp, compact = false, isGreeting = false }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const view = useMemo(() => normalizeNyayaBotMessage(message), [message]);
  const [copied, setCopied] = useState(false);
  const [localThumb, setLocalThumb] = useState(message.thumbsUp); // null | true | false

  const isBot = view.role === 'nyayabot';
  const isOptimistic = !!view.isOptimistic;

  const handleCopy = () => {
    navigator.clipboard.writeText(view.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleThumb = (val) => {
    setLocalThumb(val);
    dispatch(rateNyayaBotMessage({
      sessionId: message.sessionId, // injected by parent
      messageId: message._id,
      thumbsUp: val,
    }));
  };

  // ── USER MESSAGE ──────────────────────────────────────────────────────────
  if (!isBot) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: isOptimistic ? 0.6 : 1, y: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        style={{ display: 'flex', justifyContent: 'flex-end' }}
      >
        <Box sx={{ maxWidth: compact ? '88%' : '72%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <Box
          sx={{
            px: 1.75, py: 1.2,
            borderRadius: '16px 16px 4px 16px',
            bgcolor: 'var(--color-primary-dark)',
            color: '#fff',
            fontFamily: TYPOGRAPHY.fontFamily.body,
            fontSize: '0.9rem',
            lineHeight: 1.55,
            wordBreak: 'break-word',
          }}
        >
          {view.isVoice && (
            <Box sx={{ fontSize: '0.68rem', letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.8, mb: 0.5 }}>
              {t('nyayabot.voiceMessage')}
            </Box>
          )}
          <Box sx={{ whiteSpace: 'pre-wrap' }}>{view.content}</Box>
        </Box>
        <Box sx={{ fontSize: '0.65rem', color: 'var(--color-text-secondary)', mt: 0.45, pr: 0.25 }}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Box>
        </Box>
      </motion.div>
    );
  }

  // ── NYAYABOT MESSAGE ──────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}
    >
      <BotAvatarSmall />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            px: isGreeting ? 1.85 : 1.6,
            py: isGreeting ? 1.6 : 1.35,
            borderRadius: '4px 16px 16px 16px',
            bgcolor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderLeft: '2px solid var(--color-primary)',
            boxShadow: '0 10px 28px rgba(0,0,0,0.12)',
            fontFamily: isGreeting ? TYPOGRAPHY.fontFamily.display : TYPOGRAPHY.fontFamily.body,
            fontSize: isGreeting ? '0.98rem' : '0.88rem',
            lineHeight: isGreeting ? 1.55 : 1.65,
            color: 'var(--color-text)',
            wordBreak: 'break-word',
          }}
        >
          {/* Markdown content */}
          <Box
            sx={{
              '& p': { m: 0, mb: 0.75, '&:last-child': { mb: 0 } },
              '& strong': { fontWeight: 700, color: 'var(--color-text)' },
              '& em': { fontStyle: 'italic' },
              '& ul, & ol': { pl: 2, my: 0.5 },
              '& li': { mb: 0.25 },
              '& a': { color: 'var(--color-primary)', textDecorationColor: 'var(--color-primary-alpha)' },
              '& code': {
                fontFamily: TYPOGRAPHY.fontFamily.mono,
                fontSize: '0.82em',
                bgcolor: 'var(--color-border)',
                px: '4px', py: '1px', borderRadius: '3px',
              },
            }}
          >
            <ReactMarkdown>{view.content}</ReactMarkdown>
          </Box>

          {/* Legal citations */}
          <CitationsAccordion citations={view.citations} />

          {/* Document suggestions */}
          <TemplateSuggestions templates={view.suggestedTemplates} />

          {/* Follow-up questions */}
          {onFollowUp && (
            <FollowUpChips questions={view.followUpQuestions} onSelect={onFollowUp} />
          )}

          {/* Disclaimer */}
          {view.disclaimer && (
            <>
              <Divider sx={{ my: 1.25, borderColor: 'var(--color-border)' }} />
              <Box sx={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {view.disclaimer}
              </Box>
            </>
          )}

          {/* Actions bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.25, justifyContent: 'space-between' }}>
            <Box sx={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>
              {new Date(view.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              {/* Thumbs */}
              <Tooltip title={t('nyayabot.helpful')}>
                <IconButton
                  size="small"
                  onClick={() => handleThumb(true)}
                  sx={{
                    p: 0.4,
                    color: localThumb === true ? 'var(--color-success)' : 'var(--color-text-secondary)',
                    '&:hover': { color: 'var(--color-success)' },
                  }}
                >
                  <ThumbUp sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('nyayabot.notHelpful')}>
                <IconButton
                  size="small"
                  onClick={() => handleThumb(false)}
                  sx={{
                    p: 0.4,
                    color: localThumb === false ? 'var(--color-error)' : 'var(--color-text-secondary)',
                    '&:hover': { color: 'var(--color-error)' },
                  }}
                >
                  <ThumbDown sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              {/* Copy */}
              <Tooltip title={copied ? t('common.copied') : t('common.copy')}>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{ p: 0.4, color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
                >
                  {copied ? <Check sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Box>
      </Box>
    </motion.div>
  );
}

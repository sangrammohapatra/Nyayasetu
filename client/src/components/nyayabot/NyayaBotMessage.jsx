/**
 * NyayaBotMessage.jsx
 * Renders a single message from user or NyayaBot.
 * NyayaBot messages include: markdown content, legal citations,
 * document template suggestions, follow-up question chips, thumbs feedback.
 */

import React, { useState } from 'react';
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

// ─── NyayaBot avatar SVG ──────────────────────────────────────────────────────
function BotAvatarSmall() {
  return (
    <Box
      sx={{
        width: 32, height: 32, borderRadius: '50%',
        bgcolor: 'var(--color-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, mt: 0.5,
        boxShadow: '0 2px 8px var(--color-primary-alpha)',
      }}
    >
      <Balance sx={{ fontSize: 18, color: '#fff' }} />
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
      <Box sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-secondary)', mb: 0.75 }}>
        {t('nyayabot.followUpQuestions')}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {questions.map((q, i) => (
          <Button
            key={i}
            size="small"
            variant="text"
            onClick={() => onSelect(q)}
            sx={{
              justifyContent: 'flex-start',
              textAlign: 'left',
              textTransform: 'none',
              fontSize: '0.82rem',
              lineHeight: 1.4,
              color: 'var(--color-primary)',
              py: 0.5, px: 1,
              borderRadius: 1,
              '&:hover': { bgcolor: 'var(--color-primary-alpha)' },
            }}
          >
            ↳ {q}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

// ─── Main NyayaBotMessage component ──────────────────────────────────────────

export default function NyayaBotMessage({ message, onFollowUp, compact = false }) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [localThumb, setLocalThumb] = useState(message.thumbsUp); // null | true | false

  const isBot = message.role === 'nyayabot';
  const isOptimistic = !!message.isOptimistic;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
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
        <Box
          sx={{
            maxWidth: compact ? '90%' : '75%',
            px: 1.75, py: 1.25,
            borderRadius: '14px 14px 4px 14px',
            bgcolor: 'primary.main',
            color: '#fff',
            fontFamily: TYPOGRAPHY.fontFamily.body,
            fontSize: '0.9rem',
            lineHeight: 1.55,
            wordBreak: 'break-word',
            boxShadow: '0 2px 8px var(--color-primary-alpha)',
            position: 'relative',
          }}
        >
          {message.isVoice && (
            <Box sx={{ fontSize: '0.72rem', opacity: 0.8, mb: 0.5 }}>
              🎤 {t('nyayabot.voiceMessage')}
            </Box>
          )}
          <Box sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Box>
          <Box sx={{ fontSize: '0.68rem', opacity: 0.7, mt: 0.5, textAlign: 'right' }}>
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

      <Box sx={{ maxWidth: '82%', flex: 1, minWidth: 0 }}>
        {/* Bot name label */}
        <Box sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-primary)', mb: 0.4, letterSpacing: '0.04em' }}>
          NyayaBot
        </Box>

        {/* Main bubble */}
        <Box
          sx={{
            px: 1.75, py: 1.5,
            borderRadius: '14px 14px 14px 4px',
            bgcolor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            fontFamily: TYPOGRAPHY.fontFamily.body,
            fontSize: '0.88rem',
            lineHeight: 1.65,
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
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </Box>

          {/* Legal citations */}
          <CitationsAccordion citations={message.citations} />

          {/* Document suggestions */}
          <TemplateSuggestions templates={message.suggestedTemplates} />

          {/* Follow-up questions */}
          {onFollowUp && (
            <FollowUpChips questions={message.followUpQuestions} onSelect={onFollowUp} />
          )}

          {/* Disclaimer */}
          {message.disclaimer && (
            <>
              <Divider sx={{ my: 1.25, borderColor: 'var(--color-border)' }} />
              <Box sx={{ fontSize: '0.72rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: 1.5 }}>
                ⚖️ {message.disclaimer}
              </Box>
            </>
          )}

          {/* Actions bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.25, justifyContent: 'space-between' }}>
            <Box sx={{ fontSize: '0.68rem', color: 'var(--color-text-secondary)' }}>
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

/**
 * client/src/components/chat/MessageBubble.jsx
 */

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, useReducedMotion } from 'framer-motion';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import { useTheme } from '@mui/material/styles';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Check from '@mui/icons-material/Check';
import { RADIUS, TYPOGRAPHY } from '../../theme/tokens';
import { selectTheme } from '../../store/slices/uiSlice';

/* ---------------------------------------------------------------------------
 * Minimal markdown renderer — handles bold, bullet lists, inline code.
 * No external dep needed for the subset the AI produces.
 * ------------------------------------------------------------------------ */
function renderMarkdown(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const elements = [];
  let listItems = [];

  const flushList = (key) => {
    if (!listItems.length) return;
    elements.push(
      <Box key={`list-${key}`} component="ul"
        sx={{ m: 0, pl: 2.5, mb: 0.5, '& li': { mb: 0.25 } }}>
        {listItems.map((item, i) => (
          <li key={i}>
            <Typography variant="body2" component="span" sx={{ lineHeight: 1.55 }}>
              {parseLine(item)}
            </Typography>
          </li>
        ))}
      </Box>
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    if (/^[-*•]\s/.test(line)) {
      listItems.push(line.replace(/^[-*•]\s/, ''));
    } else {
      flushList(idx);
      if (line.trim() === '') {
        elements.push(<Box key={idx} sx={{ height: 6 }} />);
      } else {
        elements.push(
          <Typography key={idx} variant="body2" sx={{ lineHeight: 1.6, mb: 0.25 }}>
            {parseLine(line)}
          </Typography>
        );
      }
    }
  });
  flushList('end');
  return elements;
}

function parseLine(text) {
  // Bold: **text** or __text__
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*.*\*\*$/.test(part) || /^__.*__$/.test(part)) {
      return <strong key={i}>{part.replace(/^\*\*|\*\*$|^__|__$/g, '')}</strong>;
    }
    if (/^`.*`$/.test(part)) {
      return (
        <Box key={i} component="code" sx={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8em',
          background: 'rgba(0,0,0,0.12)',
          px: 0.6, py: 0.1,
          borderRadius: 1,
        }}>{part.slice(1, -1)}</Box>
      );
    }
    return part;
  });
}

/* ---------------------------------------------------------------------------
 * TypingIndicator — three dots, staggered bounce
 * ------------------------------------------------------------------------ */
export function TypingIndicator() {
  const prefersReducedMotion = useReducedMotion();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 1 }}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={prefersReducedMotion ? { opacity: [0.5, 1, 0.5] } : { y: [0, -5, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--color-primary)',
            opacity: 0.75,
          }}
        />
      ))}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * ScalesAvatar — tiny scales icon for AI messages
 * ------------------------------------------------------------------------ */
function ScalesAvatar() {
  return (
    <Box sx={{
      width: 30, height: 30, borderRadius: '50%',
      background: 'var(--color-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, flexShrink: 0, mt: 'auto',
      boxShadow: '0 2px 6px var(--color-primary-alpha)',
    }}>
      ⚖️
    </Box>
  );
}

/* ---------------------------------------------------------------------------
 * MessageBubble
 * ------------------------------------------------------------------------ */
function MessageBubble({ message, isStreaming = false, onRegenerate, onExplain }) {
  const [showTime, setShowTime] = useState(false);
  const [copied, setCopied] = useState(false);
  const muiTheme = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const themeId = useSelector(selectTheme);
  const isHighContrast = themeId === 'highContrast';
  const isUser = message.role === 'user';
  const isAI = message.role === 'assistant';
  const isTyping = message.typing === true;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content || '').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timestamp = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 0.92, opacity: 0, y: 8 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 22 }}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: 4,
      }}
    >
      {/* AI avatar */}
      {isAI && <ScalesAvatar />}

      {/* Bubble */}
      <Box
        onMouseEnter={() => setShowTime(true)}
        onMouseLeave={() => setShowTime(false)}
        sx={{
          maxWidth: { xs: '82%', sm: '75%' },
          minWidth: isTyping ? 64 : undefined,
          px: isTyping ? 1.5 : 2,
          py: isTyping ? 1 : 1.25,
          borderRadius: isUser
            ? '14px 14px 4px 14px'
            : '14px 14px 14px 4px',
          background: isUser
            ? (isHighContrast ? undefined : (muiTheme.custom?.gradientBrand || 'var(--color-primary)'))
            : 'var(--color-surface)',
          bgcolor: isUser && isHighContrast ? 'primary.main' : undefined,
          border: isUser
            ? 'none'
            : isHighContrast
            ? '2px solid var(--color-primary)'
            : '1px solid var(--color-border)',
          boxShadow: isUser
            ? (isHighContrast ? 'none' : (muiTheme.custom?.glowPrimary || '0 2px 8px var(--color-primary-alpha)'))
            : '0 1px 4px rgba(0,0,0,0.06)',
          color: isUser ? '#FFFFFF' : 'var(--color-text)',
          position: 'relative',
          wordBreak: 'break-word',
          fontFamily: TYPOGRAPHY.fontFamily.body,
        }}
      >
        {isTyping ? (
          <TypingIndicator />
        ) : (
          <>
            {isUser ? (
              <Typography variant="body2" sx={{ lineHeight: 1.6, color: '#FFFFFF', fontFamily: TYPOGRAPHY.fontFamily.body }}>
                {message.content}
              </Typography>
            ) : (
              <>
                <Box sx={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                  {renderMarkdown(message.content)}
                  {isStreaming && (
                    <motion.span
                      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                      style={{
                        display: 'inline-block',
                        width: 2, height: 14,
                        background: 'var(--color-primary)',
                        marginLeft: 2,
                        verticalAlign: 'text-bottom',
                        borderRadius: 1,
                      }}
                    />
                  )}
                </Box>
                {/* Action row — copy / regenerate / explain */}
                {!isStreaming && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, pt: 0.75, borderTop: '1px solid var(--color-border)' }}>
                    <Tooltip title={copied ? 'Copied!' : 'Copy'}>
                      <IconButton size="small" onClick={handleCopy}
                        sx={{ p: 0.4, color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                        {copied ? <Check sx={{ fontSize: 14 }} /> : <ContentCopy sx={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                    {onRegenerate && (
                      <Chip label="Regenerate" size="small" onClick={onRegenerate}
                        sx={{ height: 20, fontSize: '0.67rem', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
                        variant="outlined" />
                    )}
                    {onExplain && (
                      <Chip label="Explain" size="small" onClick={onExplain}
                        sx={{ height: 20, fontSize: '0.67rem', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }}
                        variant="outlined" />
                    )}
                  </Box>
                )}
              </>
            )}

            {/* Timestamp on hover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showTime && timestamp ? 1 : 0 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'absolute', bottom: -18, right: isUser ? 0 : 'auto', left: isUser ? 'auto' : 0 }}
            >
              <Typography variant="caption" sx={{
                fontSize: '0.65rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
              }}>
                {timestamp}
              </Typography>
            </motion.div>
          </>
        )}
      </Box>
    </motion.div>
  );
}

export default MessageBubble;

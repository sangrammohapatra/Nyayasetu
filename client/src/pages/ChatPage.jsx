/**
 * ChatPage Component — wraps ChatWindow with page layout
 * Features:
 * - Responsive design (mobile-first)
 * - Error boundary
 * - Loading states
 * - Breadcrumb navigation
 * - Session persistence
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Breadcrumbs,
  Link,
  Typography,
  Box,
  CircularProgress,
  Alert,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { motion } from 'framer-motion';
import ChatWindow from '../components/chat/ChatWindow';
import { createChatSession } from '../store/slices/chatSlice';

const ChatPage = () => {
  const { sessionId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const userPlan = useSelector((state) => state.auth.user?.subscription?.plan);
  const loading = useSelector((state) => state.chat.loading);
  const error = useSelector((state) => state.chat.error);

  // ============================================================================
  // CREATE NEW SESSION IF NO SESSION ID PROVIDED
  // ============================================================================
  useEffect(() => {
    if (!sessionId) {
      // Create new chat session and navigate
      dispatch(
        createChatSession({
          title: `Chat - ${new Date().toLocaleDateString()}`,
        })
      ).then((action) => {
        if (action.payload?.sessionId) {
          navigate(`/chat/${action.payload.sessionId}`);
        }
      });
    }
  }, [sessionId, dispatch, navigate]);

  // ============================================================================
  // RENDER LOADING STATE
  // ============================================================================
  if (loading && !sessionId) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'var(--color-bg)',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography color="var(--color-text)">
            {t('chat.loading')}
          </Typography>
        </Box>
      </Box>
    );
  }

  // ============================================================================
  // RENDER ERROR STATE
  // ============================================================================
  if (error && !sessionId) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">
          <Typography variant="h6">{t('common.error')}</Typography>
          <p>{error?.message || t('chat.error')}</p>
        </Alert>
      </Container>
    );
  }

  // ============================================================================
  // RENDER CHAT PAGE
  // ============================================================================
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}
    >
      {/* HEADER WITH BREADCRUMBS */}
      {!isMobile && (
        <Box
          sx={{
            bgcolor: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
            py: 2,
            px: 3,
          }}
        >
          <Container maxWidth="xl">
            <Breadcrumbs
              sx={{ color: 'var(--color-text-secondary)' }}
              aria-label="breadcrumb"
            >
              <Link
                underline="hover"
                color="inherit"
                href="/"
                sx={{ color: 'var(--color-primary)', cursor: 'pointer' }}
              >
                {t('nav.home')}
              </Link>
              <Link
                underline="hover"
                color="inherit"
                href="/documents"
                sx={{ color: 'var(--color-primary)', cursor: 'pointer' }}
              >
                {t('nav.documents')}
              </Link>
              <Typography color="textSecondary">
                {t('chat.title')}
              </Typography>
            </Breadcrumbs>
          </Container>
        </Box>
      )}

      {/* MAIN CONTENT */}
      {sessionId ? (
        <ChatWindow sessionId={sessionId} />
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {/* QUOTA WARNING (BOTTOM BANNER) */}
      {userPlan === 'free' && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: 'rgba(79, 98, 200, 0.95)',
            color: 'white',
            padding: '16px',
            textAlign: 'center',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Typography variant="body2">
              {t('chat.freeUserUpgradePrompt')}
            </Typography>
            <button
              onClick={() => navigate('/pricing')}
              style={{
                padding: '8px 16px',
                backgroundColor: 'white',
                color: 'var(--color-primary)',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('chat.upgradeToPro')}
            </button>
          </Box>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ChatPage;

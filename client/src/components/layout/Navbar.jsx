/**
 * client/src/components/layout/Navbar.jsx
 *
 * Sticky translucent top bar with:
 * - Brand mark (GradientHeading)
 * - Desktop nav links with animated active underline (layoutId)
 * - Right cluster: LanguageSelector + ThemeSwitcher + Notifications + Avatar
 * - Mobile: hamburger → opens Sidebar Drawer (via toggleSidebar)
 * - Scroll elevation: useScroll bumps opacity/shadow past 8px (enableScrollReveal)
 * - Blur: backdropFilter only when enableBlur flag is on
 *
 * All logic (notifications, auth, routing, Redux) is unchanged.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useScroll, useReducedMotion } from 'framer-motion';
import { alpha, useTheme } from '@mui/material/styles';

import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InputBase from '@mui/material/InputBase';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuIcon from '@mui/icons-material/Menu';
import useMediaQuery from '@mui/material/useMediaQuery';

import { selectUser, selectUserPlan, selectUserPersona, logout } from '../../store/slices/authSlice';
import {
  selectNotifications, selectUnreadTotal,
  fetchNotifications, markNotificationRead, markAllNotificationsRead,
} from '../../store/slices/notificationSlice';
import { toggleSidebar } from '../../store/slices/uiSlice';
import { RADIUS, SHADOWS } from '../../theme/tokens';
import { useFeatureFlag } from '../../utils/featureFlags';
import GradientHeading from '../ui/GradientHeading';
import LanguageSelector from '../ui/LanguageSelector';
import ThemeSwitcher from './ThemeSwitcher';

// ─── Statics ─────────────────────────────────────────────────────────────────

const PLAN_STYLES = {
  free:         { label: 'FREE',  bg: 'var(--color-border)',         color: 'var(--color-text-secondary)' },
  basic:        { label: 'BASIC', bg: 'var(--color-primary-alpha)',  color: 'var(--color-primary)' },
  pro:          { label: 'PRO',   bg: 'var(--color-warning)',        color: '#fff' },
  professional: { label: 'PRO',   bg: 'var(--color-primary)',        color: '#fff' },
  firm:         { label: 'FIRM',  bg: 'var(--color-warning)',        color: '#fff' },
};

const NOTIF_ICONS = {
  hearing_reminder:         '📅',
  document_ready:           '📄',
  consultation_accepted:    '✅',
  consultation_rejected:    '❌',
  consultation_completed:   '🎉',
  consultation_completed_:  '🎉',
  lawyer_verified:          '⚖️',
  lawyer_application:       '📋',
  new_consultation_request: '🔔',
  default:                  '🔔',
};

function timeAgo(date) {
  if (!date) return '';
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Desktop nav links per persona ───────────────────────────────────────────

function useNavLinks(persona, t) {
  return useMemo(() => {
    const citizen = [
      { label: t('nav.documents', 'Documents'), path: '/citizen/documents' },
      { label: t('nav.cases',     'Cases'),     path: '/citizen/cases' },
      { label: t('nav.lawyers',   'Lawyers'),   path: '/citizen/lawyers' },
    ];
    const lawyer = [
      { label: t('nav.clients',       'Clients'),   path: '/lawyer/clients' },
      { label: t('nav.cases',         'Cases'),     path: '/lawyer/cases' },
      { label: t('nav.consultations', 'Sessions'),  path: '/lawyer/consultations' },
    ];
    const admin = [
      { label: t('nav.users',     'Users'),     path: '/admin/users' },
      { label: t('nav.templates', 'Templates'), path: '/admin/templates' },
      { label: t('nav.lawyers',   'Lawyers'),   path: '/admin/lawyers' },
    ];
    return ({ citizen, lawyer, paralegal: lawyer, admin }[persona] || citizen);
  }, [persona, t]);
}

// ─── Notification Popover ─────────────────────────────────────────────────────

function NotificationPopover({ anchorEl, onClose }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const notifications = useSelector(selectNotifications);
  const unread = useSelector(selectUnreadTotal);
  const [loading, setLoading] = useState(false);
  const open = Boolean(anchorEl);

  React.useEffect(() => {
    if (open) {
      setLoading(true);
      dispatch(fetchNotifications({ limit: 15 })).finally(() => setLoading(false));
    }
  }, [open, dispatch]);

  const handleRead = (id) => dispatch(markNotificationRead(id));
  const handleReadAll = () => dispatch(markAllNotificationsRead());

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{
        sx: {
          width: 360,
          borderRadius: `${RADIUS.xl}px`,
          border: '1px solid var(--color-border)',
          boxShadow: SHADOWS.xl,
          background: 'var(--color-surface)',
          overflow: 'hidden',
        },
      }}
      slotProps={{ backdrop: { invisible: true } }}
    >
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <Box sx={{
          px: 2.5, py: 1.75,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
              🔔 {t('notifications.title', 'Notifications')}
            </Typography>
            {unread > 0 && (
              <Chip size="small" label={unread}
                sx={{ height: 18, minWidth: 18, fontSize: '0.65rem', fontWeight: 800,
                  background: 'var(--color-error)', color: '#fff', borderRadius: `${RADIUS.full}px` }} />
            )}
          </Box>
          {unread > 0 && (
            <Button size="small" onClick={handleReadAll}
              sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-primary)', py: 0.25 }}>
              {t('notifications.mark_all_read', 'Mark all read')}
            </Button>
          )}
        </Box>

        <Box sx={{
          maxHeight: 420, overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { background: 'var(--color-border)', borderRadius: 2 },
        }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} sx={{ color: 'var(--color-primary)' }} />
            </Box>
          ) : notifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5, px: 3 }}>
              <Typography sx={{ fontSize: 44, mb: 1.5 }}>🔔</Typography>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                {t('notifications.empty', "You're all caught up!")}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mt: 0.5 }}>
                {t('notifications.empty_desc', 'Notifications about hearings, documents, and consultations will appear here.')}
              </Typography>
            </Box>
          ) : (
            <AnimatePresence initial={false}>
              {notifications.map((n, i) => (
                <motion.div
                  key={n._id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Box
                    onClick={() => !n.isRead && handleRead(n._id)}
                    sx={{
                      display: 'flex', alignItems: 'flex-start', gap: 1.5,
                      px: 2.5, py: 1.75,
                      cursor: !n.isRead ? 'pointer' : 'default',
                      background: !n.isRead ? 'var(--color-primary-alpha)' : 'transparent',
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background 0.15s',
                      '&:hover': { background: 'var(--color-overlay)' },
                      '&:last-child': { borderBottom: 'none' },
                    }}
                  >
                    <Box sx={{ position: 'relative', flexShrink: 0, mt: 0.25 }}>
                      <Typography sx={{ fontSize: 20, lineHeight: 1 }}>
                        {NOTIF_ICONS[n.type] || NOTIF_ICONS.default}
                      </Typography>
                      {!n.isRead && (
                        <Box sx={{
                          position: 'absolute', top: -2, right: -2,
                          width: 8, height: 8, borderRadius: '50%',
                          background: 'var(--color-primary)',
                        }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{
                        fontWeight: !n.isRead ? 700 : 500,
                        color: 'var(--color-text)', lineHeight: 1.35, mb: 0.25,
                      }}>
                        {n.title}
                      </Typography>
                      <Typography variant="caption" sx={{
                        color: 'var(--color-text-secondary)', lineHeight: 1.45,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {n.body}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', opacity: 0.7, mt: 0.25, display: 'block' }}>
                        {timeAgo(n.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </Box>

        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
            onClick={onClose}>
            {t('notifications.close', 'Close')}
          </Typography>
        </Box>
      </motion.div>
    </Popover>
  );
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

function SearchBar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      background: 'var(--color-surface)', border: '1.5px solid var(--color-border)',
      borderRadius: `${RADIUS.full}px`, px: 2, py: 0.5,
      width: { md: 220, lg: 300 },
      transition: 'border-color 0.2s, box-shadow 0.2s',
      '&:focus-within': { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 3px var(--color-primary-alpha)' },
    }}>
      <Typography sx={{ fontSize: 14, mr: 1, opacity: 0.5 }}>🔍</Typography>
      <InputBase
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim()) {
            navigate(`/laws/search?q=${encodeURIComponent(value)}`);
            setValue('');
          }
        }}
        placeholder={t('nav.search', 'Search laws, documents…')}
        sx={{ flex: 1, fontSize: '0.8125rem', color: 'var(--color-text)' }}
      />
    </Box>
  );
}

// ─── Desktop Nav Links ────────────────────────────────────────────────────────

function DesktopNavLinks({ links, theme }) {
  const location = useLocation();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {links.map((link) => {
        const isActive =
          location.pathname === link.path ||
          location.pathname.startsWith(link.path + '/');
        return (
          <Box
            key={link.path}
            component={RouterLink}
            to={link.path}
            sx={{
              position: 'relative',
              px: 1.25,
              py: 0.75,
              borderRadius: `${RADIUS.sm}px`,
              textDecoration: 'none',
              color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              transition: 'color 0.15s',
              '&:hover': { color: 'var(--color-primary)' },
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: isActive ? 600 : 400, fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
            >
              {link.label}
            </Typography>
            {/* Animated gradient underline — animates between active links via layoutId */}
            {isActive && (
              <motion.span
                layoutId="nav-active-underline"
                style={{
                  position: 'absolute',
                  bottom: 2,
                  left: 10,
                  right: 10,
                  height: 2,
                  background: theme.custom?.gradientBrand || 'var(--color-primary)',
                  borderRadius: 1,
                  display: 'block',
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

function Navbar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const prefersReducedMotion = useReducedMotion();

  const blurEnabled = useFeatureFlag('enableBlur');
  const scrollRevealEnabled = useFeatureFlag('enableScrollReveal');

  const user = useSelector(selectUser);
  const plan = useSelector(selectUserPlan);
  const persona = useSelector(selectUserPersona);
  const unread = useSelector(selectUnreadTotal);

  const [avatarAnchor, setAvatarAnchor] = useState(null);
  const [bellAnchor, setBellAnchor] = useState(null);
  const [elevated, setElevated] = useState(false);

  const navLinks = useNavLinks(persona || 'citizen', t);

  // Scroll elevation — gated by flag + reduced motion
  const { scrollY } = useScroll();
  useEffect(() => {
    if (!scrollRevealEnabled || prefersReducedMotion) return;
    const unsub = scrollY.on('change', (y) => setElevated(y > 8));
    return unsub;
  }, [scrollY, scrollRevealEnabled, prefersReducedMotion]);

  const handleLogout = useCallback(async () => {
    setAvatarAnchor(null);
    await dispatch(logout());
    navigate('/login', { replace: true });
  }, [dispatch, navigate]);

  const planStyle = PLAN_STYLES[plan] || PLAN_STYLES.free;
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  // Translucent background — bumps opacity on scroll
  const bgOpacity = elevated ? 0.92 : 0.80;
  const navBg = alpha(muiTheme.palette.background.paper, bgOpacity);

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        background: navBg,
        borderBottom: elevated ? 'none' : '1px solid var(--color-border)',
        boxShadow: elevated ? muiTheme.shadows[2] : 'none',
        color: 'var(--color-text)',
        zIndex: 1100,
        transition: 'background 0.2s ease, box-shadow 0.2s ease',
        ...(blurEnabled && {
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }),
      }}
    >
      <Toolbar sx={{ gap: 1, minHeight: { xs: 56, sm: 64 }, px: { xs: 1.5, md: 2.5 } }}>

        {/* ── Mobile hamburger ── */}
        {isMobile && (
          <IconButton
            onClick={() => dispatch(toggleSidebar())}
            sx={{ color: 'var(--color-text)', mr: 0.25 }}
            aria-label="Open navigation"
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* ── Brand mark ── */}
        <Box
          component={RouterLink}
          to={`/${persona || 'citizen'}/home`}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', flexShrink: 0 }}
        >
          <Box sx={{
            width: 32, height: 32, borderRadius: `${RADIUS.md}px`,
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
          }}>
            ⚖️
          </Box>
          {!isMobile && (
            <GradientHeading
              variant="h6"
              component="span"
              sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1 }}
            >
              NyayaSetu
            </GradientHeading>
          )}
        </Box>

        {/* ── Desktop: nav links center ── */}
        {!isMobile && (
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 3 }}>
            <DesktopNavLinks links={navLinks} theme={muiTheme} />
          </Box>
        )}

        {/* Spacer on mobile */}
        {isMobile && <Box sx={{ flex: 1 }} />}

        {/* ── Right cluster ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: isMobile ? 0 : 'auto' }}>

          {/* SearchBar — desktop only, before language selector */}
          {!isMobile && <SearchBar />}

          {/* Language selector */}
          {!isMobile && <LanguageSelector size="small" />}

          {/* Theme switcher */}
          <ThemeSwitcher />

          {/* Notification bell */}
          <Tooltip title={t('nav.notifications', 'Notifications')}>
            <IconButton onClick={(e) => setBellAnchor(e.currentTarget)} sx={{ color: 'var(--color-text)' }} size="small">
              <Badge
                badgeContent={unread > 99 ? '99+' : unread}
                sx={{
                  '& .MuiBadge-badge': {
                    background: 'var(--color-error)', color: '#fff',
                    fontSize: '0.62rem', minWidth: 16, height: 16,
                  },
                }}
              >
                <motion.span
                  animate={unread > 0 && !prefersReducedMotion
                    ? { rotate: [0, -15, 15, -10, 10, 0] }
                    : {}}
                  transition={{ duration: 0.6, delay: 1, repeat: unread > 0 ? Infinity : 0, repeatDelay: 8 }}
                  style={{ display: 'inline-block', fontSize: 20 }}
                >
                  🔔
                </motion.span>
              </Badge>
            </IconButton>
          </Tooltip>

          {/* Avatar */}
          <Tooltip title={user?.name || 'Account'}>
            <Box
              onClick={(e) => setAvatarAnchor(e.currentTarget)}
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', ml: 0.25 }}
            >
              <Avatar sx={{
                width: 34, height: 34,
                background: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: 700,
                border: '2px solid var(--color-border)',
              }}>
                {initials}
              </Avatar>
              {!isMobile && (
                <Chip label={planStyle.label} size="small" sx={{
                  height: 20, fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
                  background: planStyle.bg, color: planStyle.color, borderRadius: `${RADIUS.sm}px`,
                }} />
              )}
            </Box>
          </Tooltip>
        </Box>
      </Toolbar>

      {/* Mobile search row */}
      {isMobile && (
        <Box sx={{ px: 2, pb: 1.5 }}><SearchBar /></Box>
      )}

      {/* Notification popover */}
      <NotificationPopover anchorEl={bellAnchor} onClose={() => setBellAnchor(null)} />

      {/* Avatar menu */}
      <Menu
        anchorEl={avatarAnchor}
        open={Boolean(avatarAnchor)}
        onClose={() => setAvatarAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1, minWidth: 220,
            borderRadius: `${RADIUS.lg}px`,
            border: '1px solid var(--color-border)',
            boxShadow: SHADOWS.lg,
            background: 'var(--color-surface)',
          },
        }}
      >
        <Box sx={{ px: 2.5, py: 1.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
            {user?.name || 'User'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {user?.phone || user?.email}
          </Typography>
          <Chip
            label={planStyle.label}
            size="small"
            sx={{ mt: 0.5, display: 'block', width: 'fit-content', background: planStyle.bg, color: planStyle.color, fontSize: '0.65rem', fontWeight: 700, height: 18 }}
          />
        </Box>

        <Divider sx={{ borderColor: 'var(--color-border)' }} />

        {[
          { icon: '⚙️', label: t('nav.settings', 'Settings'), path: `/${persona}/settings` },
          { icon: '⭐', label: t('nav.upgrade', 'Upgrade Plan'), path: '/pricing', highlight: true },
        ].map((item) => (
          <MenuItem
            key={item.path}
            onClick={() => { navigate(item.path); setAvatarAnchor(null); }}
            sx={{
              gap: 1.5,
              color: item.highlight ? 'var(--color-primary)' : 'var(--color-text)',
              '&:hover': { background: item.highlight ? 'var(--color-primary-alpha)' : 'var(--color-overlay)' },
            }}
          >
            <Typography sx={{ fontSize: 17 }}>{item.icon}</Typography>
            <Typography variant="body2" sx={{ fontWeight: item.highlight ? 600 : 400 }}>
              {item.label}
            </Typography>
          </MenuItem>
        ))}

        <Divider sx={{ borderColor: 'var(--color-border)' }} />

        <MenuItem
          onClick={handleLogout}
          sx={{ gap: 1.5, color: 'var(--color-error)', '&:hover': { background: 'var(--color-error-light, #FFEBEE)' } }}
        >
          <Typography sx={{ fontSize: 17 }}>🚪</Typography>
          <Typography variant="body2">{t('nav.logout', 'Sign Out')}</Typography>
        </MenuItem>
      </Menu>

    </AppBar>
  );
}

export default Navbar;

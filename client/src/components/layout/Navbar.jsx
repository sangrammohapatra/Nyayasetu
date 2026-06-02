/**
 * client/src/components/layout/Navbar.jsx
 *
 * Full Navbar with notification bell popover, avatar dropdown,
 * theme switcher and search — all accessible from one component.
 */

import React, { useState, useCallback } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

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
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { selectUser, selectUserPlan, selectUserPersona, logout } from '../../store/slices/authSlice';
import {
  selectNotifications, selectUnreadTotal,
  fetchNotifications, markNotificationRead, markAllNotificationsRead,
} from '../../store/slices/notificationSlice';
import { setTheme, selectTheme, toggleSidebar } from '../../store/slices/uiSlice';
import { RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Statics ─────────────────────────────────────────────────────────────────

const THEME_SWATCHES = [
  { id: 'default', color: '#1565C0', label: 'Blue' },
  { id: 'saffron', color: '#FF6F00', label: 'Saffron' },
  { id: 'dark',    color: '#161B22', label: 'Dark' },
  { id: 'emerald', color: '#00695C', label: 'Emerald' },
  { id: 'highContrast', color: '#000000', label: 'A11y' },
];

const PLAN_STYLES = {
  free:         { label: 'FREE',  bg: 'var(--color-border)',         color: 'var(--color-text-secondary)' },
  basic:        { label: 'BASIC', bg: 'var(--color-primary-alpha)',  color: 'var(--color-primary)' },
  pro:          { label: 'PRO',   bg: 'var(--color-warning)',        color: '#fff' },
  professional: { label: 'PRO',   bg: 'var(--color-primary)',        color: '#fff' },
  firm:         { label: 'FIRM',  bg: 'var(--color-warning)',        color: '#fff' },
};

const NOTIF_ICONS = {
  hearing_reminder:        '📅',
  document_ready:          '📄',
  consultation_accepted:   '✅',
  consultation_rejected:   '❌',
  consultation_completed:  '🎉',
  consultation_completed_: '🎉',
  lawyer_verified:         '⚖️',
  lawyer_application:      '📋',
  new_consultation_request:'🔔',
  default:                 '🔔',
};

function timeAgo(date) {
  if (!date) return '';
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60)  return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
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
        {/* Header */}
        <Box sx={{
          px: 2.5, py: 1.75,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
              🔔 {t('notif.title', 'Notifications')}
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
              {t('notif.markAllRead', 'Mark all read')}
            </Button>
          )}
        </Box>

        {/* List */}
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
                {t('notif.empty', "You're all caught up!")}
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mt: 0.5 }}>
                {t('notif.emptyDesc', 'Notifications about hearings, documents, and consultations will appear here.')}
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
                    {/* Icon dot */}
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
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
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

        {/* Footer */}
        <Box sx={{ px: 2.5, py: 1.5, borderTop: '1px solid var(--color-border)', textAlign: 'center' }}>
          <Typography variant="caption" sx={{ color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
            onClick={onClose}>
            {t('notif.close', 'Close')}
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
      width: { md: 280, lg: 360 },
      transition: 'border-color 0.2s, box-shadow 0.2s',
      '&:focus-within': { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 3px var(--color-primary-alpha)' },
    }}>
      <Typography sx={{ fontSize: 15, mr: 1, opacity: 0.5 }}>🔍</Typography>
      <InputBase
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && value.trim()) { navigate(`/laws/search?q=${encodeURIComponent(value)}`); setValue(''); }}}
        placeholder={t('navbar.search', 'Search laws, documents…')}
        sx={{ flex: 1, fontSize: '0.875rem', color: 'var(--color-text)' }}
      />
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

  const user = useSelector(selectUser);
  const plan = useSelector(selectUserPlan);
  const persona = useSelector(selectUserPersona);
  const unread = useSelector(selectUnreadTotal);
  const currentTheme = useSelector(selectTheme);

  const [avatarAnchor, setAvatarAnchor] = useState(null);
  const [bellAnchor, setBellAnchor] = useState(null);

  const handleLogout = useCallback(async () => {
    setAvatarAnchor(null);
    await dispatch(logout());
    navigate('/login', { replace: true });
  }, [dispatch, navigate]);

  const planStyle = PLAN_STYLES[plan] || PLAN_STYLES.free;
  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <AppBar position="sticky" elevation={0} sx={{
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)',
      color: 'var(--color-text)',
      zIndex: 1100,
    }}>
      <Toolbar sx={{ gap: 1.5, minHeight: { xs: 56, sm: 64 } }}>
        {isMobile && (
          <IconButton onClick={() => dispatch(toggleSidebar())} sx={{ color: 'var(--color-text)', mr: 0.5 }}>
            ☰
          </IconButton>
        )}

        {/* Logo */}
        <Box component={RouterLink} to={`/${persona}/home`}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none', flexShrink: 0 }}>
          <Box sx={{
            width: 34, height: 34, borderRadius: `${RADIUS.md}px`,
            background: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>⚖️</Box>
          {!isMobile && (
            <Typography sx={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: '1.15rem', color: 'var(--color-primary)' }}>
              NyayaSetu
            </Typography>
          )}
        </Box>

        {!isMobile && (
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <SearchBar />
          </Box>
        )}
        <Box sx={{ flex: isMobile ? 1 : 'none' }} />

        {/* Notification bell */}
        <Tooltip title={t('navbar.notifications', 'Notifications')}>
          <IconButton onClick={(e) => setBellAnchor(e.currentTarget)} sx={{ color: 'var(--color-text)' }}>
            <Badge
              badgeContent={unread > 99 ? '99+' : unread}
              sx={{ '& .MuiBadge-badge': { background: 'var(--color-error)', color: '#fff', fontSize: '0.62rem', minWidth: 16, height: 16 } }}
            >
              <motion.span
                animate={unread > 0 ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
                transition={{ duration: 0.6, delay: 1, repeat: unread > 0 ? Infinity : 0, repeatDelay: 8 }}
                style={{ display: 'inline-block', fontSize: 22 }}
              >
                🔔
              </motion.span>
            </Badge>
          </IconButton>
        </Tooltip>

        {/* Avatar */}
        <Tooltip title={user?.name || 'Account'}>
          <Box onClick={(e) => setAvatarAnchor(e.currentTarget)}
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', ml: 0.5 }}>
            <Avatar sx={{
              width: 36, height: 36,
              background: 'var(--color-primary)', fontSize: '0.85rem', fontWeight: 700,
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
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>{user?.name || 'User'}</Typography>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>{user?.phone || user?.email}</Typography>
            <Chip label={planStyle.label} size="small" sx={{ mt: 0.5, display: 'block', width: 'fit-content', background: planStyle.bg, color: planStyle.color, fontSize: '0.65rem', fontWeight: 700, height: 18 }} />
          </Box>

          <Divider sx={{ borderColor: 'var(--color-border)' }} />

          {[
            { icon: '⚙️', label: t('navbar.settings', 'Settings'), path: `/${persona}/settings` },
            { icon: '⭐', label: t('navbar.upgrade', 'Upgrade Plan'), path: '/pricing', highlight: true },
          ].map((item) => (
            <MenuItem key={item.path}
              onClick={() => { navigate(item.path); setAvatarAnchor(null); }}
              sx={{
                gap: 1.5,
                color: item.highlight ? 'var(--color-primary)' : 'var(--color-text)',
                '&:hover': { background: item.highlight ? 'var(--color-primary-alpha)' : 'var(--color-overlay)' },
                background: location.pathname === item.path || location.pathname.startsWith(item.path + '/') ? 'var(--color-primary-alpha)' : 'transparent',
              }}>
              <Typography sx={{ fontSize: 17 }}>{item.icon}</Typography>
              <Typography variant="body2" sx={{ fontWeight: item.highlight ? 600 : 400 }}>{item.label}</Typography>
            </MenuItem>
          ))}

          <Divider sx={{ borderColor: 'var(--color-border)' }} />

          {/* Theme row */}
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', fontWeight: 600, display: 'block', mb: 1 }}>
              {t('navbar.theme', 'Theme')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {THEME_SWATCHES.map((sw) => (
                <Tooltip key={sw.id} title={sw.label} arrow>
                  <Box
                    onClick={() => dispatch(setTheme(sw.id))}
                    sx={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: sw.color, cursor: 'pointer',
                      border: currentTheme === sw.id ? '2.5px solid var(--color-text)' : '1.5px solid var(--color-border)',
                      transition: 'transform 0.15s',
                      '&:hover': { transform: 'scale(1.2)' },
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>

          <Divider sx={{ borderColor: 'var(--color-border)' }} />

          <MenuItem onClick={handleLogout}
            sx={{ gap: 1.5, color: 'var(--color-error)', '&:hover': { background: 'var(--color-error-light, #FFEBEE)' } }}>
            <Typography sx={{ fontSize: 17 }}>🚪</Typography>
            <Typography variant="body2">{t('navbar.logout', 'Sign Out')}</Typography>
          </MenuItem>
        </Menu>
      </Toolbar>

      {isMobile && (
        <Box sx={{ px: 2, pb: 1.5 }}><SearchBar /></Box>
      )}
    </AppBar>
  );
}

export default Navbar;

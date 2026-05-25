/**
 * client/src/components/layout/BottomNav.jsx
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { selectUserPersona } from '../../store/slices/authSlice';
import { selectUnreadTotal } from '../../store/slices/notificationSlice';
import { SHADOWS } from '../../theme/tokens';

// ─── Nav items per persona ────────────────────────────────────────────────────

function useBottomNavItems(persona, t, unread) {
  const citizen = [
    { icon: '🏠', label: t('nav.home', 'Home'),          path: '/citizen/home' },
    { icon: '📝', label: t('nav.new', 'New Doc'),         path: '/citizen/documents/new' },
    { icon: '⚖️', label: t('nav.cases', 'Cases'),         path: '/citizen/cases' },
    { icon: '👨‍⚖️', label: t('nav.lawyers', 'Lawyers'),   path: '/citizen/lawyers' },
    {
      icon: '🔔',
      label: t('nav.alerts', 'Alerts'),
      path: '/notifications',
      badge: unread,
    },
  ];

  const lawyer = [
    { icon: '🏠',  label: t('nav.home', 'Home'),               path: '/lawyer/home' },
    { icon: '👥',  label: t('nav.clients', 'Clients'),          path: '/lawyer/clients' },
    { icon: '📅',  label: t('nav.consultations', 'Sessions'),   path: '/lawyer/consultations' },
    { icon: '💰',  label: t('nav.earnings', 'Earnings'),        path: '/lawyer/earnings' },
    { icon: '🔔',  label: t('nav.alerts', 'Alerts'),            path: '/notifications', badge: unread },
  ];

  const admin = [
    { icon: '📊', label: t('nav.dashboard', 'Dashboard'), path: '/admin/dashboard' },
    { icon: '👥', label: t('nav.users', 'Users'),          path: '/admin/users' },
    { icon: '📄', label: t('nav.templates', 'Templates'),  path: '/admin/templates' },
    { icon: '⚖️', label: t('nav.lawyers', 'Lawyers'),     path: '/admin/lawyers' },
    { icon: '📈', label: t('nav.stats', 'Stats'),          path: '/admin/analytics' },
  ];

  return ({ citizen, lawyer, paralegal: lawyer, admin }[persona] || citizen);
}

// ─── Animated icon ────────────────────────────────────────────────────────────

function AnimatedIcon({ icon, isActive, badge }) {
  return (
    <motion.div
      animate={isActive ? { scale: 1.22 } : { scale: 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Badge
        badgeContent={badge || 0}
        max={99}
        sx={{
          '& .MuiBadge-badge': {
            background: 'var(--color-error)',
            color: '#fff',
            fontSize: '0.6rem',
            minWidth: 16,
            height: 16,
            padding: '0 4px',
          },
        }}
      >
        <Typography sx={{ fontSize: isActive ? 22 : 20, lineHeight: 1 }}>{icon}</Typography>
      </Badge>
    </motion.div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const persona = useSelector(selectUserPersona);
  const unread = useSelector(selectUnreadTotal);
  const navItems = useBottomNavItems(persona || 'citizen', t, unread);

  // Hidden on desktop
  if (!isMobile) return null;

  const activeIndex = navItems.findIndex(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  );

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: `0 -4px 20px var(--color-primary-alpha)`,
        // Safe area for notched phones
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        value={activeIndex}
        onChange={(_, newIndex) => navigate(navItems[newIndex].path)}
        showLabels
        sx={{
          background: 'transparent',
          height: 60,
          '& .MuiBottomNavigationAction-root': {
            color: 'var(--color-text-secondary)',
            minWidth: 0,
            padding: '6px 0 2px',
            '&.Mui-selected': { color: 'var(--color-primary)' },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.65rem',
            fontFamily: "'DM Sans',sans-serif",
            fontWeight: 500,
            '&.Mui-selected': { fontSize: '0.65rem', fontWeight: 700 },
          },
        }}
      >
        {navItems.map((item, i) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={
              <AnimatedIcon
                icon={item.icon}
                isActive={i === activeIndex}
                badge={item.badge}
              />
            }
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}

export default BottomNav;

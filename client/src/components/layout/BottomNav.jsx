/**
 * client/src/components/layout/BottomNav.jsx
 *
 * Mobile-only fixed bottom navigation (display: xs flex, md none).
 * Active tab shows a spring-animated dot above the icon via layoutId "nav-dot".
 * Role-conditional rendering is unchanged.
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';

import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';

import { selectUserPersona } from '../../store/slices/authSlice';
import { selectUnreadTotal } from '../../store/slices/notificationSlice';
import { TYPOGRAPHY } from '../../theme/tokens';

// ─── Lordicon CDN icon URLs ───────────────────────────────────────────────────

const IC = {
  home:          'https://cdn.lordicon.com/wmwqvixz.json',
  newDoc:        'https://cdn.lordicon.com/mubdgyyw.json',
  caseTracker:   'https://cdn.lordicon.com/warimioc.json',
  findLawyer:    'https://cdn.lordicon.com/kkvxgpti.json',
  notifications: 'https://cdn.lordicon.com/psnhyobz.json',
  clients:       'https://cdn.lordicon.com/oqjlkyvy.json',
  consultations: 'https://cdn.lordicon.com/slduhdil.json',
  earnings:      'https://cdn.lordicon.com/rfbqeber.json',
  dashboard:     'https://cdn.lordicon.com/dxoycpzg.json',
  users:         'https://cdn.lordicon.com/oqjlkyvy.json',
  templates:     'https://cdn.lordicon.com/wloilxuq.json',
  lawyers:       'https://cdn.lordicon.com/mxxgldoo.json',
};

// ─── Nav items per persona ────────────────────────────────────────────────────

function useBottomNavItems(persona, t, unread) {
  const citizen = [
    { icon: IC.home,          label: t('nav.home',          'Home'),     path: '/citizen/home' },
    { icon: IC.newDoc,        label: t('nav.new_doc',        'New Doc'),  path: '/citizen/documents/new' },
    { icon: IC.caseTracker,   label: t('nav.cases',          'Cases'),    path: '/citizen/cases' },
    { icon: IC.findLawyer,    label: t('nav.lawyers',        'Lawyers'),  path: '/citizen/lawyers' },
    { icon: IC.notifications, label: t('nav.alerts',         'Alerts'),   path: '/notifications', badge: unread },
  ];

  const lawyer = [
    { icon: IC.home,          label: t('nav.home',          'Home'),        path: '/lawyer/home' },
    { icon: IC.clients,       label: t('nav.clients',       'Clients'),     path: '/lawyer/clients' },
    { icon: IC.consultations, label: t('nav.consultations', 'Sessions'),    path: '/lawyer/consultations' },
    { icon: IC.earnings,      label: t('nav.earnings',      'Earnings'),    path: '/lawyer/earnings' },
    { icon: IC.notifications, label: t('nav.alerts',        'Alerts'),      path: '/notifications', badge: unread },
  ];

  const admin = [
    { icon: IC.dashboard, label: t('nav.dashboard',  'Dashboard'), path: '/admin/dashboard' },
    { icon: IC.users,     label: t('nav.users',      'Users'),      path: '/admin/users' },
    { icon: IC.templates, label: t('nav.templates',  'Templates'),  path: '/admin/templates' },
    { icon: IC.lawyers,   label: t('nav.lawyers',    'Lawyers'),    path: '/admin/lawyers' },
  ];

  const notary = [
    { icon: IC.home,          label: 'Home',     path: '/notary/home' },
    { icon: IC.consultations, label: 'Requests', path: '/notary/requests' },
    { icon: IC.dashboard,     label: 'Profile',  path: '/notary/profile' },
  ];

  return ({ citizen, lawyer, paralegal: lawyer, admin, notary }[persona] || citizen);
}

// ─── Animated icon with dot ───────────────────────────────────────────────────

function NavIcon({ src, isActive, badge, prefersReducedMotion: reducedMotion }) {
  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Reserve space for the dot above the icon
        pt: '8px',
      }}
    >
      {/* Animated active dot — layoutId makes it spring between tabs */}
      {isActive && !reducedMotion && (
        <motion.div
          layoutId="nav-dot"
          style={{
            position: 'absolute',
            top: 0,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--color-primary)',
          }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        />
      )}
      {/* Static dot fallback for reduced-motion */}
      {isActive && reducedMotion && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--color-primary)',
          }}
        />
      )}

      <motion.div
        animate={isActive ? { scale: 1.15 } : { scale: 1 }}
        transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 18 }}
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
          <Box className="ns-bn-item" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <lord-icon
              src={src}
              trigger="click"
              target=".ns-bn-item"
              style={{
                width: isActive ? 26 : 24,
                height: isActive ? 26 : 24,
                '--lord-icon-primary': 'currentColor',
                '--lord-icon-secondary': 'currentColor',
              }}
            />
          </Box>
        </Badge>
      </motion.div>
    </Box>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();

  const persona = useSelector(selectUserPersona);
  const unread = useSelector(selectUnreadTotal);
  const navItems = useBottomNavItems(persona || 'citizen', t, unread);

  const activeIndex = navItems.findIndex(
    (item) => location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  );

  return (
    <Paper
      elevation={0}
      sx={{
        display: { xs: 'block', md: 'none' },
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: '0 -4px 20px var(--color-primary-alpha)',
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
            padding: '4px 0 2px',
            '&.Mui-selected': { color: 'var(--color-primary)' },
          },
          '& .MuiBottomNavigationAction-label': {
            fontSize: '0.65rem',
            fontFamily: TYPOGRAPHY.fontFamily.body,
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
              <NavIcon
                src={item.icon}
                isActive={i === activeIndex}
                badge={item.badge}
                prefersReducedMotion={prefersReducedMotion}
              />
            }
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}

export default BottomNav;

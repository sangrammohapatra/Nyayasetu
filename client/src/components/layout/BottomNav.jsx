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
import Paper from '@mui/material/Paper';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import NoteAddRoundedIcon from '@mui/icons-material/NoteAddRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import EventNoteRoundedIcon from '@mui/icons-material/EventNoteRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';

import { selectUserPersona, selectLawyerProfile, selectNotaryProfile, selectProfilesHydrated } from '../../store/slices/authSlice';
import { selectUnreadTotal } from '../../store/slices/notificationSlice';
import { TYPOGRAPHY } from '../../theme/tokens';

// ─── Lordicon CDN icon URLs ───────────────────────────────────────────────────

const IC = {
  home:          HomeRoundedIcon,
  newDoc:        NoteAddRoundedIcon,
  caseTracker:   AccountBalanceRoundedIcon,
  rti:           AssignmentRoundedIcon,
  findLawyer:    PersonSearchRoundedIcon,
  notifications: NotificationsNoneRoundedIcon,
  clients:       PeopleAltRoundedIcon,
  consultations: EventNoteRoundedIcon,
  earnings:      AccountBalanceWalletRoundedIcon,
  dashboard:     DashboardRoundedIcon,
  users:         PeopleAltRoundedIcon,
  templates:     DescriptionRoundedIcon,
  lawyers:       GavelRoundedIcon,
};

// ─── Nav items per persona ────────────────────────────────────────────────────

function useBottomNavItems(persona, t, unread) {
  const profilesHydrated = useSelector(selectProfilesHydrated);
  const lawyerProfile = useSelector(selectLawyerProfile);
  const notaryProfile = useSelector(selectNotaryProfile);
  const lawyerApproved = !profilesHydrated || (lawyerProfile?.isVerified === true && lawyerProfile?.verificationStatus === 'approved');
  const notaryApproved = !profilesHydrated || (notaryProfile?.isVerified === true && notaryProfile?.verificationStatus === 'approved');

  const citizen = [
    { icon: IC.home,          label: t('nav.home',          'Home'),     path: '/citizen/home' },
    { icon: IC.newDoc,        label: t('nav.new_doc',        'New Doc'),  path: '/citizen/documents/new' },
    { icon: IC.caseTracker,   label: t('nav.cases',          'Cases'),    path: '/citizen/cases' },
    { icon: IC.rti,           label: t('nav.rti',            'RTI'),      path: '/citizen/rti' },
    { icon: IC.findLawyer,    label: t('nav.lawyers',        'Lawyers'),  path: '/citizen/lawyers' },
  ];

  const lawyer = lawyerApproved ? [
    { icon: IC.home,          label: t('nav.home',          'Home'),        path: '/lawyer/home' },
    { icon: IC.clients,       label: t('nav.clients',       'Clients'),     path: '/lawyer/clients' },
    { icon: IC.consultations, label: t('nav.consultations', 'Sessions'),    path: '/lawyer/consultations' },
    { icon: IC.earnings,      label: t('nav.earnings',      'Earnings'),    path: '/lawyer/earnings' },
    { icon: IC.notifications, label: t('nav.alerts',        'Alerts'),      path: '/notifications', badge: unread },
  ] : [
    { icon: IC.home, label: t('nav.application', 'Application'), path: '/lawyer/profile' },
  ];

  const admin = [
    { icon: IC.dashboard, label: t('nav.dashboard',  'Dashboard'), path: '/admin/dashboard' },
    { icon: IC.users,     label: t('nav.users',      'Users'),      path: '/admin/users' },
    { icon: IC.templates, label: t('nav.templates',  'Templates'),  path: '/admin/templates' },
    { icon: IC.lawyers,   label: t('nav.lawyers',    'Lawyers'),    path: '/admin/lawyers' },
  ];

  const notary = notaryApproved ? [
    { icon: IC.home,          label: t('nav.home', 'Home'),           path: '/notary/home' },
    { icon: IC.consultations, label: t('sidebar.requests', 'Requests'), path: '/notary/requests' },
    { icon: IC.dashboard,     label: t('nav.profile', 'Profile'),      path: '/notary/profile' },
  ] : [
    { icon: IC.home, label: t('nav.application', 'Application'), path: '/notary/apply' },
  ];

  return ({ citizen, lawyer, admin, notary }[persona] || citizen);
}

// ─── Animated icon with dot ───────────────────────────────────────────────────

function NavIcon({ Icon, isActive, badge }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Badge
        badgeContent={badge || 0}
        max={99}
        sx={{
          '& .MuiBadge-badge': {
            background: 'var(--color-error)',
            color: 'var(--color-bg)',
            fontSize: '0.6rem',
            minWidth: 16,
            height: 16,
            padding: '0 4px',
          },
        }}
      >
        <Icon sx={{ fontSize: 22, color: isActive ? 'var(--color-primary)' : 'inherit' }} />
      </Badge>
    </Box>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

function BottomNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
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
        boxShadow: 'none',
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
                Icon={item.icon}
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

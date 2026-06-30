/**
 * client/src/components/layout/Sidebar.jsx
 *
 * Desktop-only collapsible sidebar (xs: none, md: flex).
 * Mobile: Drawer controlled by Redux sidebarOpen.
 *
 * Collapsed state is self-managed and persisted to localStorage.
 * Role-conditional nav rendering is unchanged.
 */

import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';
import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded';
import GavelRounded from '@mui/icons-material/GavelRounded';
import CalendarMonthRounded from '@mui/icons-material/CalendarMonthRounded';
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded';

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';


import { selectUser, selectUserPlan, selectUserPersona } from '../../store/slices/authSlice';
import { selectFreeUsage } from '../../store/slices/subscriptionSlice';
import { selectSidebarOpen, setSidebarOpen } from '../../store/slices/uiSlice';
import { RADIUS, SHADOWS } from '../../theme/tokens';

const SIDEBAR_FULL = 248;

// ─── Sidebar icons — served from /public/icons/ (same-origin, no CDN dep.) ───
// Values are either a local JSON path string (Lordicon) or an MUI icon component
// for the 3 IDs that returned 404 on Lordicon's CDN.

const IC = {
  home:          '/icons/wmwqvixz.json',
  newDoc:        '/icons/mubdgyyw.json',
  myDocs:        '/icons/jqqjtvlf.json',
  caseTracker:   '/icons/warimioc.json',
  rtiTracker:    '/icons/warimioc.json', // reuse case tracker icon
  findLawyer:    '/icons/kkvxgpti.json',
  pricing:       '/icons/qhviklyi.json',
  clients:       PeopleAltRounded,    // oqjlkyvy.json → 404 on CDN
  cases:         '/icons/gjjvytyq.json',
  consultations: '/icons/slduhdil.json',
  earnings:      '/icons/rfbqeber.json',
  dashboard:     '/icons/dxoycpzg.json',
  users:         PeopleAltRounded,    // oqjlkyvy.json → 404 on CDN
  templates:     '/icons/wloilxuq.json',
  lawyers:       GavelRounded,           // mxxgldoo.json → 404 on CDN
  notaries:      VerifiedUserRounded,    // represents official credential verification
  calendar:      CalendarMonthRounded,  // abvsilmk.json → 404 on CDN
};

// ─── Nav definitions per persona — grouped by section ────────────────────────

function useNavItems(persona, t) {
  return useMemo(() => {
    const citizen = [
      { section: t('sidebar.section_main', 'Main') },
      { icon: IC.home,        label: t('sidebar.home',        'Home'),          path: '/citizen/home' },
      { icon: IC.newDoc,      label: t('sidebar.newDoc',      'New Document'),  path: '/citizen/documents/new' },
      { icon: IC.myDocs,      label: t('sidebar.myDocs',      'My Documents'),  path: '/citizen/documents', exact: true },
      { section: t('sidebar.section_legal', 'Legal') },
      { icon: IC.caseTracker, label: t('sidebar.caseTracker', 'Case Tracker'),  path: '/citizen/cases' },
      { icon: IC.rtiTracker,  label: t('sidebar.rtiTracker',  'RTI Tracker'),   path: '/citizen/rti' },
      { icon: IC.findLawyer,  label: t('sidebar.findLawyer',  'Find Lawyer'),   path: '/citizen/lawyers' },
      { icon: IC.calendar,    label: t('sidebar.calendar',    'Calendar'),      path: '/citizen/calendar' },
      { section: t('sidebar.section_account', 'Account') },
      { icon: IC.pricing,     label: t('sidebar.pricing',     'Pricing'),       path: '/pricing' },
    ];

    const lawyer = [
      { section: t('sidebar.section_main', 'Main') },
      { icon: IC.home,          label: t('sidebar.home',          'Home'),          path: '/lawyer/home' },
      { icon: IC.clients,       label: t('sidebar.clients',       'My Clients'),    path: '/lawyer/clients' },
      { icon: IC.cases,         label: t('sidebar.cases',         'Cases'),         path: '/lawyer/cases' },
      { icon: IC.calendar,      label: t('sidebar.calendar',      'Calendar'),      path: '/lawyer/calendar' },
      { section: t('sidebar.section_business', 'Business') },
      { icon: IC.consultations, label: t('sidebar.consultations', 'Consultations'), path: '/lawyer/consultations' },
      { icon: IC.earnings,      label: t('sidebar.earnings',      'Earnings'),      path: '/lawyer/earnings' },
    ];

    const admin = [
      { section: t('sidebar.section_admin', 'Administration') },
      { icon: IC.dashboard,     label: t('sidebar.dashboard',     'Dashboard'),     path: '/admin/dashboard' },
      { icon: IC.users,         label: t('sidebar.users',         'Users'),         path: '/admin/users' },
      { icon: IC.templates,     label: t('sidebar.templates',     'Templates'),     path: '/admin/templates' },
      { icon: IC.lawyers,       label: t('sidebar.lawyers',       'Lawyers'),       path: '/admin/lawyers' },
      { icon: IC.notaries,      label: t('sidebar.notaries',      'Notaries'),      path: '/admin/notaries' },
      { icon: IC.rtiTracker,    label: t('sidebar.rtiDashboard',  'RTI Dashboard'), path: '/admin/rti' },
      { section: t('sidebar.section_moderation', 'Moderation') },
      { icon: IC.earnings,      label: t('sidebar.payments',      'Payments'),      path: '/admin/payments' },
      { icon: IC.consultations, label: t('sidebar.consultations', 'Consultations'), path: '/admin/consultations' },
      { icon: IC.myDocs,        label: t('sidebar.documents',     'Documents'),     path: '/admin/documents' },
      { icon: IC.cases,         label: t('sidebar.auditLog',      'Audit Log'),     path: '/admin/audit-logs' },
    ];

    const notary = [
      { section: 'Notary' },
      { icon: IC.home,          label: 'Home',           path: '/notary/home' },
      { icon: IC.consultations, label: 'Requests',       path: '/notary/requests' },
      { icon: IC.calendar,      label: 'Calendar',       path: '/notary/calendar' },
      { icon: IC.dashboard,     label: 'My Profile',     path: '/notary/profile' },
    ];

    return { citizen, lawyer, admin, notary }[persona] || citizen;
  }, [persona, t]);
}

// ─── Single nav item ──────────────────────────────────────────────────────────

function NavItem({ icon, label, path, collapsed, isActive }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const prefersReducedMotion = useReducedMotion();

  const item = (
    <motion.div whileHover={prefersReducedMotion ? undefined : { x: collapsed ? 0 : 3 }} transition={{ duration: 0.15 }}>
      <Box
        className="ns-nav-item"
        onClick={() => navigate(path)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : 1.5,
          px: collapsed ? 0 : 2,
          py: 1.1,
          mx: collapsed ? 'auto' : 1,
          borderRadius: `${RADIUS.md}px`,
          cursor: 'pointer',
          justifyContent: collapsed ? 'center' : 'flex-start',
          width: collapsed ? 44 : 'auto',
          height: 44,
          position: 'relative',
          transition: 'background 0.18s, color 0.18s',
          background: isActive ? 'var(--color-primary-alpha)' : 'transparent',
          color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
          '&:hover': {
            background: isActive ? 'var(--color-primary-alpha)' : 'var(--color-overlay)',
            color: 'var(--color-primary)',
          },
          // Gradient left border for active state (desktop expanded only)
          '&::before': isActive && !collapsed ? {
            content: '""',
            position: 'absolute',
            left: -8, // sit flush with the mx:1 margin
            top: '10%',
            width: 3,
            height: '80%',
            borderRadius: '0 2px 2px 0',
            background: theme.custom?.gradientBrand || 'var(--color-primary)',
          } : {},
        }}
      >
        {typeof icon === 'string' ? (
          <lord-icon
            src={icon}
            trigger="loop-on-hover"
            delay="500"
            target=".ns-nav-item"
            style={{
              width: 22,
              height: 22,
              flexShrink: 0,
              '--lord-icon-primary': 'currentColor',
              '--lord-icon-secondary': 'currentColor',
            }}
          />
        ) : (
          React.createElement(icon, {
            sx: { width: 22, height: 22, flexShrink: 0, color: 'inherit', fontSize: 22 },
          })
        )}
        {!collapsed && (
          <Typography variant="body2" sx={{ fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap' }}>
            {label}
          </Typography>
        )}
      </Box>
    </motion.div>
  );

  return collapsed ? (
    <Tooltip title={label} placement="right" arrow>
      {item}
    </Tooltip>
  ) : item;
}

// ─── Subscription status card ─────────────────────────────────────────────────

function SubscriptionCard({ collapsed, plan, freeUsage }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  if (collapsed || plan !== 'free') return null;

  const docsUsed = freeUsage?.docsGenerated || 0;
  const docsLimit = freeUsage?.docsLimit || 3;
  const pct = Math.min(100, (docsUsed / docsLimit) * 100);

  return (
    <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <Box sx={{
        mx: 1.5, mb: 2, p: 1.75,
        borderRadius: `${RADIUS.lg}px`,
        background: 'var(--color-primary-alpha)',
        border: '1px solid var(--color-border)',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-primary)' }}>
            🆓 {t('sidebar.freePlan', 'Free Plan')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {docsUsed}/{docsLimit} {t('sidebar.docs', 'docs')}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 5, borderRadius: 3, mb: 1.25,
            background: 'var(--color-border)',
            '& .MuiLinearProgress-bar': {
              background: pct >= 80 ? 'var(--color-warning)' : 'var(--color-primary)',
              borderRadius: 3,
            },
          }}
        />
        <Button
          fullWidth size="small" variant="contained"
          onClick={() => navigate('/pricing')}
          sx={{
            py: 0.6, fontWeight: 700, fontSize: '0.72rem',
            background: 'var(--color-primary)', borderRadius: `${RADIUS.md}px`,
            '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
          }}
        >
          {t('sidebar.upgrade', 'Upgrade → ₹99/mo')}
        </Button>
      </Box>
    </motion.div>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent() {
  const { t } = useTranslation();
  const location = useLocation();
  const persona = useSelector(selectUserPersona);
  const plan = useSelector(selectUserPlan);
  const freeUsage = useSelector(selectFreeUsage);
  const navItems = useNavItems(persona || 'citizen', t);

  return (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      overflow: 'hidden',
      width: SIDEBAR_FULL,
    }}>
      {/* Nav items */}
      <Box sx={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'var(--color-border)', borderRadius: 2 },
      }}>
        {navItems.map((item, idx) => {
          // Section header
          if (item.section) {
            return (
              <Box key={`section-${idx}`} sx={{ px: 2.5, pt: idx === 0 ? 1 : 2.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="overline"
                  sx={{
                    fontSize: '0.625rem',
                    letterSpacing: '0.12em',
                    color: 'var(--color-text-secondary)',
                    fontWeight: 700,
                    lineHeight: 1,
                    opacity: 0.7,
                  }}
                >
                  {item.section}
                </Typography>
                <Box sx={{ flex: 1, height: '1px', background: 'var(--color-border)', opacity: 0.6 }} />
              </Box>
            );
          }

          return (
            <NavItem
              key={item.path}
              {...item}
              collapsed={false}
              isActive={location.pathname === item.path || (!item.exact && location.pathname.startsWith(item.path + '/'))}
            />
          );
        })}
      </Box>

      {/* Subscription card */}
      <SubscriptionCard collapsed={false} plan={plan} freeUsage={freeUsage} />
    </Box>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

function Sidebar() {
  const dispatch = useDispatch();
  const sidebarOpen = useSelector(selectSidebarOpen);

  return (
    <>
      {/* Mobile Drawer — controlled by Redux sidebarOpen */}
      <Drawer
        open={sidebarOpen}
        onClose={() => dispatch(setSidebarOpen(false))}
        sx={{ display: { xs: 'block', md: 'none' } }}
        PaperProps={{
          sx: {
            width: SIDEBAR_FULL,
            background: 'var(--color-surface)',
            border: 'none',
            boxShadow: SHADOWS.xl,
          },
        }}
      >
        <SidebarContent />
      </Drawer>

      {/* Desktop Sidebar — always expanded */}
      <Box
        component="nav"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexShrink: 0,
          width: SIDEBAR_FULL,
          position: 'sticky',
          top: 64,
          height: 'calc(100vh - 64px)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <SidebarContent />
      </Box>
    </>
  );
}

export default Sidebar;

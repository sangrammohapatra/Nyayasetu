/**
 * client/src/components/layout/Sidebar.jsx
 */

import React, { useMemo } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { selectUser, selectUserPlan, selectUserPersona } from '../../store/slices/authSlice';
import { selectFreeUsage } from '../../store/slices/subscriptionSlice';
import { selectSidebarOpen, setSidebarOpen } from '../../store/slices/uiSlice';
import { RADIUS, SHADOWS } from '../../theme/tokens';

const SIDEBAR_FULL = 240;
const SIDEBAR_COLLAPSED = 64;

// ─── Nav definitions per persona ─────────────────────────────────────────────

function useNavItems(persona, t) {
  return useMemo(() => {
    const citizen = [
      { icon: '🏠', label: t('sidebar.home', 'Home'),          path: '/citizen/home' },
      { icon: '📝', label: t('sidebar.newDoc', 'New Document'), path: '/citizen/documents/new' },
      { icon: '📂', label: t('sidebar.myDocs', 'My Documents'), path: '/citizen/documents' },
      { icon: '⚖️', label: t('sidebar.caseTracker', 'Case Tracker'), path: '/citizen/cases' },
      { icon: '👨‍⚖️', label: t('sidebar.findLawyer', 'Find Lawyer'), path: '/citizen/lawyers' },
      { icon: '👤', label: t('sidebar.profile', 'My Profile'),  path: '/citizen/profile' },
      { icon: '💎', label: t('sidebar.pricing', 'Pricing'),     path: '/pricing' },
      // { icon: '⚙️', label: t('sidebar.settings', 'Settings'),   path: '/settings' },
    ];

    const lawyer = [
      { icon: '🏠', label: t('sidebar.home', 'Home'),              path: '/lawyer/home' },
      { icon: '👥', label: t('sidebar.clients', 'My Clients'),     path: '/lawyer/clients' },
      { icon: '📋', label: t('sidebar.cases', 'Cases'),             path: '/lawyer/cases' },
      { icon: '📅', label: t('sidebar.consultations', 'Consultations'), path: '/lawyer/consultations' },
      { icon: '💰', label: t('sidebar.earnings', 'Earnings'),      path: '/lawyer/earnings' },
      { icon: '👤', label: t('sidebar.profile', 'My Profile'),     path: '/lawyer/profile' },
      // { icon: '⚙️', label: t('sidebar.settings', 'Settings'),      path: '/settings' },
    ];

    const admin = [
      { icon: '📊', label: t('sidebar.dashboard', 'Dashboard'),  path: '/admin/dashboard' },
      { icon: '👥', label: t('sidebar.users', 'Users'),          path: '/admin/users' },
      { icon: '📄', label: t('sidebar.templates', 'Templates'),  path: '/admin/templates' },
      { icon: '⚖️', label: t('sidebar.lawyers', 'Lawyers'),     path: '/admin/lawyers' },
      { icon: '📈', label: t('sidebar.analytics', 'Analytics'), path: '/admin/analytics' },
    ];

    return { citizen, lawyer, paralegal: lawyer, admin }[persona] || citizen;
  }, [persona, t]);
}

// ─── Single nav item ─────────────────────────────────────────────────────────

function NavItem({ icon, label, path, collapsed, isActive }) {
  const navigate = useNavigate();

  const item = (
    <motion.div whileHover={{ x: 3 }} transition={{ duration: 0.15 }}>
      <Box
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
          // Left accent bar
          '&::before': isActive ? {
            content: '""',
            position: 'absolute',
            left: collapsed ? '50%' : 0,
            transform: collapsed ? 'translateX(-50%)' : 'none',
            bottom: collapsed ? 0 : '20%',
            width: collapsed ? '60%' : 3,
            height: collapsed ? 3 : '60%',
            borderRadius: 4,
            background: 'var(--color-primary)',
          } : {},
        }}
      >
        <Typography sx={{ fontSize: 19, flexShrink: 0, lineHeight: 1 }}>{icon}</Typography>
        {!collapsed && (
          <Typography variant="body2" sx={{ fontWeight: isActive ? 700 : 500, whiteSpace: 'nowrap' }}>
            {label}
          </Typography>
        )}
      </Box>
    </motion.div>
  );

  return collapsed ? <Tooltip title={label} placement="right" arrow>{item}</Tooltip> : item;
}

// ─── Subscription status card ─────────────────────────────────────────────────

function SubscriptionCard({ collapsed, plan, freeUsage }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (collapsed || plan !== 'free') return null;

  const docsUsed = freeUsage?.docsGenerated || 0;
  const docsLimit = freeUsage?.docsLimit || 3;
  const pct = Math.min(100, (docsUsed / docsLimit) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
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
          fullWidth
          size="small"
          variant="contained"
          onClick={() => navigate('/pricing')}
          sx={{
            py: 0.6, fontWeight: 700, fontSize: '0.72rem',
            background: 'var(--color-primary)',
            borderRadius: `${RADIUS.md}px`,
            '&:hover': { background: 'var(--color-primary-dark, var(--color-primary))' },
          }}
        >
          {t('sidebar.upgrade', 'Upgrade → ₹99/mo')}
        </Button>
      </Box>
    </motion.div>
  );
}

// ─── Sidebar content ─────────────────────────────────────────────────────────

function SidebarContent({ collapsed, onToggle }) {
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
      transition: 'width 0.25s ease',
      width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL,
    }}>
      {/* Logo + collapse toggle */}
      <Box sx={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        px: collapsed ? 0 : 2, py: 1.75,
        borderBottom: '1px solid var(--color-border)',
        minHeight: 64,
      }}>
        {!collapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: `${RADIUS.sm}px`,
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>⚖️</Box>
            <Typography sx={{
              fontFamily: "'Playfair Display',serif", fontWeight: 700,
              fontSize: '1rem', color: 'var(--color-primary)',
            }}>
              NyayaSetu
            </Typography>
          </Box>
        )}
        <Tooltip title={collapsed ? t('sidebar.expand', 'Expand') : t('sidebar.collapse', 'Collapse')} placement="right">
          <IconButton onClick={onToggle} size="small" sx={{ color: 'var(--color-text-secondary)' }}>
            <Typography sx={{ fontSize: 16, transition: 'transform 0.25s', transform: collapsed ? 'rotate(180deg)' : 'none' }}>
              ‹
            </Typography>
          </IconButton>
        </Tooltip>
      </Box>

      {/* Nav items */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1.5,
        '&::-webkit-scrollbar': { width: 4 },
        '&::-webkit-scrollbar-thumb': { background: 'var(--color-border)', borderRadius: 2 },
      }}>
        {navItems.map((item) => (
          <NavItem
            key={item.path}
            {...item}
            collapsed={collapsed}
            isActive={location.pathname === item.path || location.pathname.startsWith(item.path + '/')}
          />
        ))}
      </Box>

      {/* Subscription card */}
      <SubscriptionCard collapsed={collapsed} plan={plan} freeUsage={freeUsage} />
    </Box>
  );
}

// ─── Main exported component ──────────────────────────────────────────────────

function Sidebar({ collapsed, onToggle }) {
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const dispatch = useDispatch();
  const sidebarOpen = useSelector(selectSidebarOpen);

  if (isMobile) {
    return (
      <Drawer
        open={sidebarOpen}
        onClose={() => dispatch(setSidebarOpen(false))}
        PaperProps={{
          sx: {
            width: SIDEBAR_FULL,
            background: 'var(--color-surface)',
            border: 'none',
            boxShadow: SHADOWS.xl,
          },
        }}
      >
        <SidebarContent collapsed={false} onToggle={() => dispatch(setSidebarOpen(false))} />
      </Drawer>
    );
  }

  return (
    <Box
      component="nav"
      sx={{
        flexShrink: 0,
        width: collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL,
        transition: 'width 0.25s ease',
        position: 'sticky',
        top: 64,
        height: 'calc(100vh - 64px)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <SidebarContent collapsed={collapsed} onToggle={onToggle} />
    </Box>
  );
}

export default Sidebar;

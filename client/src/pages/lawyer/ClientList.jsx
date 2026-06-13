/**
 * client/src/pages/lawyer/ClientList.jsx
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Divider from '@mui/material/Divider';

import { fetchMyClients, selectClients, selectLawyerLoading } from '../../store/slices/lawyerSlice';
import AnimatedPage from '../../components/ui/AnimatedPage';
import GradientHeading from '../../components/ui/GradientHeading';
import { RADIUS, SHADOWS, TYPOGRAPHY } from '../../theme/tokens';

function ClientRowSkeleton() {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderBottom: '1px solid var(--color-border)' }}>
      <Skeleton variant="circular" width={44} height={44} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="30%" height={20} />
        <Skeleton variant="text" width="55%" height={16} sx={{ mt: 0.5 }} />
      </Box>
      <Skeleton variant="rounded" width={64} height={32} />
    </Box>
  );
}

function ClientRow({ client, delay }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const u = client.user || {};
  const initials = u.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const casesCount = client.sharedCases?.length || 0;
  const consCount = client.consultations?.length || 0;

  const lastActivity = (() => {
    const dates = [
      ...(client.sharedCases || []).map((c) => c.createdAt),
      ...(client.consultations || []).map((c) => c.createdAt),
    ].filter(Boolean).map((d) => new Date(d));
    if (!dates.length) return null;
    return new Date(Math.max(...dates));
  })();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.32 }}
    >
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, p: 2,
        borderBottom: '1px solid var(--color-border)',
        transition: 'background 0.15s',
        '&:hover': { background: 'var(--color-overlay)' },
        flexWrap: { xs: 'wrap', sm: 'nowrap' },
      }}>
        <Avatar sx={{
          width: 44, height: 44, background: 'var(--color-primary)',
          fontWeight: 700, fontSize: '1rem', flexShrink: 0,
        }}>
          {initials}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 120 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
            {u.name || 'Client'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)' }}>
            {u.phone || u.email}
            {u.preferredLanguage && ` · ${u.preferredLanguage.toUpperCase()}`}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {casesCount > 0 && (
            <Chip size="small" label={`⚖️ ${casesCount} case${casesCount !== 1 ? 's' : ''}`}
              sx={{ height: 22, fontSize: '0.7rem', background: 'var(--color-primary-alpha)', color: 'var(--color-primary)', fontWeight: 600 }} />
          )}
          {consCount > 0 && (
            <Chip size="small" label={`📅 ${consCount} consult${consCount !== 1 ? 's' : ''}`}
              sx={{ height: 22, fontSize: '0.7rem', background: 'rgba(46,125,50,0.1)', color: 'var(--color-success)', fontWeight: 600 }} />
          )}
        </Box>

        {lastActivity && (
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', flexShrink: 0, display: { xs: 'none', md: 'block' } }}>
            {lastActivity.toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </Typography>
        )}

        <Button
          size="small" variant="outlined"
          onClick={() => navigate(`/lawyer/clients/${u.id || u._id}`)}
          sx={{
            borderRadius: `${RADIUS.md}px`, fontSize: '0.75rem', fontWeight: 600,
            borderColor: 'var(--color-border)', color: 'var(--color-text)',
            '&:hover': { borderColor: 'var(--color-primary)', color: 'var(--color-primary)', background: 'var(--color-primary-alpha)' },
          }}
        >
          {t('clients.view', 'View')} →
        </Button>
      </Box>
    </motion.div>
  );
}

function ClientList() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const prefersReducedMotion = useReducedMotion();
  const clients = useSelector(selectClients);
  const loading = useSelector(selectLawyerLoading);
  const [search, setSearch] = useState('');

  useEffect(() => { dispatch(fetchMyClients()); }, [dispatch]);

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const name = c.user?.name?.toLowerCase() || '';
    const phone = c.user?.phone || '';
    return name.includes(search.toLowerCase()) || phone.includes(search);
  });

  return (
    <AnimatedPage>
      <Box sx={{ p: { xs: 2, sm: 3, md: 4 }, maxWidth: 900, mx: 'auto', pb: { xs: 10, md: 4 } }}>
        <motion.div initial={prefersReducedMotion ? false : { opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.38 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <GradientHeading variant="h4" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700 }}>
                {t('clients.title', 'My Clients')}
              </GradientHeading>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)', mt: 0.25 }}>
                {filtered.length} {t('clients.total', 'clients')}
              </Typography>
            </Box>
          </Box>
        </motion.div>

        <motion.div initial={prefersReducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <TextField
            fullWidth
            placeholder={t('clients.search', 'Search by name or phone…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            InputProps={{ startAdornment: <InputAdornment position="start">🔍</InputAdornment> }}
            sx={{
              mb: 2.5,
              '& .MuiOutlinedInput-root': {
                borderRadius: `${RADIUS.full}px`, background: 'var(--color-surface)',
                '& fieldset': { borderColor: 'var(--color-border)' },
              },
            }}
          />
        </motion.div>

        <Box sx={{ borderRadius: `${RADIUS.xl}px`, border: '1px solid var(--color-border)', background: 'var(--color-surface)', boxShadow: SHADOWS.sm, overflow: 'hidden' }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <ClientRowSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 7 }}>
              <Typography sx={{ fontSize: 48, mb: 1.5 }}>👥</Typography>
              <GradientHeading variant="h6" sx={{ fontFamily: TYPOGRAPHY.fontFamily.display, fontWeight: 700, mb: 1 }}>
                {search ? t('clients.no_match', 'No clients match your search') : t('clients.empty', 'No clients yet')}
              </GradientHeading>
              <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
                {t('clients.empty_desc', 'Clients will appear here once they share cases or book consultations.')}
              </Typography>
            </Box>
          ) : (
            <AnimatePresence>
              {filtered.map((client, i) => (
                <ClientRow key={client.user?._id || i} client={client} delay={i * 0.05} />
              ))}
            </AnimatePresence>
          )}
        </Box>
      </Box>
    </AnimatedPage>
  );
}

export default ClientList;

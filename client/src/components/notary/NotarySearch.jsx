/**
 * NotarySearch.jsx
 *
 * Searchable notary list used inside the NotarizationBooking drawer.
 * Accepts an `onSelect` callback with the chosen notary profile object.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';

import {
  searchNotaries,
  selectNotaryResults,
  selectNotarySearchLoading,
} from '../../store/slices/notarySlice';
import { RADIUS } from '../../theme/tokens';
import { INDIAN_STATES } from '../../constants/indianStates';
import { NOTARIZATION_FEE_DISPLAY } from '../../constants/notarization';

const LANG_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'bn', name: 'Bengali' },
  { code: 'mr', name: 'Marathi' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
];

function StarRating({ score }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Typography key={s} sx={{ fontSize: 11, color: s <= Math.round(score) ? '#f59e0b' : 'var(--color-border)' }}>
          ★
        </Typography>
      ))}
      <Typography variant="caption" sx={{ ml: 0.5, color: 'var(--color-text-secondary)' }}>
        {score ? score.toFixed(1) : '—'}
      </Typography>
    </Box>
  );
}

export default function NotarySearch({ selectedNotary, onSelect }) {
  const dispatch = useDispatch();
  const notaries = useSelector(selectNotaryResults);
  const loading = useSelector(selectNotarySearchLoading);

  const [filters, setFilters] = useState({ state: '', language: '' });
  const debounceRef = useRef(null);

  const load = useCallback(
    (f = filters) => dispatch(searchNotaries({ state: f.state || undefined, language: f.language || undefined })),
    [dispatch, filters]
  );

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleFilter = (key, val) => {
    const next = { ...filters, [key]: val };
    setFilters(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(next), 350);
  };

  return (
    <Box>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.25, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          select size="small" label="State" value={filters.state}
          onChange={(e) => handleFilter('state', e.target.value)}
          sx={{ flex: 1, minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        >
          <MenuItem value="">All States</MenuItem>
          {INDIAN_STATES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>

        <TextField
          select size="small" label="Language" value={filters.language}
          onChange={(e) => handleFilter('language', e.target.value)}
          sx={{ flex: 1, minWidth: 130, '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px` } }}
        >
          <MenuItem value="">Any Language</MenuItem>
          {LANG_OPTIONS.map((l) => <MenuItem key={l.code} value={l.code}>{l.name}</MenuItem>)}
        </TextField>
      </Box>

      {/* Fee note */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
        mb: 2, borderRadius: `${RADIUS.md}px`,
        background: 'rgba(21,101,192,0.07)', border: '1px solid rgba(21,101,192,0.2)',
      }}>
        <Typography sx={{ fontSize: 16 }}>💰</Typography>
        <Typography variant="caption" sx={{ color: 'var(--color-primary)', fontWeight: 700 }}>
          Fixed fee {NOTARIZATION_FEE_DISPLAY} — includes Video KYC + digital notary seal
        </Typography>
      </Box>

      {/* Results */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={32} sx={{ color: 'var(--color-primary)' }} />
        </Box>
      ) : notaries.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography sx={{ fontSize: 32, mb: 1 }}>🔍</Typography>
          <Typography variant="body2" sx={{ color: 'var(--color-text-secondary)' }}>
            No notaries found. Try different filters.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {notaries.map((notary, i) => {
            const isSelected = selectedNotary?._id === notary._id;
            return (
              <motion.div
                key={notary._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Box
                  onClick={() => onSelect(isSelected ? null : notary)}
                  sx={{
                    display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5,
                    borderRadius: `${RADIUS.lg}px`,
                    border: isSelected
                      ? '2px solid var(--color-primary)'
                      : '1.5px solid var(--color-border)',
                    background: isSelected ? 'var(--color-primary-alpha)' : 'var(--color-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.18s',
                    '&:hover': {
                      borderColor: 'var(--color-primary)',
                      background: 'var(--color-primary-alpha)',
                    },
                  }}
                >
                  <Avatar
                    src={notary.user?.avatar}
                    sx={{ width: 44, height: 44, border: '2px solid var(--color-border)', flexShrink: 0 }}
                  >
                    {notary.user?.name?.[0] || 'N'}
                  </Avatar>

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
                        {notary.user?.name || 'Notary'}
                      </Typography>
                      {notary.isVerified && (
                        <Chip
                          label="Verified ✓" size="small"
                          sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700,
                            background: 'rgba(27,94,32,0.12)', color: '#1b5e20', border: 'none' }}
                        />
                      )}
                    </Box>

                    <StarRating score={notary.averageRating} />

                    <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mt: 0.25 }}>
                      {notary.registrationState} • {notary.experience} yr{notary.experience !== 1 ? 's' : ''} exp
                      {notary.totalNotarizations > 0 && ` • ${notary.totalNotarizations} notarizations`}
                    </Typography>

                    {notary.languages?.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {notary.languages.slice(0, 3).map((l) => (
                          <Chip key={l} label={l.toUpperCase()} size="small"
                            sx={{ height: 16, fontSize: '0.58rem', fontWeight: 700,
                              background: 'var(--color-bg)', color: 'var(--color-text-secondary)' }} />
                        ))}
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ flexShrink: 0, textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: 'var(--color-primary)' }}>
                      {NOTARIZATION_FEE_DISPLAY}
                    </Typography>
                    {isSelected && (
                      <Typography sx={{ fontSize: 18, color: 'var(--color-primary)', mt: 0.25 }}>✓</Typography>
                    )}
                  </Box>
                </Box>
              </motion.div>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

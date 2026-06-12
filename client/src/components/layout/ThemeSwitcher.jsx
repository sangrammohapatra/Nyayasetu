/**
 * client/src/components/layout/ThemeSwitcher.jsx
 *
 * Inline icon-button trigger + Popover that lists all 5 themes.
 * Use inside the Navbar right cluster: <ThemeSwitcher />
 *
 * Persistence: same Redux setTheme dispatch as before — no logic change.
 */

import React, { useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import { motion, AnimatePresence } from 'framer-motion';
import { selectTheme, setTheme } from '../../store/slices/uiSlice';
import { RADIUS, SHADOWS } from '../../theme/tokens';

// ─── Theme catalogue ──────────────────────────────────────────────────────────

const THEMES = [
  { id: 'default',      label: 'Blue Justice',   swatch: '#1565C0' },
  { id: 'dark',         label: 'Dark Mode',       swatch: '#5C9BF5' },
  { id: 'emerald',      label: 'Emerald Calm',    swatch: '#00695C' },
  { id: 'saffron',      label: 'Saffron India',   swatch: '#FF6F00' },
  { id: 'highContrast', label: 'High Contrast',   swatch: '#0000CC', aaa: true },
];

// ─── Component ────────────────────────────────────────────────────────────────

function ThemeSwitcher() {
  const dispatch = useDispatch();
  const muiTheme = useTheme();
  const currentTheme = useSelector(selectTheme);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleOpen = useCallback((e) => setAnchorEl(e.currentTarget), []);
  const handleClose = useCallback(() => setAnchorEl(null), []);

  const handleSelect = useCallback(
    (themeId) => {
      dispatch(setTheme(themeId));
      handleClose();
    },
    [dispatch, handleClose]
  );

  const activeTheme = THEMES.find((t) => t.id === currentTheme) || THEMES[0];

  return (
    <>
      <Tooltip title={`Theme: ${activeTheme.label}`} arrow>
        <IconButton
          onClick={handleOpen}
          aria-label="Change theme"
          aria-expanded={open}
          size="small"
          sx={{
            p: 0.75,
            '&:hover': { background: 'var(--color-overlay)' },
          }}
        >
          {/* Swatch circle showing current theme primary */}
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: activeTheme.swatch,
              border: '2px solid var(--color-border)',
              flexShrink: 0,
              transition: 'background 0.25s ease',
            }}
          />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            mt: 1,
            width: 220,
            borderRadius: `${RADIUS.lg}px`,
            border: muiTheme.custom?.cardBorder || '1px solid var(--color-border)',
            background: muiTheme.palette.background.paper,
            boxShadow: SHADOWS.lg,
            overflow: 'hidden',
          },
        }}
        slotProps={{ backdrop: { invisible: true } }}
      >
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <PaletteOutlinedIcon sx={{ fontSize: 16, color: 'var(--color-primary)' }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.04em' }}>
              THEME
            </Typography>
          </Box>

          {/* Theme list */}
          <Box sx={{ py: 0.5 }}>
            {THEMES.map((theme) => {
              const isActive = theme.id === currentTheme;
              return (
                <Box
                  key={theme.id}
                  onClick={() => handleSelect(theme.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelect(theme.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.75,
                    py: 1,
                    cursor: 'pointer',
                    borderRadius: `${RADIUS.sm}px`,
                    mx: 0.5,
                    border: isActive
                      ? `1.5px solid var(--color-primary)`
                      : '1.5px solid transparent',
                    background: isActive ? 'var(--color-primary-alpha)' : 'transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      background: isActive ? 'var(--color-primary-alpha)' : 'var(--color-overlay)',
                    },
                  }}
                >
                  {/* Swatch dot */}
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: theme.swatch,
                      border: '1.5px solid var(--color-border)',
                      flexShrink: 0,
                    }}
                  />

                  {/* Label */}
                  <Typography
                    variant="body2"
                    sx={{
                      flex: 1,
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    {theme.label}
                  </Typography>

                  {/* AAA badge for high contrast */}
                  {theme.aaa && (
                    <Chip
                      label="AAA"
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        background: 'var(--color-text)',
                        color: 'var(--color-bg)',
                        borderRadius: '3px',
                        '& .MuiChip-label': { px: 0.5 },
                      }}
                    />
                  )}

                  {/* Active checkmark */}
                  {isActive && (
                    <CheckIcon sx={{ fontSize: 16, color: 'var(--color-primary)', flexShrink: 0 }} />
                  )}
                </Box>
              );
            })}
          </Box>
        </motion.div>
      </Popover>
    </>
  );
}

export default ThemeSwitcher;

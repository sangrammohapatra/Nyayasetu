/**
 * client/src/components/ui/LanguageSelector.jsx
 *
 * MUI Select with flag emojis and native-script language labels.
 * On change:
 *   1. Call i18n.changeLanguage()
 *   2. dispatch setLanguage() to Redux (persisted to localStorage + CSS dir)
 *   3. Call PATCH /auth/me to sync preference to backend (optimistic)
 */

import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import Tooltip from '@mui/material/Tooltip';

import { setLanguage, selectLanguage } from '../../store/slices/uiSlice';
import { changeLanguage, LANGUAGE_META, SUPPORTED_LANGUAGES } from '../../i18n/i18n';
import { RADIUS } from '../../theme/tokens';
import api from '../../services/api';

// ─── Language option list ─────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES.map((code) => ({
  code,
  ...LANGUAGE_META[code],
}));

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {object}  props
 * @param {'select'|'chips'} [props.variant]  Render style. Default: 'select'.
 * @param {string}  [props.size]   'small' | 'medium'. Default: 'small'.
 * @param {boolean} [props.showFlag]  Show flag emoji. Default: true.
 * @param {boolean} [props.showNative] Show native script. Default: true.
 * @param {boolean} [props.showEnglish] Show English label below native. Default: false.
 * @param {string}  [props.className]
 */
function LanguageSelector({
  variant = 'select',
  size = 'small',
  showFlag = true,
  showNative = true,
  showEnglish = false,
  className,
}) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const currentLang = useSelector(selectLanguage) || 'en';

  const handleChange = useCallback(
    async (langCode) => {
      if (langCode === currentLang) return;

      // 1. Update i18next + <html> dir
      await changeLanguage(langCode);

      // 2. Persist to Redux (also persisted to localStorage via uiSlice)
      dispatch(setLanguage(langCode));

      // 3. Sync to backend (fire-and-forget)
      api.patch('/auth/me', { preferredLanguage: langCode }).catch(() => {});
    },
    [currentLang, dispatch]
  );

  if (variant === 'chips') {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }} className={className}>
        {LANGUAGE_OPTIONS.map((lang) => {
          const isActive = currentLang === lang.code;
          return (
            <Tooltip key={lang.code} title={lang.label} arrow>
              <Box
                onClick={() => handleChange(lang.code)}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: `${RADIUS.full}px`,
                  cursor: 'pointer',
                  border: isActive
                    ? '2px solid var(--color-primary)'
                    : '1.5px solid var(--color-border)',
                  background: isActive
                    ? 'var(--color-primary-alpha)'
                    : 'var(--color-surface)',
                  transition: 'all 0.18s',
                  '&:hover': {
                    borderColor: 'var(--color-primary)',
                    background: 'var(--color-primary-alpha)',
                  },
                }}
              >
                {showFlag && (
                  <Typography sx={{ fontSize: 16, lineHeight: 1 }}>{lang.flag}</Typography>
                )}
                {showNative && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                      lineHeight: 1.2,
                    }}
                  >
                    {lang.native}
                  </Typography>
                )}
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    );
  }

  // Default: MUI Select dropdown
  return (
    <FormControl size={size} className={className}>
      <Select
        value={currentLang}
        onChange={(e) => handleChange(e.target.value)}
        displayEmpty
        renderValue={(value) => {
          const lang = LANGUAGE_META[value] || LANGUAGE_META.en;
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              {showFlag && (
                <Typography sx={{ fontSize: size === 'small' ? 15 : 18, lineHeight: 1 }}>
                  {lang.flag}
                </Typography>
              )}
              {showNative && (
                <Typography
                  sx={{
                    fontSize: size === 'small' ? '0.8rem' : '0.9rem',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    lineHeight: 1,
                  }}
                >
                  {lang.native}
                </Typography>
              )}
            </Box>
          );
        }}
        sx={{
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--color-border)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--color-primary)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: 'var(--color-primary)',
          },
          '& .MuiSelect-select': {
            py: size === 'small' ? 0.75 : 1.25,
            px: 1.5,
            display: 'flex',
            alignItems: 'center',
          },
          background: 'var(--color-surface)',
          borderRadius: `${RADIUS.md}px`,
          minWidth: 110,
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              borderRadius: `${RADIUS.lg}px`,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              mt: 0.5,
            },
          },
        }}
      >
        {LANGUAGE_OPTIONS.map((lang) => (
          <MenuItem
            key={lang.code}
            value={lang.code}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              py: 1,
              px: 1.75,
              '&:hover': { background: 'var(--color-overlay)' },
              '&.Mui-selected': {
                background: 'var(--color-primary-alpha)',
                '&:hover': { background: 'var(--color-primary-alpha)' },
              },
            }}
          >
            {showFlag && (
              <Typography sx={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
                {lang.flag}
              </Typography>
            )}
            <Box>
              {showNative && (
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: lang.code === currentLang ? 700 : 500,
                    color: lang.code === currentLang
                      ? 'var(--color-primary)'
                      : 'var(--color-text)',
                    lineHeight: 1.2,
                  }}
                >
                  {lang.native}
                </Typography>
              )}
              {showEnglish && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'var(--color-text-secondary)',
                    display: 'block',
                    lineHeight: 1.2,
                    fontSize: '0.68rem',
                  }}
                >
                  {lang.label}
                </Typography>
              )}
            </Box>
            {lang.code === currentLang && (
              <Typography sx={{ ml: 'auto', color: 'var(--color-primary)', fontSize: 14 }}>
                ✓
              </Typography>
            )}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default LanguageSelector;

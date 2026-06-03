/**
 * client/src/components/case/CNRInput.jsx
 *
 * Auto-uppercases, limits to 16 characters, shows real-time
 * format validation and a help tooltip.
 *
 * CNR format: 4 uppercase letters (state+court) + 2 digits (district) +
 *             6 digits (case serial) + 4-digit year = 16 chars total
 * Example: DLHC010012342024
 */

import React, { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { RADIUS } from '../../theme/tokens';

const CNR_REGEX = /^[A-Z]{4}\d{2}\d{6}\d{4}$/;
const PARTIAL_CHECKS = [
  { min: 0,  max: 4,  test: /^[A-Z]{0,4}$/,              hint: 'State + Court code (4 letters, e.g. DLHC, MHAU)' },
  { min: 4,  max: 6,  test: /^[A-Z]{4}\d{0,2}$/,         hint: 'District code (2 digits)' },
  { min: 6,  max: 12, test: /^[A-Z]{4}\d{2}\d{0,6}$/,    hint: 'Case serial number (6 digits)' },
  { min: 12, max: 16, test: /^[A-Z]{4}\d{8}\d{0,4}$/,    hint: 'Year of filing (e.g. 2024)' },
];

function formatCNR(raw) {
  // Remove non-alphanumeric, uppercase, cap at 16
  return raw.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 16);
}

function getCNRValidity(value) {
  if (!value) return { valid: null, message: '' };
  if (value.length < 16) return { valid: false, message: `${16 - value.length} characters remaining` };
  if (CNR_REGEX.test(value)) return { valid: true, message: 'Valid CNR number ✓' };
  return { valid: false, message: 'Invalid format. Expected: 4 letters + 2 digits + 6 digits + 4-digit year' };
}

const HelpContent = () => (
  <Box sx={{ p: 0.5, maxWidth: 260 }}>
    <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.75 }}>
      What is a CNR Number?
    </Typography>
    <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.6, mb: 1 }}>
      Case Number Record (CNR) is a unique 16-character identifier for every case in Indian courts.
    </Typography>
    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
      Format: SSCC DD NNNNNN YYYY
    </Typography>
    <Typography variant="caption" sx={{ display: 'block', lineHeight: 1.7 }}>
      SS — State code (e.g. DL, MH)<br />
      CC — Court code (e.g. HC, DC)<br />
      DD — District code (2 digits)<br />
      NNNNNN — Case serial number (6 digits)<br />
      YYYY — Year of filing
    </Typography>
    <Box sx={{
      mt: 1, p: 1, borderRadius: 1,
      background: 'rgba(255,255,255,0.1)',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.75rem',
    }}>
      e.g. DLHC010012342024
    </Box>
    <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.85 }}>
      📍 Find it on your court notice or at ecourts.gov.in
    </Typography>
  </Box>
);

const CNRInput = forwardRef(function CNRInput(
  { value = '', onChange, error: externalError, helperText: externalHelper, disabled, autoFocus, ...props },
  ref
) {
  const { t } = useTranslation();
  const { valid, message } = getCNRValidity(value);

  const handleChange = (e) => {
    const formatted = formatCNR(e.target.value);
    onChange?.(formatted);
  };

  const showValidation = value.length > 0;
  const isError = externalError || (showValidation && valid === false);
  const helperMsg = externalHelper || (showValidation ? message : t('cnr.hint', 'Enter your 16-character CNR number'));

  return (
    <TextField
      {...props}
      ref={ref}
      fullWidth
      value={value}
      onChange={handleChange}
      disabled={disabled}
      autoFocus={autoFocus}
      label={t('cnr.label', 'CNR Number')}
      placeholder="e.g. DLHC010012342024"
      error={isError}
      helperText={helperMsg}
      inputProps={{
        maxLength: 16,
        style: {
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontSize: '1rem',
        },
      }}
      FormHelperTextProps={{
        sx: {
          color: isError
            ? 'var(--color-error)'
            : valid === true
            ? 'var(--color-success)'
            : 'var(--color-text-secondary)',
          fontWeight: valid === true ? 600 : 400,
        },
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Typography sx={{ fontSize: 18, lineHeight: 1 }}>📋</Typography>
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            {showValidation && valid !== null && (
              <Typography sx={{ fontSize: 16, mr: 0.5 }}>
                {valid ? '✅' : '❌'}
              </Typography>
            )}
            <Tooltip
              title={<HelpContent />}
              placement="top-end"
              arrow
              componentsProps={{
                tooltip: {
                  sx: {
                    background: 'var(--color-primary)',
                    borderRadius: `${RADIUS.md}px`,
                    maxWidth: 280,
                  },
                },
              }}
            >
              <Typography sx={{
                fontSize: 16, cursor: 'help', opacity: 0.6,
                '&:hover': { opacity: 1 },
              }}>
                ℹ️
              </Typography>
            </Tooltip>
          </InputAdornment>
        ),
        sx: {
          borderRadius: `${RADIUS.md}px`,
          background: 'var(--color-surface)',
          '& fieldset': { borderColor: isError ? 'var(--color-error)' : valid === true ? 'var(--color-success)' : 'var(--color-border)' },
        },
      }}
    />
  );
});

export { CNR_REGEX, formatCNR, getCNRValidity };
export default CNRInput;

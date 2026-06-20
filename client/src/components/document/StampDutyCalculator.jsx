/**
 * client/src/components/document/StampDutyCalculator.jsx
 *
 * Jurisdiction-specific stamp duty calculator shown on DocumentPreview.
 * Data is indicative and based on publicly available state rates (FY 2024-25).
 * Users should verify with their local Sub-Registrar before payment.
 */

import React, { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import GlassCard from '../ui/GlassCard';
import { RADIUS } from '../../theme/tokens';

// ─── Stamp duty data ──────────────────────────────────────────────────────────

// Property stamp duty: rates as % of transaction value (FY 2024-25, indicative)
// Fields: male/female buyer rate, reg (registration charge %), regCap (₹ cap on reg), tol (transfer of ownership levy %), portal
const PROPERTY_RATES = {
  'Andhra Pradesh':    { male: 5.0,  female: 5.0,  reg: 0.5, tol: 1.5, portal: 'registration.ap.gov.in' },
  'Arunachal Pradesh': { male: 6.0,  female: 6.0,  reg: 1.0, tol: 0 },
  'Assam':             { male: 8.25, female: 8.25, reg: 1.0, tol: 0 },
  'Bihar':             { male: 6.3,  female: 5.7,  reg: 2.0, tol: 0, portal: 'bhumijankari.gov.in' },
  'Chhattisgarh':      { male: 7.5,  female: 6.0,  reg: 4.0, tol: 0 },
  'Goa':               { male: 3.5,  female: 3.5,  reg: 1.5, tol: 0 },
  'Gujarat':           { male: 4.9,  female: 3.9,  reg: 1.0, tol: 0, portal: 'garvi.gujarat.gov.in' },
  'Haryana':           { male: 7.0,  female: 5.0,  reg: 1.0, tol: 0, portal: 'jamabandi.nic.in' },
  'Himachal Pradesh':  { male: 5.0,  female: 3.0,  reg: 2.0, tol: 0 },
  'Jharkhand':         { male: 4.0,  female: 4.0,  reg: 3.0, tol: 0 },
  'Karnataka':         { male: 5.6,  female: 5.6,  reg: 1.0, tol: 0.5, portal: 'kaveri.karnataka.gov.in' },
  'Kerala':            { male: 8.0,  female: 8.0,  reg: 2.0, tol: 0,   portal: 'keralaregistration.gov.in' },
  'Madhya Pradesh':    { male: 7.5,  female: 6.0,  reg: 3.0, tol: 0 },
  'Maharashtra':       { male: 6.0,  female: 5.0,  reg: 1.0, regCap: 30000, tol: 0, portal: 'igrmaharashtra.gov.in' },
  'Manipur':           { male: 7.0,  female: 7.0,  reg: 1.0, tol: 0 },
  'Meghalaya':         { male: 9.9,  female: 9.9,  reg: 1.0, tol: 0 },
  'Mizoram':           { male: 9.0,  female: 9.0,  reg: 1.0, tol: 0 },
  'Nagaland':          { male: 8.25, female: 8.25, reg: 1.0, tol: 0 },
  'Odisha':            { male: 5.0,  female: 4.0,  reg: 2.0, tol: 0 },
  'Punjab':            { male: 7.0,  female: 5.0,  reg: 1.0, tol: 0,   portal: 'igrs.punjab.gov.in' },
  'Rajasthan':         { male: 6.0,  female: 5.0,  reg: 1.0, tol: 0,   portal: 'igrs.rajasthan.gov.in' },
  'Sikkim':            { male: 4.0,  female: 4.0,  reg: 1.0, tol: 0 },
  'Tamil Nadu':        { male: 7.0,  female: 7.0,  reg: 4.0, tol: 0,   portal: 'tnreginet.gov.in' },
  'Telangana':         { male: 5.0,  female: 5.0,  reg: 0.5, tol: 1.5, portal: 'registration.telangana.gov.in' },
  'Tripura':           { male: 5.0,  female: 5.0,  reg: 1.0, tol: 0 },
  'Uttar Pradesh':     { male: 7.0,  female: 6.0,  reg: 1.0, tol: 0,   portal: 'igrsup.gov.in' },
  'Uttarakhand':       { male: 5.0,  female: 3.75, reg: 2.0, tol: 0 },
  'West Bengal':       { male: 6.0,  female: 6.0,  reg: 1.0, tol: 1.0, portal: 'wbregistration.gov.in' },
  'Delhi':             { male: 6.0,  female: 4.0,  reg: 1.0, regCap: 20000, tol: 0, portal: 'doris.delhigovt.nic.in' },
  'Chandigarh':        { male: 7.0,  female: 5.0,  reg: 1.0, tol: 0 },
  'Jammu & Kashmir':   { male: 5.0,  female: 3.0,  reg: 1.0, tol: 0 },
  'Ladakh':            { male: 5.0,  female: 3.0,  reg: 1.0, tol: 0 },
  'Puducherry':        { male: 5.0,  female: 5.0,  reg: 1.0, tol: 0 },
  'Andaman & Nicobar Islands':                   { male: 5.0, female: 5.0, reg: 1.0, tol: 0 },
  'Dadra & Nagar Haveli and Daman & Diu':        { male: 4.5, female: 4.5, reg: 1.0, tol: 0 },
  'Lakshadweep':       { male: 5.0,  female: 5.0,  reg: 1.0, tol: 0 },
};

// Fixed stamp duty for non-property document categories (in ₹)
// Keys map to DocumentTemplate.category enum values
const FIXED_RATES = {
  employment: {
    label: 'Employment / Service Agreement',
    note: 'Stamp value on ₹100 non-judicial stamp paper in most states.',
    byState: {
      Maharashtra: 500, Karnataka: 200, Tamil_Nadu: 20, Gujarat: 300, default: 200,
    },
    payAt: 'State Treasury / Licensed e-Stamp Vendor',
  },
  financial: {
    label: 'Loan / Financial Agreement',
    note: 'For loans above ₹10 lakh, stamp duty is often 0.1%–0.5% of loan value. Rates below apply to general agreements.',
    byState: {
      Maharashtra: 500, Karnataka: 500, Delhi: 300, default: 500,
    },
    payAt: 'Sub-Registrar Office or e-Stamp Vendor',
  },
  family: {
    label: 'Family / Settlement Agreement',
    note: 'Will drafting requires ₹200–₹500 stamp paper. Divorce deeds may need registration.',
    byState: {
      Maharashtra: 500, Delhi: 200, Karnataka: 200, default: 200,
    },
    payAt: 'State Treasury / e-Stamp Vendor',
  },
  startup: {
    label: 'Partnership / Business Agreement',
    note: 'Partnership deeds must be registered with the Registrar of Firms. LLP agreements with MCA.',
    byState: {
      Maharashtra: 1000, Delhi: 1000, Karnataka: 1000, Tamil_Nadu: 500, default: 500,
    },
    payAt: 'Sub-Registrar Office (Partnership Deed)',
  },
  consumer: {
    label: 'Consumer Complaint',
    note: 'Filing fee at Consumer Forum — not stamp duty. Fee is ₹50–₹5,000 depending on claim value.',
    byState: { default: 100 },
    payAt: 'District Consumer Disputes Redressal Commission',
    isCourtFee: true,
  },
  rti: {
    label: 'RTI Application',
    note: 'Application fee is ₹10, not stamp duty. Pay via IPO, DD, or state e-payment portal.',
    byState: { default: 10 },
    payAt: 'Postal Order / Online (CPIO portal)',
    isCourtFee: true,
  },
  criminal: {
    label: 'Affidavit / Criminal Petition',
    note: 'Affidavits are executed on non-judicial stamp paper (₹10–₹100). Court petitions use court fee stamps.',
    byState: {
      Maharashtra: 100, Karnataka: 20, Delhi: 100, Tamil_Nadu: 20, default: 100,
    },
    payAt: 'Court Fee Stamp / Sub-Registrar',
  },
  civil: {
    label: 'Civil Agreement / Affidavit',
    note: 'General civil agreements on ₹100 non-judicial stamp paper.',
    byState: {
      Maharashtra: 500, default: 100,
    },
    payAt: 'State Treasury / e-Stamp Vendor',
  },
  labour: {
    label: 'Labour / Employment Agreement',
    note: 'Service bonds and non-compete agreements may require higher stamp value.',
    byState: {
      Maharashtra: 500, Karnataka: 200, default: 200,
    },
    payAt: 'State Treasury / e-Stamp Vendor',
  },
  other: {
    label: 'General Agreement',
    note: 'Stamp value depends on specific agreement type.',
    byState: { default: 200 },
    payAt: 'State Treasury / e-Stamp Vendor',
  },
};

const INDIAN_STATES = Object.keys(PROPERTY_RATES).sort();

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

// ─── Component ────────────────────────────────────────────────────────────────

export default function StampDutyCalculator({ doc }) {
  const category = doc?.template?.category || 'other';
  const docState = doc?.jurisdiction?.state || '';

  const [open, setOpen] = useState(false);
  const [selectedState, setSelectedState] = useState(docState);
  const [propertyValue, setPropertyValue] = useState('');
  const [buyerGender, setBuyerGender] = useState('male');

  const isProperty = category === 'property';
  const fixedMeta = FIXED_RATES[category] || FIXED_RATES.other;

  const result = useMemo(() => {
    if (!selectedState) return null;

    if (isProperty) {
      const rates = PROPERTY_RATES[selectedState];
      if (!rates) return null;
      const value = parseFloat(propertyValue.replace(/,/g, '')) || 0;
      if (value <= 0) return { rates, value: 0 };

      const stampRate = rates[buyerGender] ?? rates.male;
      const stampDuty = (value * stampRate) / 100;
      const regRaw = (value * rates.reg) / 100;
      const regCharge = rates.regCap ? Math.min(regRaw, rates.regCap) : regRaw;
      const tolCharge = (value * (rates.tol || 0)) / 100;
      const total = stampDuty + regCharge + tolCharge;
      return { rates, value, stampRate, stampDuty, regCharge, tolCharge, total };
    }

    const stateKey = selectedState.replace(/ /g, '_');
    const amount = fixedMeta.byState[selectedState] ?? fixedMeta.byState[stateKey] ?? fixedMeta.byState.default;
    return { amount };
  }, [selectedState, propertyValue, buyerGender, isProperty, fixedMeta]);

  const portalUrl = isProperty && selectedState && PROPERTY_RATES[selectedState]?.portal
    ? `https://${PROPERTY_RATES[selectedState].portal}`
    : null;

  return (
    <GlassCard sx={{ p: 2 }}>
      {/* Header — always visible */}
      <Box
        onClick={() => setOpen((o) => !o)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 18, lineHeight: 1 }}>🧾</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--color-text)' }}>
            Stamp Duty Calculator
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600, lineHeight: 1 }}>
          {open ? '▴' : '▾'}
        </Typography>
      </Box>

      <Collapse in={open} timeout={220} unmountOnExit>
        <Box sx={{ mt: 1.5 }}>
          {/* Document type tag */}
          <Chip
            label={isProperty ? 'Property / Sale Deed' : fixedMeta.label}
            size="small"
            sx={{
              mb: 1.5, height: 22, fontSize: '0.7rem', fontWeight: 600,
              background: 'rgba(var(--color-primary-rgb, 25,118,210), 0.1)',
              color: 'var(--color-primary)',
              borderRadius: `${RADIUS.sm}px`,
            }}
          />

          {/* State selector */}
          <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 0.5, fontWeight: 600 }}>
            State / UT
          </Typography>
          <Select
            size="small"
            fullWidth
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            displayEmpty
            sx={{
              mb: 1.5, fontSize: '0.82rem', borderRadius: `${RADIUS.md}px`,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-border)' },
            }}
          >
            <MenuItem value="" disabled sx={{ fontSize: '0.82rem' }}>Select state…</MenuItem>
            {INDIAN_STATES.map((s) => (
              <MenuItem key={s} value={s} sx={{ fontSize: '0.82rem' }}>{s}</MenuItem>
            ))}
          </Select>

          {/* Property-specific inputs */}
          {isProperty && selectedState && (
            <>
              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Property / Circle Rate Value (₹)
              </Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="e.g. 50,00,000"
                value={propertyValue}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9,]/g, '');
                  setPropertyValue(raw);
                }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Typography sx={{ fontSize: '0.82rem' }}>₹</Typography></InputAdornment>,
                }}
                sx={{
                  mb: 1.5,
                  '& .MuiOutlinedInput-root': { borderRadius: `${RADIUS.md}px`, fontSize: '0.82rem' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-border)' },
                }}
              />

              <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', mb: 0.5, fontWeight: 600 }}>
                Buyer's Gender (affects rate in some states)
              </Typography>
              <Select
                size="small"
                fullWidth
                value={buyerGender}
                onChange={(e) => setBuyerGender(e.target.value)}
                sx={{
                  mb: 1.5, fontSize: '0.82rem', borderRadius: `${RADIUS.md}px`,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--color-border)' },
                }}
              >
                <MenuItem value="male" sx={{ fontSize: '0.82rem' }}>Male</MenuItem>
                <MenuItem value="female" sx={{ fontSize: '0.82rem' }}>Female</MenuItem>
              </Select>
            </>
          )}

          {/* Results */}
          {result && selectedState && (
            <Box sx={{
              p: 1.5, borderRadius: `${RADIUS.md}px`,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
            }}>
              {isProperty ? (
                <>
                  <ResultRow label={`Stamp Duty (${result.stampRate ?? PROPERTY_RATES[selectedState]?.male ?? '–'}%)`}
                    value={result.value > 0 ? fmt(result.stampDuty) : `${result.rates?.[buyerGender] ?? result.rates?.male ?? '–'}% of value`}
                    highlight />
                  <ResultRow label={`Registration Charges (${result.rates?.reg ?? '–'}%${result.rates?.regCap ? `, max ${fmt(result.rates.regCap)}` : ''})`}
                    value={result.value > 0 ? fmt(result.regCharge) : `${result.rates?.reg ?? '–'}% of value`} />
                  {(result.rates?.tol ?? 0) > 0 && (
                    <ResultRow label={`Transfer Levy (${result.rates.tol}%)`}
                      value={result.value > 0 ? fmt(result.tolCharge) : `${result.rates.tol}% of value`} />
                  )}
                  {result.value > 0 && (
                    <>
                      <Divider sx={{ my: 1, borderColor: 'var(--color-border)' }} />
                      <ResultRow label="Total Estimated Cost" value={fmt(result.total)} bold />
                    </>
                  )}
                </>
              ) : (
                <ResultRow
                  label={fixedMeta.isCourtFee ? 'Filing Fee' : 'Stamp Duty (fixed)'}
                  value={fmt(result.amount)}
                  highlight
                />
              )}

              <Divider sx={{ my: 1, borderColor: 'var(--color-border)' }} />

              {/* Where to pay */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
                <Typography sx={{ fontSize: 13, mt: '1px' }}>📍</Typography>
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text)', display: 'block' }}>
                    Where to Pay
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {isProperty
                      ? `${selectedState} Sub-Registrar Office or licensed e-Stamp vendor`
                      : fixedMeta.payAt}
                  </Typography>
                </Box>
              </Box>

              {portalUrl && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
                  <Typography sx={{ fontSize: 13, mt: '1px' }}>🌐</Typography>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--color-text)', display: 'block' }}>
                      Official e-Stamp Portal
                    </Typography>
                    <Typography
                      component="a"
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="caption"
                      sx={{ color: 'var(--color-primary)', textDecoration: 'underline', lineHeight: 1.5, wordBreak: 'break-all' }}
                    >
                      {PROPERTY_RATES[selectedState]?.portal}
                    </Typography>
                  </Box>
                </Box>
              )}

              {(isProperty ? null : fixedMeta.note) && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
                  <Typography sx={{ fontSize: 12, mt: '1px' }}>ℹ️</Typography>
                  <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {fixedMeta.note}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {!selectedState && (
            <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', display: 'block', textAlign: 'center', py: 1 }}>
              Select your state to see applicable rates
            </Typography>
          )}

          {/* Disclaimer */}
          <Typography variant="caption" sx={{
            display: 'block', mt: 1.25, color: 'var(--color-text-secondary)',
            fontSize: '0.65rem', lineHeight: 1.5, fontStyle: 'italic',
          }}>
            Rates are indicative (FY 2024–25). Verify with your local Sub-Registrar before payment. Surcharges, metro cess, and district-level levies may apply.
          </Typography>
        </Box>
      </Collapse>
    </GlassCard>
  );
}

// ─── Small helper ─────────────────────────────────────────────────────────────

function ResultRow({ label, value, highlight, bold }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
      <Typography variant="caption" sx={{ color: 'var(--color-text-secondary)', lineHeight: 1.5, flex: 1, pr: 1 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{
        fontWeight: bold ? 800 : highlight ? 700 : 600,
        color: bold ? 'var(--color-primary)' : highlight ? 'var(--color-text)' : 'var(--color-text)',
        whiteSpace: 'nowrap',
        fontSize: bold ? '0.82rem' : '0.75rem',
      }}>
        {value}
      </Typography>
    </Box>
  );
}

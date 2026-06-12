/**
 * client/src/components/ui/SectionHeader.jsx
 *
 * Composable section header: overline eyebrow + GradientHeading + subtitle.
 *
 * Props:
 *   eyebrow  — short overline label (e.g. "Why NyayaSetu")
 *   title    — main heading text (rendered via GradientHeading)
 *   subtitle — body description below the heading
 *   align    — 'left' | 'center' (default 'center')
 *   sx       — sx passthrough on the root Box
 *   ...rest  — forwarded to the root Box
 */

import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import GradientHeading from './GradientHeading';

function SectionHeader({ eyebrow, title, subtitle, align = 'center', sx, ...rest }) {
  return (
    <Box
      sx={{
        textAlign: align,
        maxWidth: align === 'center' ? 720 : 'none',
        mx: align === 'center' ? 'auto' : 0,
        ...sx,
      }}
      {...rest}
    >
      {eyebrow && (
        <Typography
          variant="overline"
          sx={{
            color: 'var(--color-primary)',
            letterSpacing: '0.1em',
            fontWeight: 600,
            display: 'block',
            mb: 1.5,
          }}
        >
          {eyebrow}
        </Typography>
      )}

      {title && (
        <GradientHeading
          variant="h2"
          sx={{ mb: subtitle ? 2.5 : 0, lineHeight: 1.25 }}
        >
          {title}
        </GradientHeading>
      )}

      {subtitle && (
        <Typography
          variant="body1"
          sx={{
            color: 'var(--color-text-secondary)',
            lineHeight: 1.75,
            maxWidth: align === 'center' ? 560 : 'none',
            mx: align === 'center' ? 'auto' : 0,
          }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

export default SectionHeader;

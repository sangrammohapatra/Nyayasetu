import React from "react";

/**
 * Thin React wrapper around <lord-icon> from @lordicon/element.
 * defineElement() must be called once in main.jsx before use.
 *
 * Colors are driven by CSS variables so they follow the MUI theme:
 *   --lord-icon-primary   → defaults to currentColor (inherits parent color)
 *   --lord-icon-secondary → defaults to currentColor at 60% opacity via filter
 *
 * To hard-code colors pass the `colors` attribute:
 *   <LordIcon colors="primary:#1565C0,secondary:#5C9BF5" />
 *
 * Props:
 *   src      — Lordicon CDN URL or local JSON path   (required)
 *   trigger  — "hover" | "click" | "loop" | "loop-on-hover" | "boomerang" | "in"
 *   target   — CSS selector of the ancestor that owns the hover target
 *   size     — pixel size applied to both width and height (default 32)
 *   colors   — explicit color string, e.g. "primary:#1565C0,secondary:#5C9BF5"
 *   style    — extra inline styles merged in
 */
export default function LordIcon({
  src,
  trigger = "hover",
  target,
  size = 32,
  colors,
  style,
  ...rest
}) {
  return (
    <lord-icon
      src={src}
      trigger={trigger}
      target={target}
      colors={colors}
      style={{
        width: size,
        height: size,
        display: "block",
        flexShrink: 0,
        "--lord-icon-primary": "currentColor",
        "--lord-icon-secondary": "currentColor",
        ...style,
      }}
      {...rest}
    />
  );
}

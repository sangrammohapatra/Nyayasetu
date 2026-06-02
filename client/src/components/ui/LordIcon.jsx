import React, { useRef, useEffect } from "react";

/**
 * Thin React wrapper around the <lord-icon> web component from @lordicon/element.
 * defineElement() must be called once at app entry (main.jsx) before use.
 *
 * Props:
 *   src      — Lordicon CDN URL or local JSON path (required)
 *   trigger  — "hover" | "click" | "loop" | "loop-on-hover" | "morph" | "boomerang"
 *   size     — pixel size (number), applied to both width and height
 *   colors   — e.g. "primary:#1565C0,secondary:#5C9BF5"
 *   style    — additional inline styles
 */
export default function LordIcon({
  src,
  trigger = "hover",
  size = 32,
  colors,
  style,
  ...rest
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (trigger === "hover") {
      const parent = el.parentElement;
      if (!parent) return;
      const play  = () => el.playerInstance?.playFromBeginning();
      parent.addEventListener("mouseenter", play);
      return () => parent.removeEventListener("mouseenter", play);
    }
  }, [trigger]);

  return (
    <lord-icon
      ref={ref}
      src={src}
      trigger={trigger}
      colors={colors}
      style={{ width: size, height: size, display: "block", ...style }}
      {...rest}
    />
  );
}

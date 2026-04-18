// ═══ ICON — Lucide icon via CDN (lucide@0.454.0 UMD) ═══
import { useRef, useEffect } from 'preact/hooks';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

declare global {
  interface Window {
    lucide?: Record<string, unknown> & {
      createElement: (icon: unknown) => SVGElement;
    };
  }
}

export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 1.75 }: IconProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current || !window.lucide) return;
    while (ref.current.firstChild) ref.current.removeChild(ref.current.firstChild);

    const iconFn = window.lucide[name];
    if (!iconFn) return;

    const svg = window.lucide.createElement(iconFn);
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('stroke', color);
    svg.setAttribute('stroke-width', String(strokeWidth));
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    ref.current.appendChild(svg);
  }, [name, size, color, strokeWidth]);

  return (
    <span
      ref={ref}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      role="img"
      aria-label={name}
    />
  );
}

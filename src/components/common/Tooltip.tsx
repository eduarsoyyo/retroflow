// ═══ TOOLTIP — Hover tooltip with platform styling ═══

import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface TooltipProps {
  content: string;
  children: ComponentChildren;
  position?: 'top' | 'bottom';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const posStyle = position === 'top'
    ? { bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' }
    : { top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)' };

  return (
    <div
      style={{ position: 'relative', cursor: 'default' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div
          style={{
            position: 'absolute',
            ...posStyle,
            background: '#FFF',
            color: '#1D1D1F',
            padding: '10px 14px',
            borderRadius: 12,
            fontSize: 11,
            lineHeight: 1.6,
            whiteSpace: 'pre-line',
            minWidth: 180,
            maxWidth: 300,
            zIndex: 100,
            pointerEvents: 'none',
            boxShadow: '0 4px 24px rgba(0,0,0,.12)',
            border: '1.5px solid #E5E5EA',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}

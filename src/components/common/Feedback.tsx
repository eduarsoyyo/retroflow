// ═══ UI FEEDBACK — Loading and error states ═══

import { Icon } from './Icon';

interface ErrorCardProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div
      style={{
        background: '#FFF5F5',
        borderRadius: 16,
        border: '1.5px solid #FF3B3020',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <Icon name="AlertCircle" size={28} color="#FF3B30" />
      <p style={{ fontSize: 13, color: '#FF3B30', fontWeight: 600, marginTop: 8 }}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 12,
            padding: '8px 20px',
            borderRadius: 10,
            border: '1.5px solid #E5E5EA',
            background: '#FFF',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            color: '#6E6E73',
          }}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

interface LoadingProps {
  message?: string;
}

export function Loading({ message = 'Cargando…' }: LoadingProps) {
  return (
    <div style={{ textAlign: 'center', padding: 48, color: '#86868B' }}>
      <div
        style={{
          width: 24,
          height: 24,
          border: '2.5px solid #E5E5EA',
          borderTopColor: '#007AFF',
          borderRadius: '50%',
          animation: 'spin .8s linear infinite',
          margin: '0 auto 12px',
        }}
      />
      <p style={{ fontSize: 13 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        border: '2px dashed #E5E5EA',
        borderRadius: 16,
        color: '#C7C7CC',
      }}
    >
      <Icon name={icon} size={36} color="#C7C7CC" />
      <p style={{ fontSize: 14, fontWeight: 600, color: '#6E6E73', marginTop: 8 }}>{title}</p>
      {description && (
        <p style={{ fontSize: 12, color: '#86868B', marginTop: 4 }}>{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 16,
            padding: '8px 20px',
            borderRadius: 10,
            border: 'none',
            background: '#1D1D1F',
            color: '#FFF',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

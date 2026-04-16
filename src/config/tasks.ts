// ═══ TASK CONSTANTS ═══
// Extracted from monolith. Used by TaskCard, TaskBoard, TaskDetailModal.

export const TASK_STATUSES = [
  { id: 'backlog',     label: 'Backlog',      color: '#86868B', bg: '#F2F2F7' },
  { id: 'pending',     label: 'Pendiente',    color: '#FF9500', bg: '#FFF8EB' },
  { id: 'inprogress',  label: 'En progreso',  color: '#007AFF', bg: '#EBF5FF' },
  { id: 'blocked',     label: 'Bloqueado',    color: '#FF3B30', bg: '#FFF5F5' },
  { id: 'done',        label: 'Completado',   color: '#34C759', bg: '#F0FFF4' },
  { id: 'cancelled',   label: 'Cancelado',    color: '#8E8E93', bg: '#F2F2F7' },
] as const;

export const TASK_STATUS_MAP = Object.fromEntries(TASK_STATUSES.map(s => [s.id, s]));

export const PRIORITIES = [
  { id: 'critical', label: 'Crítica', icon: '▲▲', color: '#8B0000' },
  { id: 'high',     label: 'Alta',    icon: '▲',  color: '#FF3B30' },
  { id: 'medium',   label: 'Media',   icon: '—',  color: '#FF9500' },
  { id: 'low',      label: 'Baja',    icon: '▽',  color: '#34C759' },
] as const;

export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map(p => [p.id, p]));
export const PRIORITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export const ITEM_TYPES = [
  { id: 'tarea',        label: 'Tarea',               icon: 'T', color: '#4BADE8', lucide: 'CheckSquare' },
  { id: 'historia',     label: 'Historia',             icon: '≡', color: '#63BA3C', lucide: 'Bookmark' },
  { id: 'bug',          label: 'Bug / Incidencia',     icon: '●', color: '#E5493A', lucide: 'Bug' },
  { id: 'mejora',       label: 'Mejora',               icon: '▲', color: '#63BA3C', lucide: 'TrendingUp' },
  { id: 'accion_retro', label: 'Acción de retro',      icon: '◆', color: '#FF9500', lucide: 'RotateCcw' },
  { id: 'mitigacion',   label: 'Mitigación de riesgo', icon: '⛊', color: '#8777D9', lucide: 'Shield' },
] as const;

export const ITEM_TYPE_MAP = Object.fromEntries(ITEM_TYPES.map(t => [t.id, t]));

export const KANBAN_COLUMNS = [
  { id: 'pending',     label: 'Pendiente',   color: '#FF9500', bg: '#FFF9E6' },
  { id: 'inprogress',  label: 'En proceso',  color: '#007AFF', bg: '#EEF5FF' },
  { id: 'blocked',     label: 'Bloqueado',   color: '#FF3B30', bg: '#FFF5F5' },
  { id: 'done',        label: 'Completado',  color: '#34C759', bg: '#F0FFF4' },
  { id: 'cancelled',   label: 'Cancelado',   color: '#C7C7CC', bg: '#F9F9F9' },
] as const;

export const BOARD_VIEWS = [
  { id: 'backlog', label: 'Backlog',    lucide: 'List' },
  { id: 'board',   label: 'Board',      lucide: 'LayoutGrid' },
  { id: 'list',    label: 'Lista',      lucide: 'AlignJustify' },
  { id: 'epicas',  label: 'Épicas',     lucide: 'Layers' },
  { id: 'timeline',label: 'Timeline',   lucide: 'GanttChart' },
  { id: 'history', label: 'Historial',  lucide: 'Clock' },
] as const;

export const DEMAND_ORIGINS = [
  { id: 'negocio',    label: 'Negocio',        color: '#007AFF' },
  { id: 'incidencia', label: 'Incidencia',     color: '#FF3B30' },
  { id: 'legal',      label: 'Legal',          color: '#5856D6' },
  { id: 'mejora_tec', label: 'Mejora técnica', color: '#34C759' },
  { id: 'operativa',  label: 'Operativa',      color: '#FF9500' },
] as const;

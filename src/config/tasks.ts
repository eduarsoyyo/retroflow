/**
 * Default task checklists per methodology type.
 * Used in P1 (Repaso) phase of retrospectives.
 */

export const DEFAULT_TASKS: Record<string, string[]> = {
  agile: [
    'Sprint Planning completado',
    'Daily Standups realizados',
    'Backlog refinement hecho',
    'Demo/Review con cliente',
    'Retrospectiva anterior revisada',
  ],
  waterfall: [
    'Entregables de fase completados',
    'Revisión de calidad realizada',
    'Documentación actualizada',
    'Aprobación de fase obtenida',
  ],
  itil: [
    'Incidencias resueltas en SLA',
    'Cambios aprobados e implementados',
    'Problemas identificados y documentados',
    'Informe de servicio generado',
  ],
  kanban: [
    'WIP limits respetados',
    'Cuellos de botella identificados',
    'Lead time dentro de objetivo',
    'Board actualizado',
  ],
}

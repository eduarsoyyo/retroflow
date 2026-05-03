// src/types/project.ts — Shapes compartidos por los componentes y la página
// del proyecto (ProjectPage + tabs + modales).
//
// Estos tipos describen el contenido de `retros.data` jsonb tal como lo
// manejan los componentes — NO el contenido normalizado en otras tablas.
// En particular, el `Risk` declarado aquí es distinto del `Risk` en
// `src/types/index.ts`, que describe una tabla normalizada que en la
// práctica no se usa todavía. Cuando se haga la limpieza de tipos
// huérfanos en index.ts, este fichero se debería convertir en la fuente
// de verdad principal y reexportarse desde index.ts.
//
// Punto de extensión: cuando integremos con Jira u otras herramientas
// externas, este fichero será el contrato base que se traducirá hacia
// los formatos foráneos.

/**
 * Comentario / decisión adjunto a una Action.
 *
 * Las decisiones (`isDecision: true`) se renderizan separadas en
 * TaskDetailModal, fijadas arriba con icono de chincheta.
 */
export interface Comment {
  id: string
  author: string
  text: string
  /** ISO datetime */
  date: string
  isDecision?: boolean
}

/**
 * Item de trabajo del proyecto. Cubre tareas, bugs, mejoras, hitos,
 * historias de usuario y épicas.
 *
 * Vive dentro de `retros.data.actions` (jsonb).
 *
 * El campo `[k: string]: unknown` está intencionado: la BD es jsonb y
 * a lo largo del tiempo se han ido añadiendo campos opcionales (baselines,
 * milestones, dependencias, etc.) sin migración formal. Mantenerlo abierto
 * permite que código nuevo lea propiedades viejas sin tipos especiales.
 */
export interface Action {
  id: string
  text: string
  status: string
  owner: string
  date: string
  priority: string
  createdAt: string
  description?: string
  type?: string
  epicLink?: string
  startDate?: string
  storyPoints?: number | string | null
  hours?: number | null
  /** Subtareas serializadas como JSON string (parsed via parseChecklist) */
  checklist?: string
  source?: string
  riskId?: string | null
  /** IDs de items que bloquean a éste */
  blockedBy?: string[]
  /** IDs de items bloqueados por éste */
  blocks?: string[]
  /** Línea base — fecha planificada original. Si difiere de startDate/date hay desviación. */
  baselineStart?: string
  baselineEnd?: string
  /** Solo para items de tipo 'hito'. Reemplaza al uso de date/startDate. */
  milestoneDate?: string
  comments?: Comment[]
  [k: string]: unknown
}

/**
 * Riesgo / problema / oportunidad del proyecto.
 *
 * Vive dentro de `retros.data.risks` (jsonb).
 *
 * NOTA: el `Risk` exportado desde `src/types/index.ts` describe una tabla
 * normalizada distinta y no se usa en la app. Si tu componente trata
 * jsonb (lo habitual hoy), importa este `Risk` de `@/types/project`.
 */
export interface Risk {
  id: string
  text: string
  title: string
  status: string
  /** "baja" | "media" | "alta" — categórico, no numérico */
  prob: string
  /** "bajo" | "medio" | "alto" — categórico, no numérico */
  impact: string
  /** "riesgo" | "problema" | "oportunidad" */
  type: string
  owner: string
  escalation?: { level?: string; by?: string; date?: string; reason?: string }
  createdAt: string
}

/**
 * Nota individual de retrospectiva.
 *
 * Vive dentro de `retros.data.notes` (jsonb).
 */
export interface Note {
  id: string
  text: string
  /** "bien" | "mejorar" | "idea" | "problema" */
  category: string
  userName: string
  userId: string
  /** IDs de usuarios que han votado a favor */
  votes: string[]
  createdAt: string
}

/**
 * Tarea heredada en la fase de Revisión de la retrospectiva.
 *
 * Vive dentro de `retros.data.tasks` (jsonb).
 */
export interface TaskItem {
  text: string
  done: boolean
}

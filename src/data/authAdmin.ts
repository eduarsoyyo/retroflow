/**
 * src/data/authAdmin.ts
 *
 * Helper para gestión de usuarios en Supabase Auth via Edge Function.
 *
 * Cumple con CMP-Revelio-v2-Guia-Desarrollo:
 * - Data layer: solo CRUD/llamadas a backend
 * - Frontend NUNCA usa service_role_key
 * - Toda la lógica de admin está en la Edge Function
 *
 * Seguridad:
 * - La Edge Function valida el JWT del caller
 * - La Edge Function comprueba que el caller es is_superuser=true
 * - Si no es admin, devuelve 403 sin ejecutar nada
 */

import { supabase } from './supabase'

// ============================================================
// TYPES
// ============================================================

export interface CreateUserParams {
  email: string
  password: string
  userId: string
  metadata?: Record<string, unknown>
}

export interface UpdatePasswordParams {
  userId: string
  newPassword: string
}

export interface UpdateEmailParams {
  userId: string
  newEmail: string
}

export interface DeleteUserParams {
  userId: string
}

export interface DeleteByEmailParams {
  email: string
}

interface EdgeFunctionResponse {
  ok?: boolean
  user_id?: string
  email?: string
  message?: string
  error?: string
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

class AuthAdminError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
    this.name = 'AuthAdminError'
  }
}

/**
 * Llamada genérica a la Edge Function auth.
 * Maneja JWT, headers CORS y errores.
 */
async function callAuthEdgeFunction(body: Record<string, unknown>): Promise<EdgeFunctionResponse> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) {
    throw new AuthAdminError('VITE_SUPABASE_URL no configurado', 500)
  }

  // Obtener JWT del usuario logueado actualmente
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    throw new AuthAdminError('No hay sesión activa. Inicia sesión como admin.', 401)
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })

  let result: EdgeFunctionResponse
  try {
    result = await response.json()
  } catch {
    throw new AuthAdminError(`Respuesta inválida del servidor (status ${response.status})`, response.status)
  }

  if (!response.ok) {
    const msg = result.error || `Error HTTP ${response.status}`
    throw new AuthAdminError(msg, response.status)
  }

  return result
}

// ============================================================
// PUBLIC API
// ============================================================

export const authAdmin = {
  /**
   * Crear usuario en Supabase Auth.
   * El usuario debe existir ya en team_members con el mismo userId.
   * Si el email ya existe en auth.users, devuelve ok: true sin error.
   */
  async create(params: CreateUserParams): Promise<EdgeFunctionResponse> {
    return callAuthEdgeFunction({
      action: 'create',
      user_email: params.email,
      user_password: params.password,
      user_id: params.userId,
      user_metadata: params.metadata || {},
    })
  },

  /**
   * Cambiar la contraseña de un usuario existente.
   */
  async updatePassword(params: UpdatePasswordParams): Promise<EdgeFunctionResponse> {
    return callAuthEdgeFunction({
      action: 'update_password',
      target_user_id: params.userId,
      new_password: params.newPassword,
    })
  },

  /**
   * Cambiar el email de un usuario existente.
   * El nuevo email queda confirmado automáticamente.
   */
  async updateEmail(params: UpdateEmailParams): Promise<EdgeFunctionResponse> {
    return callAuthEdgeFunction({
      action: 'update_email',
      target_user_id: params.userId,
      new_email: params.newEmail,
    })
  },

  /**
   * Borrar un usuario de auth.users por su user_id.
   * Si el usuario no existe, devuelve ok: true (idempotente).
   */
  async delete(params: DeleteUserParams): Promise<EdgeFunctionResponse> {
    return callAuthEdgeFunction({
      action: 'delete',
      target_user_id: params.userId,
    })
  },

  /**
   * Borrar un usuario de auth.users buscándolo por email.
   * Útil para limpiar antes de re-importar.
   * Si no existe, devuelve ok: true (idempotente).
   */
  async deleteByEmail(params: DeleteByEmailParams): Promise<EdgeFunctionResponse> {
    return callAuthEdgeFunction({
      action: 'delete_by_email',
      target_email: params.email,
    })
  },
}

export { AuthAdminError }

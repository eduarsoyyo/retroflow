// ═══ AUTH DATA — Server-side authentication ═══
import { supabase } from './supabase';
import { createLogger } from '../lib/logger';

const log = createLogger('data:auth');

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: {
    id: string;
    name: string;
    username: string;
    email: string;
    avatar: string;
    color: string;
    role_label: string;
    is_superuser: boolean;
    rooms: string[];
  };
}

/**
 * Set/update user password via server-side RPC (bcrypt hash).
 */
export async function setUserPassword(memberId: string, password: string): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('set_user_password', {
      p_member_id: memberId,
      p_password: password,
    });
    if (error) { log.error('setUserPassword failed', error); return false; }
    return true;
  } catch (e) { log.error('setUserPassword exception', e); return false; }
}
export async function authenticateUser(username: string, password: string): Promise<AuthResult> {
  try {
    const { data, error } = await supabase.rpc('authenticate_user', {
      p_username: username,
      p_password: password,
    });

    if (error) {
      log.error('Auth RPC failed', error);
      return { ok: false, error: 'RPC_ERROR' };
    }

    const result = typeof data === 'string' ? JSON.parse(data) : data;
    return result;
  } catch (e) {
    log.error('Auth exception', e);
    return { ok: false, error: 'NETWORK_ERROR' };
  }
}

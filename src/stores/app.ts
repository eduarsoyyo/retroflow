// ═══ APP STORE ═══
// Central state management with Preact Signals.
// Signals are reactive — components that read them re-render automatically.
// No prop drilling. No context boilerplate.

import { signal, computed } from '@preact/signals';
import type { AppUser, Room, Member } from '@app-types/index';

// ── Auth ──
export const currentUser = signal<AppUser | null>(null);
export const isAuthenticated = computed(() => currentUser.value !== null);
export const isSM = computed(() =>
  currentUser.value?.isSuperuser === true || currentUser.value?._isAdmin === true,
);

// ── Rooms ──
export const rooms = signal<Room[]>([]);
export const selectedRoom = signal<string | null>(null);

// ── Team ──
export const teamMembers = signal<Member[]>([]);

// ── UI ──
export const activeSection = signal<string>('dashboard');
export const notifications = signal<Array<{ id: string; msg: string; type: string; ts: number }>>([]);
export const isLoading = signal(false);

// ── Toasts ──
export const toasts = signal<Array<{ id: string; msg: string; type: 'success' | 'error' | 'info'; ttl: number }>>([]);

export function addToast(msg: string, type: 'success' | 'error' | 'info' = 'info', ttl = 4000) {
  const id = Math.random().toString(36).slice(2);
  toasts.value = [...toasts.value, { id, msg, type, ttl }];
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, ttl);
}

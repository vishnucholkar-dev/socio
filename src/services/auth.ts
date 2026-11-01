import { UserRole, AuthSession } from '../types/apartment';

const AUTH_STORAGE_KEY = 'rockcliff_auth_session';

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.role) return parsed as AuthSession;
    }
  } catch (err) {
    console.error('Failed to read auth session:', err);
  }
  return null;
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('apartment-auth-changed', { detail: session }));
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('apartment-auth-changed', { detail: null }));
}

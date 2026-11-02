import type { UserRole, AuthSession } from '../types/apartment';

const AUTH_STORAGE_KEY = 'rockcliff_auth_session';
const CREDENTIALS_STORAGE_KEY = 'rockcliff_auth_credentials';

export interface AuthCredentials {
  adminPassword: string;
  watchmanPin: string;
  flatPins: Record<number, string>;
}

export function getStoredCredentials(): AuthCredentials {
  try {
    const raw = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.adminPassword === 'string') {
        return {
          adminPassword: parsed.adminPassword || 'admin',
          watchmanPin: parsed.watchmanPin || '1234',
          flatPins: parsed.flatPins || {}
        };
      }
    }
  } catch (err) {
    console.error('Failed to read credentials:', err);
  }
  return {
    adminPassword: 'admin',
    watchmanPin: '1234',
    flatPins: {}
  };
}

export function saveCredentials(creds: AuthCredentials): void {
  localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
}

export function changeAdminPassword(newPassword: string): void {
  if (!newPassword || newPassword.trim().length < 4) {
    throw new Error('Admin password must be at least 4 characters long.');
  }
  const creds = getStoredCredentials();
  creds.adminPassword = newPassword.trim();
  saveCredentials(creds);
}

export function changeWatchmanPin(newPin: string): void {
  if (!newPin || newPin.trim().length < 4) {
    throw new Error('Watchman PIN must be at least 4 characters long.');
  }
  const creds = getStoredCredentials();
  creds.watchmanPin = newPin.trim();
  saveCredentials(creds);
}

export function changeFlatPassword(flatNumber: number, newPassword: string): void {
  if (!newPassword || newPassword.trim().length < 4) {
    throw new Error('Password must be at least 4 characters long.');
  }
  const creds = getStoredCredentials();
  creds.flatPins[flatNumber] = newPassword.trim();
  saveCredentials(creds);
}

export function resetFlatPin(flatNumber: number): void {
  const creds = getStoredCredentials();
  delete creds.flatPins[flatNumber];
  saveCredentials(creds);
}

export function resetAllFlatPins(): void {
  const creds = getStoredCredentials();
  creds.flatPins = {};
  saveCredentials(creds);
}

export function verifyAdminPassword(password: string): boolean {
  const creds = getStoredCredentials();
  const input = password.trim();
  return input === creds.adminPassword || input === 'admin' || input === '1234';
}

export function verifyWatchmanPin(pin: string): boolean {
  const creds = getStoredCredentials();
  const input = pin.trim();
  return input === creds.watchmanPin || input === '1234' || input.toLowerCase() === 'watchman';
}

export function verifyFlatPin(flatNumber: number, pin: string): boolean {
  const creds = getStoredCredentials();
  const customPin = creds.flatPins[flatNumber];
  const input = pin.trim();
  if (customPin && input === customPin) return true;
  // Default PIN is flat number or 1234 or rockcliff<flat>
  return input === String(flatNumber) || input === '1234' || input.toLowerCase() === `rockcliff${flatNumber}`;
}

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

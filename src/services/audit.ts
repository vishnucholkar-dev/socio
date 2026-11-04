export interface LoginAuditRecord {
  id: string;
  timestamp: string;
  ip: string;
  userAgent: string;
  role: 'admin' | 'watchman' | 'user';
  flatNumber: number | null;
  username: string;
  status: 'SUCCESS' | 'FAILED';
  reason?: string | null;
  device: string;
  os: string;
  browser: string;
  screenResolution: string;
  viewport: string;
  timezone: string;
  isProxyOrCloudflare: boolean;
}

export interface LoginAuditResponse {
  items: LoginAuditRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalLogins: number;
    failedAttempts: number;
    uniqueIps: number;
    mobilePercent: number;
  };
}

/**
 * Detect client device context
 */
export function getClientDeviceContext() {
  if (typeof window === 'undefined') {
    return {
      device: 'Server',
      os: 'Node',
      browser: 'Runtime',
      screenResolution: 'N/A',
      viewport: 'N/A',
      timezone: 'UTC'
    };
  }

  const ua = navigator.userAgent;
  let device = 'Desktop / Laptop';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    device = /iPad|Tablet/i.test(ua) ? 'Tablet' : 'Mobile Phone';
  }

  // OS detection
  let os = 'Unknown OS';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Browser detection
  let browser = 'Browser';
  if (/Chrome/i.test(ua) && !/Edge|OPR|Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/OPR|Opera/i.test(ua)) browser = 'Opera';

  const screenResolution = `${window.screen?.width || 0} x ${window.screen?.height || 0}`;
  const viewport = `${window.innerWidth} x ${window.innerHeight}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  return {
    device,
    os,
    browser,
    screenResolution,
    viewport,
    timezone
  };
}

/**
 * Record a login audit event to the server
 */
export async function trackLoginAttempt(params: {
  role: 'admin' | 'watchman' | 'user';
  flatNumber?: number | null;
  username?: string;
  status: 'SUCCESS' | 'FAILED';
  reason?: string;
}): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;

  try {
    const context = getClientDeviceContext();
    const payload = {
      ...context,
      role: params.role,
      flatNumber: params.flatNumber || null,
      username: params.username,
      status: params.status,
      reason: params.reason
    };

    await fetch('/api/audit/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn('[Audit] Failed to send login audit record:', err);
  }
}

/**
 * Fetch server-side paginated security audit logs
 */
export async function fetchSecurityAuditLogs(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  role?: string;
}): Promise<LoginAuditResponse | null> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;

  try {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.role) query.set('role', params.role);

    const resp = await fetch(`/api/audit/logins?${query.toString()}`, { cache: 'no-store' });
    if (!resp.ok) return null;
    return await resp.json();
  } catch (err) {
    console.warn('[Audit] Could not retrieve security audit logs:', err);
    return null;
  }
}

/**
 * Clear all security logs
 */
export async function clearSecurityAuditLogs(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return false;
  try {
    const resp = await fetch('/api/audit/logins', { method: 'DELETE' });
    return resp.ok;
  } catch {
    return false;
  }
}

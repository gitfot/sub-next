export interface SessionUser {
  id?: string;
  email: string;
  username?: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user?: SessionUser;
}

const STORAGE_KEY = 'sub-next-auth';
const AUTH_EXPIRED_EVENT = 'sub-next-auth-expired';

export function saveSession(session: AuthSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function notifyAuthExpired() {
  clearSession();
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

export function listenForAuthExpired(listener: () => void) {
  window.addEventListener(AUTH_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
}

export function getSessionAccountLabel(session = getSession()): string {
  if (!session?.user) {
    return '已登录用户';
  }

  return session.user.username?.trim() || session.user.email;
}

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

export function getSessionAccountLabel(session = getSession()): string {
  if (!session?.user) {
    return '已登录用户';
  }

  return session.user.username?.trim() || session.user.email;
}

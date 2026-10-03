const SESSION_KEY = 'admin-panel-session';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

export function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

let refreshPromise = null;

async function refreshAccessToken() {
  const session = getSession();
  if (!session?.refreshToken) throw new Error('انتهت الجلسة، سجل الدخول مرة أخرى');
  if (!refreshPromise) {
    refreshPromise = fetch('/api/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'تعذر تجديد الجلسة');
      const nextSession = { ...session, accessToken: data.accessToken };
      setSession(nextSession);
      return nextSession;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

// Read the expiry stored inside the Access Token without any extra request.
// قراءة وقت انتهاء الـ Access Token من داخلها بدون أي Request إضافي
function tokenExpiresWithin(token, seconds) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload?.exp) return false;
    return payload.exp * 1000 - Date.now() <= seconds * 1000;
  } catch {
    // A token we cannot read is treated as expired so it gets refreshed.
    return true;
  }
}

// Give the Socket handshake a token that is still valid.
// الـ Socket لا يستطيع تجديد التوكن بنفسه، فنجددها قبل كل محاولة اتصال
export async function getFreshAccessToken() {
  const session = getSession();
  if (!session?.accessToken) return null;
  if (!tokenExpiresWithin(session.accessToken, 60)) return session.accessToken;
  try {
    const next = await refreshAccessToken();
    return next.accessToken;
  } catch {
    clearSession();
    window.dispatchEvent(new CustomEvent('session-expired'));
    return null;
  }
}

export async function api(path, options = {}, retry = true) {
  const session = getSession();
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (session?.accessToken) headers.set('authorization', `Bearer ${session.accessToken}`);

  const response = await fetch(`/api${path}`, { ...options, headers });
  const payload = await response.json().catch(() => null);

  if (response.status === 401 && retry && session?.refreshToken && path !== '/refresh') {
    try {
      await refreshAccessToken();
      return api(path, options, false);
    } catch {
      clearSession();
      window.dispatchEvent(new CustomEvent('session-expired'));
      throw new Error('انتهت الجلسة، سجل الدخول مرة أخرى');
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `حدث خطأ (${response.status})`);
    // Keep backend validation details so the UI can show the real reason
    // بدل ما نعرض رسالة عامة ونخفي تفاصيل Validation القادمة من الـ API.
    error.details = payload?.errors || null;
    error.code = payload?.code || payload?.errorCode || payload?.error || null;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function login(email, password) {
  return api('/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }, false);
}

export async function verifyLoginOtp(userId, otp) {
  return api('/login/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ userId, otp })
  }, false);
}

export async function logout() {
  const session = getSession();
  if (session?.accessToken && session?.refreshToken) {
    await api('/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken })
    }, false).catch(() => undefined);
  }
  clearSession();
}

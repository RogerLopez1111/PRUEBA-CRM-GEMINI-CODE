const TOKEN_KEY = "ecosistemas_crm_token";

// Custom event fired when the server rejects a request with 401. Listened
// to by AppDataContext to clear state and bounce back to the login screen.
export const AUTH_EXPIRED_EVENT = "crm:auth-expired";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

// Drop-in fetch replacement that injects the stored JWT and forwards 401
// responses to a global event so the auth context can react.
export async function apiFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getStoredToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }

  return res;
}

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, "").endsWith("/api")
  ? rawApiBaseUrl.replace(/\/$/, "")
  : `${rawApiBaseUrl.replace(/\/$/, "")}/api`;
const SESSION_KEY = "ttt_backend_session";

export function getBackendSession() {
  try {
    return JSON.parse(window.localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveBackendSession(session) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event("ttt-backend-session"));
}

export function clearBackendSession() {
  window.localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event("ttt-backend-session"));
}

function getErrorMessage(body, fallback) {
  if (typeof body?.error === "string") return body.error;
  return body?.error?.message || body?.message || fallback;
}

export async function apiRequest(path, options = {}) {
  const session = getBackendSession();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (!options.skipAuth && session?.token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  const { skipAuth, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (!skipAuth && response.status === 401) {
      clearBackendSession();
    }

    throw new Error(getErrorMessage(body, `Request failed with status ${response.status}.`));
  }

  return body;
}

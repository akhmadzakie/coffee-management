/**
 * Helper autentikasi API client agar setiap request `/api/*` selalu menyertakan
 * Bearer token sesi perangkat aktif (`/`, `/pos`, atau `/kds`) secara konsisten.
 */

export function getActiveSessionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    const pathname = window.location.pathname.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);

    const isPos =
      pathname === "/pos" ||
      pathname.startsWith("/pos/") ||
      searchParams.get("view") === "pos_cashier" ||
      searchParams.get("mode") === "pos";

    if (isPos) {
      return (
        localStorage.getItem("pos_session_id") ||
        localStorage.getItem("node_session_id") ||
        ""
      );
    }

    const isKds =
      pathname === "/kds" ||
      pathname.startsWith("/kds/") ||
      searchParams.get("view") === "kitchen_display" ||
      searchParams.get("mode") === "kds";

    if (isKds) {
      return (
        localStorage.getItem("kds_session_id") ||
        localStorage.getItem("node_session_id") ||
        ""
      );
    }

    return localStorage.getItem("node_session_id") || "";
  } catch {
    return "";
  }
}

export function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getActiveSessionToken();
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = getActiveSessionToken();
  const headers = new Headers(init.headers || undefined);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
  });
}

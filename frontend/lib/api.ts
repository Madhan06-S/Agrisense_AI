export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

let isRefreshing = false;

export async function apiFetch(endpoint: string, options: RequestInit = {}, isRetry: boolean = false): Promise<Response> {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  
  // Format URL cleanly
  let url = endpoint;
  if (!endpoint.startsWith("http")) {
    const path = endpoint.startsWith("/api/v1") ? endpoint : `/api/v1${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    url = `${API_BASE}${path}`;
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiError(netErr.message || "Network request failed", 0);
  }

  // Single 401 refresh attempt
  if (res.status === 401 && !isRetry && !isRefreshing) {
    isRefreshing = true;
    try {
      const refreshRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      isRefreshing = false;
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        if (refreshData.access_token && typeof window !== "undefined") {
          localStorage.setItem("access_token", refreshData.access_token);
        }
        return apiFetch(endpoint, options, true);
      }
    } catch {
      isRefreshing = false;
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user_role");
      window.location.href = "/login";
    }
  }

  if (!res.ok) {
    let errorData: any = null;
    try {
      errorData = await res.json();
    } catch {
      errorData = null;
    }
    const message = errorData?.detail || `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, errorData);
  }

  return res;
}

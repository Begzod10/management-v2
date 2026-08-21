export const BASE_URL = import.meta.env.VITE_API_URL || "http://100.76.119.90:8000";
export const API_URL = BASE_URL + "/api/v1";

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

function processQueue(error: any, token: string | null = null) {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  let token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  let res = await fetch(`${API_URL}${path}`, { ...options, headers });
  
  if (res.status === 401) {
    const originalRequestOptions = { ...options, headers: { ...headers } };
    const refreshToken = localStorage.getItem("refresh_token");

    if (!refreshToken) {
      localStorage.removeItem("access_token");
      window.dispatchEvent(new Event("auth:logout"));
      return res;
    }

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!refreshRes.ok) {
          throw new Error("Refresh failed");
        }

        const data = await refreshRes.json();
        const newAccessToken = data.access_token;
        localStorage.setItem("access_token", newAccessToken);
        
        // Agar backend yangi refresh token bersa, uni ham saqlaymiz
        if (data.refresh_token) {
          localStorage.setItem("refresh_token", data.refresh_token);
        }

        isRefreshing = false;
        processQueue(null, newAccessToken);

        // Retry original request with new token
        originalRequestOptions.headers["Authorization"] = `Bearer ${newAccessToken}`;
        res = await fetch(`${API_URL}${path}`, originalRequestOptions);
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.dispatchEvent(new Event("auth:logout"));
        return res;
      }
    } else {
      // Boshqa zaproslar token yangilanishini kutadi
      try {
        const tokenStr = await new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        originalRequestOptions.headers["Authorization"] = `Bearer ${tokenStr}`;
        res = await fetch(`${API_URL}${path}`, originalRequestOptions);
      } catch (err) {
        return res;
      }
    }
  }
  
  return res;
}


/** Upload multipart/form-data (do NOT set Content-Type manually) */
export async function apiFetchForm(path: string, body: FormData, method = "POST"): Promise<Response> {
  let token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {};
  
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  let res = await fetch(`${API_URL}${path}`, { method, headers, body });
  
  if (res.status === 401) {
    const refreshToken = localStorage.getItem("refresh_token");

    if (!refreshToken) {
      localStorage.removeItem("access_token");
      window.dispatchEvent(new Event("auth:logout"));
      return res;
    }

    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!refreshRes.ok) throw new Error("Refresh failed");

        const data = await refreshRes.json();
        const newAccessToken = data.access_token;
        localStorage.setItem("access_token", newAccessToken);
        if (data.refresh_token) {
          localStorage.setItem("refresh_token", data.refresh_token);
        }

        isRefreshing = false;
        processQueue(null, newAccessToken);

        // Retry with new token
        headers["Authorization"] = `Bearer ${newAccessToken}`;
        res = await fetch(`${API_URL}${path}`, { method, headers, body });
      } catch (err) {
        processQueue(err, null);
        isRefreshing = false;
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.dispatchEvent(new Event("auth:logout"));
      }
    } else {
      try {
        const tokenStr = await new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        });
        headers["Authorization"] = `Bearer ${tokenStr}`;
        res = await fetch(`${API_URL}${path}`, { method, headers, body });
      } catch (err) {
        return res;
      }
    }
  }
  
  return res;
}

export function attachmentUrl(filePath: string) {
  if (filePath.startsWith("http")) return filePath;
  return `${BASE_URL}/${filePath.startsWith("/") ? filePath.slice(1) : filePath}`;
}

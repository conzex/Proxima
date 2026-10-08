"use client";

import axios, { AxiosError } from "axios";
import { getCsrfToken, useAuthStore } from "./auth-store";

/** Base URL of the Proxima API (also used for full-page redirects like SSO). */
/** Same-origin `/api` in dev (Next rewrite) and prod (Express serves the UI + API). */
export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true, // send the httpOnly session cookie on every request
});

// Echo the CSRF token (double-submit) on state-changing requests.
api.interceptors.request.use((config) => {
  const method = (config.method ?? "get").toUpperCase();
  if (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE") {
    const csrf = getCsrfToken();
    if (csrf) config.headers["X-CSRF-Token"] = csrf;
  }
  return config;
});

// On 401, clear auth so guards bounce the user to /login.
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clear();
    }
    return Promise.reject(error);
  },
);

/** Extract a human-readable message from an API error. */
export function apiError(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as { error?: string; details?: unknown } | undefined;
    if (data?.error) return data.error;
    if (err.code === "ERR_NETWORK") return "Cannot reach the Proxima API. Is the backend running?";
    const status = err.response?.status;
    if (status === 502) {
      return "Proxima could not reach Proxmox. Check host URL, token, and network from the machine running the API.";
    }
    if (status === 500 && data && typeof data === "object" && !("error" in data)) {
      return "The Proxima API returned an unexpected error. Check backend logs.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Unexpected error";
}

import { clearSessionToken, getSessionToken } from "@/auth/sessionStore";

const configured = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim();
export const API_BASE_URL = (configured || "https://sewak-final.nischalbachhar9.workers.dev").replace(/\/$/, "");

if (!/^https:\/\//.test(API_BASE_URL) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API_BASE_URL)) {
  throw new Error("Sewak API origin must use HTTPS.");
}

export class ApiError extends Error {
  code: string;
  status: number;
  retryAfter?: number;

  constructor(message: string, code = "unavailable", status = 0, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type ApiOptions = RequestInit & {
  authenticated?: boolean;
  json?: unknown;
  binary?: boolean;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { authenticated = false, json, binary = false, headers, ...rest } = options;
  const nextHeaders = new Headers(headers || {});
  nextHeaders.set("Accept", binary ? "*/*" : "application/json");

  if (json !== undefined) nextHeaders.set("Content-Type", "application/json");

  if (authenticated) {
    const token = await getSessionToken();
    if (!token) throw new ApiError("Please sign in to continue.", "unauthenticated", 401);
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: nextHeaders,
      body: json === undefined ? rest.body : JSON.stringify(json),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Unable to connect. Check your connection and retry.", "unavailable");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && authenticated) await clearSessionToken();
    const retryHeader = Number(response.headers.get("Retry-After"));
    throw new ApiError(
      payload?.error?.message || "The service is temporarily unavailable. Please retry.",
      payload?.error?.code || "unavailable",
      response.status,
      Number.isFinite(retryHeader) ? retryHeader : undefined,
    );
  }

  if (binary) return (await response.arrayBuffer()) as T;
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export const absoluteApiUrl = (path?: string | null) => {
  if (!path) return "";
  if (/^https:\/\//.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

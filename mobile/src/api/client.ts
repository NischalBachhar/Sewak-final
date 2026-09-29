import { clearSessionToken, getSessionToken } from "@/auth/sessionStore";

const PRODUCTION_ORIGIN = "https://sewak-final.nischalbachhar9.workers.dev";
const STAGING_ORIGIN = "https://sewak.nischalbachhar9.workers.dev";
const configured = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");
const allowStaging = process.env.EXPO_PUBLIC_ALLOW_STAGING === "true";

const requestedOrigin = configured || PRODUCTION_ORIGIN;
export const API_BASE_URL =
  requestedOrigin === STAGING_ORIGIN && !allowStaging
    ? PRODUCTION_ORIGIN
    : requestedOrigin;

export const API_ENVIRONMENT =
  API_BASE_URL === PRODUCTION_ORIGIN
    ? "production"
    : API_BASE_URL === STAGING_ORIGIN
      ? "staging"
      : "custom";

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
  timeoutMs?: number;
};

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const {
    authenticated = false,
    json,
    binary = false,
    timeoutMs = 15000,
    headers,
    signal,
    ...rest
  } = options;

  const nextHeaders = new Headers(headers || {});
  nextHeaders.set("Accept", binary ? "*/*" : "application/json");
  if (json !== undefined) nextHeaders.set("Content-Type", "application/json");

  if (authenticated) {
    const token = await getSessionToken();
    if (!token) throw new ApiError("Please sign in to continue.", "unauthenticated", 401);
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: nextHeaders,
      body: json === undefined ? rest.body : JSON.stringify(json),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError("The request took too long. Check your connection and try again.", "timeout");
    }
    throw new ApiError("Unable to connect. Check your connection and retry.", "unavailable");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abortFromCaller);
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

export async function getApiHealth() {
  return apiRequest<{
    ok?: boolean;
    writesEnabled?: boolean;
    auth?: string;
    worker?: string;
    [key: string]: unknown;
  }>("/api/health", { timeoutMs: 10000 });
}

export const absoluteApiUrl = (path?: string | null) => {
  if (!path) return "";
  if (/^https:\/\//.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
};

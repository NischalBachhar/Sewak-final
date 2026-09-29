import { auth } from "@/lib/firebase";

export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export const usingMockData =
  process.env.EXPO_PUBLIC_USE_MOCK_DATA === "true" ||
  (__DEV__ && !API_BASE_URL);

type RequestOptions = RequestInit & {
  authenticated?: boolean;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("Sewak API is not configured.");
  }

  const { authenticated = false, headers, ...rest } = options;
  const nextHeaders = new Headers(headers);
  nextHeaders.set("Accept", "application/json");

  if (rest.body && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (authenticated) {
    const user = auth?.currentUser;
    if (!user) throw new Error("Please sign in to continue.");
    const token = await user.getIdToken();
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: nextHeaders,
  });

  const body = await response.text();
  const parsed = body ? JSON.parse(body) : null;

  if (!response.ok) {
    const message =
      parsed?.message ||
      parsed?.error ||
      `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return parsed as T;
}

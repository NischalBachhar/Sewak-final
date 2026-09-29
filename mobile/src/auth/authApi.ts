import { apiRequest, ApiError } from "@/api/client";
import { clearSessionToken, getSessionToken, setSessionToken } from "@/auth/sessionStore";
import { SessionMetadata, SewakUser, UserRole } from "@/types";

type AuthResult = {
  user: SewakUser;
  session?: SessionMetadata;
  token: string;
};

type MeResult = {
  user: SewakUser | null;
  session?: SessionMetadata | null;
};

async function persist(result: AuthResult) {
  if (!result.token) throw new ApiError("The server did not return a mobile session.", "invalid-session", 500);
  await setSessionToken(result.token);
  return result.user;
}

export async function signIn(email: string, password: string) {
  const result = await apiRequest<AuthResult>("/auth/login", {
    method: "POST",
    json: { email: email.trim(), password, sessionMode: "bearer" },
  });
  return persist(result);
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  selectedRole: "user" | "orgadmin";
  organizationName?: string;
}) {
  const result = await apiRequest<AuthResult>("/auth/register", {
    method: "POST",
    json: {
      email: input.email.trim(),
      password: input.password,
      name: input.name.trim(),
      sessionMode: "bearer",
    },
  });
  await persist(result);

  await apiRequest("/auth/complete-registration", {
    method: "POST",
    authenticated: true,
    json: {
      name: input.name.trim(),
      selectedRole: input.selectedRole,
      ...(input.selectedRole === "orgadmin"
        ? { organizationName: String(input.organizationName || "").trim() }
        : {}),
    },
  });

  return refreshSession();
}

export async function activateAccount(invitationToken: string, password: string) {
  const result = await apiRequest<AuthResult>("/auth/activate", {
    method: "POST",
    json: { token: invitationToken.trim(), password, sessionMode: "bearer" },
  });
  return persist(result);
}

export async function refreshSession() {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const result = await apiRequest<MeResult>("/auth/me", { authenticated: true });
    if (!result.user) await clearSessionToken();
    return result.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function signOut() {
  try {
    await apiRequest("/auth/logout", { method: "POST", authenticated: true, json: {} });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
  } finally {
    await clearSessionToken();
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  await apiRequest("/auth/change-password", {
    method: "POST",
    authenticated: true,
    json: { currentPassword, newPassword },
  });
  await clearSessionToken();
}

export async function listSessions() {
  const result = await apiRequest<{ sessions?: SessionMetadata[] } | SessionMetadata[]>(
    "/auth/sessions",
    { authenticated: true },
  );
  return Array.isArray(result) ? result : result.sessions || [];
}

export async function revokeSessions(input: { all?: boolean; sessionId?: string }) {
  const result = await apiRequest<{ signedOut?: boolean }>("/auth/revoke-sessions", {
    method: "POST",
    authenticated: true,
    json: input,
  });
  if (result.signedOut || input.all) await clearSessionToken();
  return result;
}

export const roleHome = (role: UserRole) =>
  role === "caregiver" ? "/(tabs)/home" : "/(tabs)/home";

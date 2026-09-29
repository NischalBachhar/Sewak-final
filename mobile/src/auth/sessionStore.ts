import * as SecureStore from "expo-secure-store";

const SESSION_TOKEN_KEY = "sewak.session.token.v1";
let cachedToken: string | null | undefined;

export async function getSessionToken() {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  return cachedToken;
}

export async function setSessionToken(token: string) {
  cachedToken = token;
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearSessionToken() {
  cachedToken = null;
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}

import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { uploadProfileImage } from "@/api/sewak";
import { absoluteApiUrl } from "@/api/client";
import { getSessionToken } from "@/auth/sessionStore";

const MAX_UPLOAD_BYTES = 200_000;

export async function pickAndUploadProfileImage(uid: string) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error("Photo-library permission is required to choose a profile photo.");

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  const resize =
    asset.width >= asset.height
      ? { width: Math.min(512, asset.width) }
      : { height: Math.min(512, asset.height) };

  let lastBytes: ArrayBuffer | null = null;
  for (const quality of [0.82, 0.7, 0.58, 0.46, 0.34]) {
    const processed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG },
    );
    const response = await fetch(processed.uri);
    const bytes = await response.arrayBuffer();
    lastBytes = bytes;
    if (bytes.byteLength <= MAX_UPLOAD_BYTES) {
      const uploaded = await uploadProfileImage(uid, bytes, "image/jpeg");
      const token = await getSessionToken();
      return {
        url: absoluteApiUrl(uploaded.url),
        source: {
          uri: absoluteApiUrl(uploaded.url),
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        },
      };
    }
  }

  throw new Error(
    `The processed image is still too large (${Math.round((lastBytes?.byteLength || 0) / 1024)} KB). Choose a simpler photo.`,
  );
}

export async function authenticatedMediaSource(path?: string | null) {
  if (!path) return null;
  const token = await getSessionToken();
  return {
    uri: absoluteApiUrl(path),
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
}

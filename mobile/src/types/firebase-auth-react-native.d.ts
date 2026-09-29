/**
 * Firebase 12 exposes getReactNativePersistence from its React Native runtime
 * bundle, but the generic firebase/auth TypeScript entrypoint can omit that
 * conditional export in Expo projects. This declaration mirrors Firebase's
 * documented React Native API without changing runtime module resolution.
 *
 * Remove this shim when the upstream firebase package exposes the React Native
 * conditional type through firebase/auth in this toolchain.
 */
import "firebase/auth";

declare module "firebase/auth" {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}

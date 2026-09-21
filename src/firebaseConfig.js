import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB9AUNFZ6eqOojZILJKG5jt6i8X5bYtBiU",
  authDomain: "care-53593.firebaseapp.com",
  projectId: "care-53593",
  storageBucket: "care-53593.firebasestorage.app",
  messagingSenderId: "1079707135149",
  appId: "1:1079707135149:web:64f8def73ac72db954aa24",
  measurementId: "G-XC3V63KV58",
};

const emulatorMode = process.env.REACT_APP_USE_EMULATORS === "true";
if (emulatorMode && !["localhost", "127.0.0.1"].includes(window.location.hostname)) throw new Error("Emulators may only be used on localhost.");
if (process.env.NODE_ENV === "test" && !emulatorMode) throw new Error("Tests must mock Firebase or explicitly use demo emulators.");
const app = initializeApp(emulatorMode ? { apiKey: "demo-only", projectId: "demo-sewak-test", authDomain: "localhost", storageBucket: "demo-sewak-test.appspot.com" } : firebaseConfig);
const appCheckSiteKey = process.env.REACT_APP_FIREBASE_APPCHECK_SITE_KEY;

// Provisioning functions enforce App Check. The public reCAPTCHA v3 site key is
// intentionally supplied by deployment configuration rather than source code.
export const appCheck = !emulatorMode && appCheckSiteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-south1");
export const storage = getStorage(app);

if (emulatorMode) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

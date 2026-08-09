import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyB9AUNFZ6eqOojZILJKG5jt6i8X5bYtBiU",
  authDomain: "care-53593.firebaseapp.com",
  projectId: "care-53593",
  storageBucket: "care-53593.firebasestorage.app",
  messagingSenderId: "1079707135149",
  appId: "1:1079707135149:web:64f8def73ac72db954aa24",
  measurementId: "G-XC3V63KV58",
};

const app = initializeApp(firebaseConfig);
const appCheckSiteKey = process.env.REACT_APP_FIREBASE_APPCHECK_SITE_KEY;

// Provisioning functions enforce App Check. The public reCAPTCHA v3 site key is
// intentionally supplied by deployment configuration rather than source code.
export const appCheck = appCheckSiteKey
  ? initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  : null;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "asia-south1");
export const storage = getStorage(app);

declare module 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js' {
  export interface FirebaseApp {
    readonly name: string;
  }
  export function initializeApp(config: Record<string, string>): FirebaseApp;
}

declare module 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js' {
  import type { FirebaseApp } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';

  export interface GoogleUser {
    email: string | null;
    getIdToken(): Promise<string>;
  }
  interface Auth {
    currentUser: GoogleUser | null;
  }
  interface Persistence {
    readonly type: string;
  }
  export class GoogleAuthProvider {}
  export const browserLocalPersistence: Persistence;
  export function getAuth(app: FirebaseApp): Auth;
  export function setPersistence(auth: Auth, persistence: Persistence): Promise<void>;
  export function onAuthStateChanged(auth: Auth, onChange: (user: GoogleUser | null) => void, onError: (error: unknown) => void): () => void;
  export function signInWithPopup(auth: Auth, provider: GoogleAuthProvider): Promise<{ user: GoogleUser }>;
  export function signOut(auth: Auth): Promise<void>;
}

import type { GoogleUser } from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';
export type { GoogleUser };

type AuthSdk = typeof import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js');
const firebaseConfig={apiKey:'AIzaSyAMWXfxX1IZzzw-5rjxW9wM8XPGfQcEtRs',authDomain:'clearcut-remove-bg.firebaseapp.com',projectId:'clearcut-remove-bg',appId:'1:808809624427:web:5e1655095c0a1df7c3522e'};
let client: (AuthSdk & { auth: ReturnType<AuthSdk['getAuth']> }) | undefined;
const clientPromise=Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')]).then(async([appSdk,authSdk])=>{const app=appSdk.initializeApp(firebaseConfig),auth=authSdk.getAuth(app);await authSdk.setPersistence(auth,authSdk.browserLocalPersistence);return client={auth,...authSdk};});
export function watchGoogleAuth(onChange: (user: GoogleUser | null) => void, onError: (error: unknown) => void){return clientPromise.then(({auth,onAuthStateChanged})=>onAuthStateChanged(auth,onChange,onError)).catch(error=>{onError(error);throw error;});}
export function signInWithGoogle(){if(!client)throw new Error('Google sign-in is still loading.');return client.signInWithPopup(client.auth,new client.GoogleAuthProvider());}
export function signOutGoogle(){return client!.signOut(client!.auth);}
export async function getGoogleAuthToken(){const { auth } = await clientPromise;if(!auth.currentUser)throw new Error('Sign in with Google before using checkout.');return auth.currentUser.getIdToken();}

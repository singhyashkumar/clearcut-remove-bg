const firebaseConfig={apiKey:'AIzaSyAMWXfxX1IZzzw-5rjxW9wM8XPGfQcEtRs',authDomain:'clearcut-remove-bg.firebaseapp.com',projectId:'clearcut-remove-bg',appId:'1:808809624427:web:5e1655095c0a1df7c3522e'};
let client;
const clientPromise=Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')]).then(([appSdk,authSdk])=>{const app=appSdk.initializeApp(firebaseConfig);return client={auth:authSdk.getAuth(app),...authSdk};});
export function watchGoogleAuth(onChange,onError){return clientPromise.then(({auth,onAuthStateChanged})=>onAuthStateChanged(auth,onChange,onError)).catch(error=>{onError(error);throw error;});}
export function signInWithGoogle(){if(!client)throw new Error('Google sign-in is still loading.');return client.signInWithPopup(client.auth,new client.GoogleAuthProvider());}
export function signOutGoogle(){return client.signOut(client.auth);}


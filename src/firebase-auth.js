const firebaseConfig={apiKey:'AIzaSyAMWXfxX1IZzzw-5rjxW9wM8XPGfQcEtRs',authDomain:'clearcut-remove-bg.firebaseapp.com',projectId:'clearcut-remove-bg',appId:'1:808809624427:web:5e1655095c0a1df7c3522e'};
let clientPromise;
function getClient(){return clientPromise??=(async()=>{const [appSdk,authSdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js')]);const app=appSdk.initializeApp(firebaseConfig);return{auth:authSdk.getAuth(app),...authSdk};})()}
export async function watchGoogleAuth(onChange,onError){try{const{auth,onAuthStateChanged}=await getClient();return onAuthStateChanged(auth,onChange,onError);}catch(error){onError(error);}}
export async function signInWithGoogle(){const{auth,GoogleAuthProvider,signInWithPopup}=await getClient();return signInWithPopup(auth,new GoogleAuthProvider());}
export async function signOutGoogle(){const{auth,signOut}=await getClient();return signOut(auth);}

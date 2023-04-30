import {app} from "./firebaseApp.js";
// import {getAuth, connectAuthEmulator} from "/__/firebase/9.21.0/firebase-auth.js";
import {getAuth, connectAuthEmulator} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";

export const auth = getAuth(app);
export default auth

if (window.location.hostname === "localhost") {
    connectAuthEmulator(auth, 'http://localhost:9099');
}

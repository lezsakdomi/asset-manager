import {app} from "./firebaseApp.js";
import {getFirestore, connectFirestoreEmulator} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";

export const db = getFirestore(app);

if (window.location.hostname === "localhost") {
    connectFirestoreEmulator(db, 'localhost', 8080);
}

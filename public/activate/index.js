import {authenticated} from "../auth.js";
import domContentLoaded from "../domContentLoaded.js";
import {collection, doc, onSnapshot, updateDoc} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import {db} from "../firebaseFirestore.js";
import auth from "../firebaseAuth.js";

(async () => {
    await domContentLoaded;
    document.getElementById('activate-button').addEventListener('click', event => {
        (async () => {
            await authenticated;
            await updateDoc(doc(collection(db, 'users'), auth.currentUser.uid), {
                'customClaims.activated': true,
            });
        })().catch(console.error);
        event.preventDefault();
    });
})();

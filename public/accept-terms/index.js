import {authenticated} from "../auth.js";
import domContentLoaded from "../domContentLoaded.js";
import {collection, doc, onSnapshot, updateDoc, getDoc} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import {db} from "../firebaseFirestore.js";
import auth from "../firebaseAuth.js";

(async () => {
    await domContentLoaded;
    document.getElementById('accept-terms-button').addEventListener('click', event => {
        (async () => {
            await authenticated;
            const userDoc = doc(collection(db, 'users'), auth.currentUser.uid);
            const userDocSs = await getDoc(userDoc);
            if (!userDocSs.exists) {
                alert(`Unfortunately users/${auth.currentUser.uid} does not exists, please contact the administrator (csaba.paszernak@t-online.hu)`)
            }
            if (!userDocSs.data().customClaims) {
                await updateDoc(userDoc, {
                    'customClaims': {},
                })
            }
            await updateDoc(userDoc, {
                'customClaims.termsAccepted': true,
            });
        })().catch(console.error);
        event.preventDefault();
    });
})();

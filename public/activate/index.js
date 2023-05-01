import {authenticated} from "../auth.js";
import domContentLoaded from "../domContentLoaded.js";
import {collection, doc, onSnapshot, updateDoc} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import {db} from "../firebaseFirestore.js";
import auth from "../firebaseAuth.js";

function updateStyle({activated}) {
    const styleElement = document.getElementById('auth-style');
    if (styleElement) {
        styleElement.innerText = `
.when-activated {
    display: ${activated ? 'initial' : 'none'};
}
.unless-activated {
    display: ${!activated ? 'initial' : 'none'};
}
`;
    }
}

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
    await authenticated;
    onSnapshot(doc(collection(db, 'users'), auth.currentUser.uid), dss => {
        const {customClaims: {activated}} = dss.data();
        updateStyle({activated});
    });
})();

import domContentLoaded from "./domContentLoaded.js";
import {auth} from "./firebaseAuth.js";
import "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import "./firebaseApp.js";
import {collection, doc, onSnapshot, getDoc} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";

function updateStyle({authenticated, registered, activated, member}) {
    const styleElement = document.getElementById('auth-style');
    if (styleElement) {
        styleElement.innerHTML = (authenticated === undefined ? `
.if-authenticated {
    display: none;
}
.if-unauthenticated {
    display: none;
}
` : `
.if-authenticated {
    display: ${authenticated ? 'initial' : 'none !important'};
}
.if-unauthenticated {
    display: ${!authenticated ? 'initial' : 'none !important'};
}
`) + (activated === undefined ? `
.when-activated {
    display: none;
}
.unless-activated {
    display: none;
}
` : `
.when-activated {
    display: ${activated ? 'initial' : 'none !important'};
}
.unless-activated {
    display: ${!activated ? 'initial' : 'none !important'};
}
`) + (registered === undefined ? `
.when-registered {
    display: none;
}
.unless-registered {
    display: none;
}
` : `
.when-registered {
    display: ${registered ? 'initial' : 'none !important'};
}
.unless-registered {
    display: ${!registered ? 'initial' : 'none !important'};
}
`) + (member === undefined ? `
.when-member {
    display: none;
}
.unless-member {
    display: none;
}
` : `
.when-member {
    display: ${member ? 'initial' : 'none !important'};
}
.unless-member {
    display: ${!member ? 'initial' : 'none !important'};
}
`);
    }
}

const initialAuthState = new Promise((resolve, reject) => {
    const stopAuthStateChanges = onAuthStateChanged(auth, user => {
        stopAuthStateChanges()
        resolve(user)
    })
})

export const authenticated = Promise.all([
    domContentLoaded,
    (async () => {
        await import("https://www.gstatic.com/firebasejs/9.21.0/firebase-app-compat.js");
        await import("https://www.gstatic.com/firebasejs/9.21.0/firebase-auth-compat.js");
        await import("/__/firebase/init.js?useEmulator=" + (window.location.hostname === "localhost"));
    })()
]).then(async () => {
    console.assert(window.firebase && window.firebase.auth());

    console.assert(window.firebaseui && window.firebaseui.auth);

    console.assert(document.getElementById('firebaseui-auth-container'));

    updateStyle({});
    window.auth = auth;

    if (await initialAuthState) {
        return initialAuthState;
    } else {
        await window.firebase.auth().setPersistence(window.firebase.auth.Auth.Persistence.SESSION);
        return new Promise((resolve, reject) => {
            const ui = new window.firebaseui.auth.AuthUI(window.firebase.auth());
            window.authUi = ui;
            updateStyle({authenticated: false});
            ui.start('#firebaseui-auth-container', {
                signInFlow: 'popup',
                signInOptions: [
                    window.firebase.auth.EmailAuthProvider.PROVIDER_ID,
                    window.firebase.auth.PhoneAuthProvider.PROVIDER_ID,
                ],
                callbacks: {
                    signInSuccessWithAuthResult(authResult, redirectUrl) {
                        updateStyle({authenticated: true});
                        if (authResult.user) {
                            resolve(authResult.user);
                        } else {
                            reject(new Error("Authenticated without a user"))
                        }
                        return false;
                    },
                },
            });
        });
    }
}).then(async (user) => {
    window.authenticatedUid = user.uid
    const {db} = await import("./firebaseFirestore.js")
    return new Promise((resolve, reject) => {
        onSnapshot(doc(collection(db, 'users'), user.uid), dss => {
            if (dss.data()) {
                const {customClaims: {activated = false} = {}} = dss.data();
                updateStyle({authenticated: true, member: true, activated, registered: true});
                resolve()
            } else {
                updateStyle({authenticated: true, registered: false});
                reject(new Error("No Firestore document for authenticated user"))
            }
        }, reject);
    }).then(() => user);
}).then(user => {
    const {uid} = user

    if (!window.auth.currentUser) {
        throw new Error("Authenticated in modular firebase, but not in compat")
    }

    if (window.auth.currentUser.uid !== uid) {
        throw new Error("Modular and compat UID mismatch")
    }

    return user;
}).catch(e => {
    const LAST_AUTH_ERROR_RELOAD_KEY = 'lastAuthErrorReload';
    if (new Date() - new Date(localStorage.getItem(LAST_AUTH_ERROR_RELOAD_KEY)) > 3000) {
        localStorage.setItem(LAST_AUTH_ERROR_RELOAD_KEY, (new Date()).toString())
        location.reload()
    } else {
        console.error(e);
        document.write(`<pre>${e.toString()}</pre>`);
    }

    throw e;
});

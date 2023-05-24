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

    updateStyle({authenticated: false});

    if (!await initialAuthState) {
        await window.firebase.auth().setPersistence(window.firebase.auth.Auth.Persistence.SESSION);
        return new Promise((resolve, reject) => {
            const ui = new window.firebaseui.auth.AuthUI(window.firebase.auth());
            window.authUi = ui;
            window.auth = auth;
            ui.start('#firebaseui-auth-container', {
                signInFlow: 'popup',
                signInOptions: [
                    window.firebase.auth.EmailAuthProvider.PROVIDER_ID,
                    window.firebase.auth.PhoneAuthProvider.PROVIDER_ID,
                ],
                callbacks: {
                    signInSuccessWithAuthResult(authResult, redirectUrl) {
                        updateStyle({authenticated: true});
                        resolve(authResult);
                        return false;
                    },
                },
            });
        });
    }
});

authenticated.then(() => {
    import("./firebaseFirestore.js").then(({db}) => {
        onSnapshot(doc(collection(db, 'users'), auth.currentUser.uid), dss => {
            if (dss.data()) {
                const {customClaims: {member = false, activated = false} = {}} = dss.data();
                updateStyle({authenticated: true, member, activated, registered: true});
            } else {
                updateStyle({authenticated: true, registered: false});
            }
        });
    });
}, e => {
    console.error(e);
    document.write(`<pre>${e.toString()}</pre>`);
})

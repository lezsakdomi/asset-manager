import domContentLoaded from "./domContentLoaded.js";
import {auth} from "./firebaseAuth.js";
import "https://www.gstatic.com/firebasejs/9.21.0/firebase-auth.js";
import "./firebaseApp.js";

function updateStyle({authenticated}) {
    const styleElement = document.getElementById('auth-style');
    if (styleElement) {
        styleElement.innerText = `
.if-authenticated {
    display: ${authenticated ? 'initial' : 'none'};
}
.if-unauthenticated {
    display: ${!authenticated ? 'initial' : 'none'};
}
`;
    }
}

export const authenticated = Promise.all([
    domContentLoaded,
    (async () => {
        await import("https://www.gstatic.com/firebasejs/9.21.0/firebase-app-compat.js");
        await import("https://www.gstatic.com/firebasejs/9.21.0/firebase-auth-compat.js");
        await import("/__/firebase/init.js?useEmulator=" + (window.location.hostname === "localhost"));
    })()
]).then(() => {
    console.assert(window.firebase && window.firebase.auth());

    console.assert(window.firebaseui && window.firebaseui.auth);

    console.assert(document.getElementById('firebaseui-auth-container'));

    updateStyle({authenticated: false})

    return new Promise((resolve, reject) => {
        const ui = new window.firebaseui.auth.AuthUI(window.firebase.auth());
        window.authUi = ui;
        window.auth = auth;
        ui.start('#firebaseui-auth-container', {
            signInFlow: 'popup',
            signInOptions: [
                window.firebase.auth.EmailAuthProvider.PROVIDER_ID,
                window.firebase.auth.GoogleAuthProvider.PROVIDER_ID,
            ],
            callbacks: {
                signInSuccessWithAuthResult(authResult, redirectUrl) {
                    updateStyle({authenticated: true})
                    resolve(authResult);
                    return false;
                },
            },
        });
    });
});

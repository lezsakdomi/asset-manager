// import {initializeApp} from "/__/firebase/9.21.0/firebase-app.js"
import {initializeApp} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-app.js"

const response = await fetch('/__/firebase/init.json');
export const app = initializeApp(await response.json());
window.firebaseApp = app

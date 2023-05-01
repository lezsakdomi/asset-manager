// import "/__/firebase/9.21.0/firebase-firestore.js"

import {app} from "../firebaseApp.js";
import {authenticated} from "../auth.js";
import domContentLoaded from "../domContentLoaded.js";
import {db} from "../firebaseFirestore.js";
import {
    addDoc,
    collection, doc,
    limit,
    onSnapshot,
    orderBy,
    query, runTransaction, serverTimestamp, updateDoc,
    where, writeBatch
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import {ulid} from "https://unpkg.com/ulid@2.3.0/dist/index.esm.js";
import {auth} from "../firebaseAuth.js";

import {UserInfo, AssetOtr, AssetItem} from "../elements.js";

(async () => {
    await domContentLoaded;
    const assetId = decodeURI(location.hash.slice(1));
    document.getElementById('asset-id').innerText = assetId;
    await authenticated;
    const docRef = window.docRef = doc(collection(db, 'assets'), assetId);
    onSnapshot(docRef, (dss) => {
        window.dss = dss;
        document.getElementById('asset-container').replaceChildren(new AssetItem(dss));
    });
})();
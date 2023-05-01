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
    const assetId = decodeURIComponent(location.pathname.split('/')[2]);
    document.getElementById('asset-id').innerText = assetId;
    document.title = assetId;
    await authenticated;
    const docRef = window.docRef = doc(collection(db, 'assets'), assetId);
    let previousData;
    onSnapshot(docRef, (dss) => {
        window.dss = dss;
        document.title = dss.data().name;
        if (previousData && !Object.entries(dss.data())
            .filter(([k, v]) => previousData[k] !== v)
            .filter(([k, v]) => !k.startsWith('latest'))
            .length) {
            return;
        } else {
            console.log(previousData && Object.entries(dss.data())
                .filter(([k, v]) => previousData[k] !== v)
                .filter(([k, v]) => !k.startsWith('latest')));
        }
        document.querySelector('#loader').style.display = 'none';
        document.getElementById('asset-container').replaceChildren(new AssetItem(dss));
        previousData = dss.data();
    });
})();

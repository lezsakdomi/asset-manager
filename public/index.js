// import "/__/firebase/9.21.0/firebase-firestore.js"

import {app} from "./firebaseApp.js";
import {authenticated} from "./auth.js";
import domContentLoaded from "./domContentLoaded.js";
import {db} from "./firebaseFirestore.js";
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
import {auth} from "./firebaseAuth.js";

import {UserInfo, AssetOtr, AssetItem} from "./elements.js";

Promise.all([domContentLoaded, authenticated]).then(() => {
    const assetQuery = query(collection(db, 'assets'), where('available', '==', true));
    onSnapshot(assetQuery, (assetsSnapshot) => {
        document.querySelector('#loader').style.display = 'none';
        assetsSnapshot.docChanges().forEach(assetChange => {
            const {doc} = assetChange;
            switch (assetChange.type) {
                case 'added': {
                    document.getElementById('assets').appendChild(new AssetItem(doc));
                    break;
                }
                case 'removed': {
                    document.getElementById('assets').removeChild(document.getElementById(doc.ref.path));
                    break;
                }
                case 'modified': {
                    const nextSibling = document.getElementById(doc.ref.path).nextSibling;
                    document.getElementById('assets').removeChild(document.getElementById(doc.ref.path));
                    document.getElementById('assets').insertBefore(new AssetItem(doc), nextSibling);
                    break;
                }
            }
        });
    });
});

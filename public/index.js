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

class UserInfo extends HTMLElement {
    constructor(uid) {
        super();
        this.docRef = doc(db, 'users', uid);
        this.setup = () => {
            const fr = document.getElementById('user-info').content.cloneNode(true);
            this.appendChild(fr);
            this.querySelector('#user-info-uid').innerText = uid;
            this.setup = noop;
        };
    }

    connectedCallback() {
        this.setup();
        this.removeSnapshotListener = onSnapshot(this.docRef, (dss) => {
            if (dss.exists()) {
                this.classList.add('existing');

                const {displayName, phoneNumber} = dss.data();

                if (displayName) {
                    this.classList.add('has-name');
                    this.querySelector('#user-info-name').innerText = displayName;
                } else {
                    this.classList.remove('has-name');
                    this.querySelector('#user-info-name').innerText = "";
                }

                if (phoneNumber) {
                    this.querySelector('#user-info-call').setAttribute('href', `tel://${phoneNumber}`);
                } else {
                    this.querySelector('#user-info-call').removeAttribute('href');
                }
            } else {
                this.classList.remove('existing');
                this.classList.remove('has-name');
                this.querySelector('#user-info-name').innerText = "";
                this.querySelector('#user-info-call').removeAttribute('href');
            }
        });
    }

    disconnectedCallback() {
        this.removeSnapshotListener();
        this.classList.remove('existing');
        this.classList.remove('has-name');
        this.querySelector('#user-info-name').innerText = "";
        this.querySelector('#user-info-call').removeAttribute('href');
    }
}

customElements.define('user-info', UserInfo);

class AssetOtr extends HTMLElement {
    constructor(doc) {
        super();
        this.doc = doc;
        this.setAttribute('id', doc.ref.path);
        this.setup = () => {
            const fr = document.getElementById('asset-otr').content.cloneNode(true);
            this.appendChild(fr);
            const {uid} = this.doc.data();
            this.querySelector('#asset-otr-user').replaceChildren(new UserInfo(uid));
            this.querySelector('#asset-otr-accept').addEventListener('click', (event) => {
                this.acceptOtr().catch(console.error);
                event.preventDefault();
            });
            this.querySelector('#asset-otr-reject').addEventListener('click', (event) => {
                this.rejectOtr().catch(console.error);
                event.preventDefault();
            });
            this.setup = noop;
        };
    }

    async acceptOtr() {
        try {
            this.querySelector('#asset-otr-accept').classList.add('wip');
            const {uid} = this.doc.data();
            const batch = writeBatch(db);
            const ownerDocRef = this.doc.ref.parent.parent;
            const assetDocRef = this.doc.ref.parent.parent.parent.parent;
            const newOwnerId = ulid(Date.now());
            const newOwnerRef = doc(assetDocRef, 'owners', newOwnerId);
            batch.set(newOwnerRef, {
                since: serverTimestamp(),
                uid,
                previousOwnerId: ownerDocRef.id,
                otrId: this.doc.id,
                // otrRef: this.doc.ref,
            });
            batch.update(assetDocRef, {
                latestOwnerId: newOwnerId,
                // latestOwnerRef: newOwnerRef,
                latestOwnerUid: uid,
            });
            await batch.commit();
        } finally {
            this.querySelector('#asset-otr-accept').classList.remove('wip');
        }
    }

    async rejectOtr() {
        try {
            this.querySelector('#asset-otr-reject').classList.add('wip');
            await updateDoc(this.doc.ref, {rejected: true});
        } finally {
            this.querySelector('#asset-otr-reject').classList.remove('wip');
        }
    }

    connectedCallback() {
        this.setup();
    }

    disconnectedCallback() {
    }
}

function noop() {
    // noop
}

class AssetItem extends HTMLElement {
    constructor(doc) {
        super();
        this.doc = doc;
        this.setAttribute('id', doc.ref.path);
        this.removeOwnerListener = noop;
        this.removeOtrListener = noop;
        this.setup = () => {
            const fr = document.getElementById('asset-item').content.cloneNode(true);
            this.appendChild(fr);
            const {name} = this.doc.data();
            this.querySelector('#asset-item-name').innerText = name;
            this.querySelector('#asset-item-otr-button').addEventListener('click', event => {
                this.ownershipTransferRequest().catch(console.error);
                event.preventDefault();
            });
            this.querySelector('#asset-outgoing-otr-reject').addEventListener('click', event => {
                this.cancelOwnershipTransferRequest().catch(console.error);
                event.preventDefault();
            });
            this.setup = noop;
        };
    }

    removeOtrs() {
        this.querySelector('#asset-item-otrs').innerHTML = "";
    }

    async ownershipTransferRequest() {
        if (this.ownerDoc) {
            try {
                this.querySelector('#asset-item-otr-button').classList.add('wip');
                await addDoc(collection(this.ownerDoc.ref, 'ownership-transfer-requests'), {
                    uid: auth.currentUser.uid,
                    rejected: false,
                    at: serverTimestamp(),
                });
            } finally {
                this.querySelector('#asset-item-otr-button').classList.remove('wip');
            }
        }
    }

    async cancelOwnershipTransferRequest() {
        if (this.outgoingOtrDocs) {
            try {
                this.querySelector('#asset-outgoing-otr-reject').classList.add('wip');
                await Promise.all(this.outgoingOtrDocs.map(doc => updateDoc(doc.ref, {rejected: true})));
            } finally {
                this.querySelector('#asset-outgoing-otr-reject').classList.remove('wip');
            }
        }
    }

    connectedCallback() {
        this.setup();
        const ownerQuery = query(collection(this.doc.ref, 'owners'), orderBy('since', 'desc'), limit(1));
        this.removeOwnerListener = onSnapshot(ownerQuery, (qss) => {
            this.removeOtrListener();
            this.removeOtrs();
            this.ownerDoc = undefined;
            if (qss.docs.length) {
                const [doc] = qss.docs;
                this.ownerDoc = doc;
                const {uid} = doc.data();
                this.querySelector('#asset-item-owner').replaceChildren(new UserInfo(uid));
                if (uid === auth.currentUser.uid) {
                    this.classList.add('owned');
                    this.classList.remove('not-owned');
                    const otrQuery = query(collection(doc.ref, 'ownership-transfer-requests'), where('rejected', '==', false));
                    const removeOtrListener = onSnapshot(otrQuery, (qss) => {
                        qss.docChanges().forEach((dc) => {
                            const {doc} = dc;
                            switch (dc.type) {
                                case 'added': {
                                    this.querySelector('#asset-item-otrs').appendChild(new AssetOtr(doc));
                                    break;
                                }

                                case 'removed': {
                                    this.querySelector('#asset-item-otrs').removeChild(document.getElementById(doc.ref.path));
                                    break;
                                }

                                case 'modified': {
                                    const nextSibling = document.getElementById(doc.ref.path).nextSibling;
                                    this.querySelector('#asset-item-otrs').removeChild(document.getElementById(doc.ref.path));
                                    this.querySelector('#asset-item-otrs').insertBefore(new AssetOtr(doc), nextSibling);
                                    break;
                                }
                            }
                        });
                    });
                    this.removeOtrListener = () => {
                        this.removeOtrs();
                        removeOtrListener();
                        this.removeOtrListener = noop;
                    };
                } else {
                    this.classList.add('not-owned');
                    this.classList.remove('owned');
                    const otrQuery = query(collection(doc.ref, 'ownership-transfer-requests'),
                        where('rejected', '==', false),
                        where('uid', '==', auth.currentUser.uid));
                    const removeOtrListener = onSnapshot(otrQuery, (qss) => {
                        this.outgoingOtrDocs = qss.docs;
                        if (qss.docs.length) {
                            this.classList.add('otr-waiting');
                        } else {
                            this.classList.remove('otr-waiting');
                        }
                    });
                    this.removeOtrListener = () => {
                        this.outgoingOtrDocs = undefined;
                        this.classList.remove('otr-waiting');
                        removeOtrListener();
                        this.removeOtrListener = noop;
                    };
                }
            } else {
                this.classList.remove('owned');
                this.classList.remove('not-owned');
            }
        });
    }

    disconnectedCallback() {
        this.ownerDoc = undefined;
        this.classList.remove('owned');
        this.classList.remove('not-owned');
        this.querySelector('#asset-item-owner-name').innerText = "";
        this.querySelector('#asset-item-call').removeAttribute('href');
        this.removeOwnerListener();
        this.removeOtrListener();
    }
}

customElements.define('asset-otr', AssetOtr);
customElements.define('asset-item', AssetItem);

Promise.all([domContentLoaded, authenticated]).then(() => {
    const assetQuery = query(collection(db, 'assets'), where('available', '==', true));
    onSnapshot(assetQuery, (assetsSnapshot) => {
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

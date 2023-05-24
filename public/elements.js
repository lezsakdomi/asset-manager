import {
    addDoc, collection,
    doc, limit,
    onSnapshot, orderBy, query,
    serverTimestamp, updateDoc, where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import {db} from "./firebaseFirestore.js";
import {ulid} from "https://unpkg.com/ulid@2.3.0/dist/index.esm.js";
import auth from "./firebaseAuth.js";
import {authenticated} from "./auth.js";

function noop() {
    // noop
}

export class UserInfo extends HTMLElement {
    constructor(uid) {
        super();
        this.docRef = uid && doc(collection(db, 'users'), uid);
        this.setup = () => {
            const fr = document.getElementById('user-info').content.cloneNode(true);
            this.appendChild(fr);
            this.querySelector('#user-info-uid').innerText = uid || "";
            this.setup = noop;
        };
        this.removeSnapshotListener = noop;
    }

    connectedCallback() {
        this.setup();
        if (this.docRef) {
            this.removeSnapshotListener = onSnapshot(this.docRef, (dss) => {
                if (dss.exists()) {
                    this.classList.add('existing');

                    const {displayName, phoneNumber, address} = dss.data();

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

                    if (address) {
                        this.querySelector('#user-info-address').setAttribute('href', `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
                    } else {
                        this.querySelector('#user-info-address').removeAttribute('href');
                    }
                } else {
                    this.classList.remove('existing');
                    this.classList.remove('has-name');
                    this.querySelector('#user-info-name').innerText = "";
                    this.querySelector('#user-info-call').removeAttribute('href');
                }
            });
        }
    }

    disconnectedCallback() {
        this.removeSnapshotListener();
        this.classList.remove('existing');
        this.classList.remove('has-name');
        this.querySelector('#user-info-name').innerText = "";
        this.querySelector('#user-info-call').removeAttribute('href');
    }
}

export class AssetOtr extends HTMLElement {
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

export class AssetItem extends HTMLElement {
    constructor(doc) {
        super();
        this.doc = doc;
        this.setAttribute('id', doc.ref.path);
        this.removeOwnerListener = noop;
        this.removeOtrListener = noop;
        this.setup = () => {
            const fr = document.getElementById('asset-item').content.cloneNode(true);
            this.appendChild(fr);
            const {name, baseUid, description, pictureUrl} = this.doc.data();
            this.querySelector('#asset-item-name').innerText = name;
            if (this.querySelector('a#asset-item-name'))
                this.querySelector('a#asset-item-name').href = `/asset/${encodeURIComponent(this.doc.ref.id)}`;
            if (this.querySelector('#asset-item-base'))
                this.querySelector('#asset-item-base').replaceChildren(new UserInfo(baseUid || null));
            if (this.querySelector('#asset-item-description'))
                this.querySelector('#asset-item-description').innerText = description || "";
            if (this.querySelector('#asset-item-picture'))
                this.querySelector('#asset-item-picture').src = pictureUrl || "";
            this.querySelector('#asset-item-otr-button').addEventListener('click', event => {
                this.ownershipTransferRequest().catch(console.error);
                event.preventDefault();
            });
            this.querySelector('#asset-outgoing-otr-reject').addEventListener('click', event => {
                this.cancelOwnershipTransferRequest().catch(console.error);
                event.preventDefault();
            });
            if (this.querySelector('#asset-item-take-button'))
                this.querySelector('#asset-item-take-button').addEventListener('click', event => {
                    this.take().catch(console.error);
                    event.preventDefault();
                })
            this.setup = noop;
        };
    }

    removeOtrs() {
        this.querySelector('#asset-item-otrs').innerHTML = "";
    }

    async ownershipTransferRequest() {
        if (this.ownerDoc) {
            try {
                const user = await authenticated;
                this.querySelector('#asset-item-otr-button').classList.add('wip');
                if (this.querySelector('#asset-item-ownership-loader')) {
                    this.querySelector('#asset-item-ownership-loader').classList.remove('hidden');
                }
                await addDoc(collection(this.ownerDoc.ref, 'ownership-transfer-requests'), {
                    uid: user.uid,
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
                if (this.querySelector('#asset-item-ownership-loader')) {
                    this.querySelector('#asset-item-ownership-loader').classList.add('hidden');
                }
                await Promise.all(this.outgoingOtrDocs.map(doc => updateDoc(doc.ref, {rejected: true})));
            } finally {
                this.querySelector('#asset-outgoing-otr-reject').classList.remove('wip');
            }
        }
    }

    async take() {
        try {
            this.querySelector('#asset-item-take-button').classList.add('wip');
            const batch = writeBatch(db);
            const newOwnerId = ulid(Date.now());
            const newOwnerRef = doc(this.doc.ref, 'owners', newOwnerId);
            const user = await authenticated;
            batch.set(newOwnerRef, {
                since: serverTimestamp(),
                uid: user.uid,
            });
            batch.update(this.doc.ref, {
                latestOwnerId: newOwnerId,
                latestOwnerUid: user.uid,
            });
            await batch.commit();
        } finally {
            this.querySelector('#asset-item-take-button').classList.remove('wip');
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
                this.classList.remove('no-owner');
                const [doc] = qss.docs;
                this.ownerDoc = doc;
                const {uid} = doc.data();
                this.querySelector('#asset-item-owner').replaceChildren(new UserInfo(uid));
                if (uid === window.authenticatedUid) {
                    this.classList.add('owned');
                    this.classList.remove('not-owned');
                    if (this.querySelector('#asset-item-ownership-loader')) {
                        this.querySelector('#asset-item-ownership-loader').classList.add('load-complete');
                    }
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
                    if (this.querySelector('#asset-item-ownership-loader')) {
                        this.querySelector('#asset-item-ownership-loader').classList.remove('load-complete');
                    }
                    const otrQuery = query(collection(doc.ref, 'ownership-transfer-requests'),
                        where('rejected', '==', false),
                        where('uid', '==', window.authenticatedUid));
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
                this.classList.add('no-owner');
                this.classList.remove('owned');
                this.classList.remove('not-owned');
                this.querySelector('#asset-item-owner').replaceChildren(new UserInfo(null));
            }
        });
    }

    disconnectedCallback() {
        this.ownerDoc = undefined;
        this.classList.remove('owned');
        this.classList.remove('not-owned');
        this.classList.remove('no-owner');
        if (this.querySelector('#asset-item-ownership-loader')) {
            this.querySelector('#asset-item-ownership-loader').classList.remove('load-complete');
        }
        this.querySelector('#asset-item-owner').replaceChildren();
        this.removeOwnerListener();
        this.removeOtrListener();
    }
}

customElements.define('user-info', UserInfo);
customElements.define('asset-otr', AssetOtr);
customElements.define('asset-item', AssetItem);


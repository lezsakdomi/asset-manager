import "dotenv";
import admin from "firebase-admin";
import dotenv from "dotenv";
import {readFile} from "fs/promises";
import {ulid} from "ulid";

dotenv.config();

admin.initializeApp();

const firestore = admin.firestore();
const auth = admin.auth();
for (const asset of JSON.parse(await readFile("assets.json", 'utf-8'))) {
    let {baseUser: baseUid, description, name} = asset;
    console.log(name);
    const id = name;
    if (baseUid === "???") {
        baseUid = '_unknown';
    } else if (baseUid === "Forrási tér") {
        baseUid = null;
    } else if (baseUid && !baseUid.startsWith('?')) {
        const qss = await firestore.collection('users').where('displayName', '==', baseUid).get();
        const [dss] = qss.docs;
        if (dss) {
            baseUid = dss.id;
        } else {
            const newUid = '_fake_' + ulid();
            await firestore.collection('users').doc(newUid).set({
                displayName: baseUid
            });
            baseUid = newUid;
        }
    } else {
        console.warn(baseUid, "is not a valid user name")
        baseUid = '_unknown';
    }
    name = name[0].toUpperCase() + name.slice(1);
    name = name.replace(/\s+\d+$/, '');
    description = description || null;
    await firestore.collection('/assets').doc(id).set({
        name, description, baseUid, available: true
    });
}

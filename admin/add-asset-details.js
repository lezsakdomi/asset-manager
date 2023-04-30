import "dotenv";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config()

admin.initializeApp();

const firestore = admin.firestore();
for (const assetRef of await firestore.collection('/assets').listDocuments()) {
    console.log(assetRef.id)
    let name = assetRef.id;
    name = name[0].toUpperCase() + name.slice(1);
    name = name.replace(/\s+\d+$/, '');
    await assetRef.update({
        name,
        available: true,
    })
}

import * as functions from "firebase-functions";
import {app} from "./lite";
import * as admin from 'firebase-admin';
import {raw} from "express";
import {CallableContext} from "firebase-functions/lib/common/providers/https";

admin.initializeApp()

export const lite = functions.https.onRequest(app)

// // Start writing functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

export const onUserCreate = functions.auth.user().onCreate(async (user, context) => {
    user = JSON.parse(JSON.stringify(user))
    await admin.firestore().collection('users').doc(user.uid).set(user)
})

export const onUserDelete = functions.auth.user().onDelete(async (user, context) => {
    await admin.firestore().collection('users').doc(user.uid).delete()
})

async function httpsAssertAdmin(context: CallableContext) {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'The function must be called while authenticated.'
        );
    }

    console.log(context.auth.uid)
    const userDs = await admin.firestore().collection('users').doc(context.auth.uid).get()
    if (!userDs.exists) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'The authenticated user must have a valid document associated in Firestore.'
        );
    }

    if (!userDs.data().customClaims || !userDs.data().customClaims.admin) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'The authenticated user must have admin privileges set in Firestore.'
        );
    }
}

export const editUserField = functions.https.onCall(async (data, context) => {
    await httpsAssertAdmin(context);

    await admin.auth().updateUser(data.uid, {[data.field]: data.value || null})
    const targetUserDr = admin.firestore().collection('users').doc(data.uid);
    await targetUserDr.update(data.field, data.value || admin.firestore.FieldValue.delete())
})

export const listAllUsers = functions.https.onCall(async (data, context) => {
    await httpsAssertAdmin(context);

    const users = [];
    let pageToken = undefined;
    do {
        const result = await admin.auth().listUsers(1000, pageToken);
        users.push(...result.users);
        pageToken = result.pageToken;
    } while (pageToken);

    console.log(users)

    return {users};
})

import dotenv from "dotenv";
import admin from "firebase-admin";
import {promises as rlp} from "readline";
import {usersByEmail} from "./users.js";

dotenv.config();
const rl = rlp.createInterface({
    input: process.stdin,
    output: process.stderr,
});

admin.initializeApp();
const auth = admin.auth();
const firestore = admin.firestore();
const {users} = await auth.listUsers();
for (let user of users) {
    console.log(user.email);
    if (usersByEmail[user.email]) {
        const {displayName, phoneNumber, member} = usersByEmail[user.email];
        user = await auth.updateUser(user.uid, {
            displayName, phoneNumber
        });
    }
    await auth.setCustomUserClaims(user.uid, {
        member: null
    });
    const userRef = firestore.doc(`/users/${user.uid}`);
    if (!(await userRef.get()).exists) {
        if ((await rl.question("User is not found in database. Should we import it? [y/N] ")).toLowerCase() === 'y') {
            userRef.set(Object.entries(JSON.parse(JSON.stringify(user, (k, v) => v === undefined ? null : v)))
                .filter(([k, v]) => !k.startsWith('password'))
                .filter(([k, v]) => k !== 'customClaims')
                .reduce((a, [k, v]) => ({...a, [k]: v}), {}));
        } else {
            continue;
        }
    }
    if (usersByEmail[user.email]) {
        const {displayName, phoneNumber, member} = usersByEmail[user.email];
        await userRef.update({
            'customClaims.member': member,
            displayName: displayName || null,
            phoneNumber: phoneNumber || null,
        });
    }
    // if (!user.customClaims.member) {
    //     if ((await rl.question("User is not a member. Should we set it as member? [y/N] ")).toLowerCase() === 'y') {
    //         await auth.setCustomUserClaims(user.uid, {member: true});
    //         becameMember = true;
    //     }
    // }
    // if (user.customClaims.member || becameMember) {
    //     if (!user.phoneNumber) {
    //         const phoneNumber = await rl.question("User has no phone number set. Enter here, or leave empty to skip: ");
    //         if (phoneNumber) {
    //             await auth.updateUser(user.uid, {phoneNumber});
    //         }
    //     }
    //     await firestore.collection('users').doc(user.uid).set(
    //         Object.entries(JSON.parse(JSON.stringify(user, (k, v) => v === undefined ? null : v)))
    //             .filter(([k, v]) => !k.startsWith('password'))
    //             .reduce((a, [k, v]) => ({...a, [k]: v}), {}));
    // } else {
    //     if ((await rl.question("Should we delete it? [y/N] ")).toLowerCase() === 'y') {
    //         await auth.deleteUser(user.uid);
    //     }
    // }
}
rl.close();

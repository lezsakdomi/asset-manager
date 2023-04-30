import dotenv from "dotenv";
import admin from "firebase-admin";
import {promises as rlp} from "readline";

dotenv.config();
const rl = rlp.createInterface({
    input: process.stdin,
    output: process.stderr,
});

admin.initializeApp();
const auth = admin.auth();
const firestore = admin.firestore();
const {users} = await auth.listUsers();
for (const user of users) {
    console.log(user.email);
    let becameMember = false;
    if (!user.customClaims.member) {
        if ((await rl.question("User is not a member. Should we set it as member? [y/N] ")).toLowerCase() === 'y') {
            await auth.setCustomUserClaims(user.uid, {member: true});
            becameMember = true;
        }
    }
    if (user.customClaims.member || becameMember) {
        if (!user.phoneNumber) {
            const phoneNumber = await rl.question("User has no phone number set. Enter here, or leave empty to skip: ");
            if (phoneNumber) {
                await auth.updateUser(user.uid, {phoneNumber});
            }
        }
        await firestore.collection('users').doc(user.uid).set(
            Object.entries(JSON.parse(JSON.stringify(user, (k, v) => v === undefined ? null : v)))
                .filter(([k, v]) => !k.startsWith('password'))
                .reduce((a, [k, v]) => ({...a, [k]: v}), {}));
    } else {
        if ((await rl.question("Should we delete it? [y/N] ")).toLowerCase() === 'y') {
            await auth.deleteUser(user.uid);
        }
    }
}
rl.close()

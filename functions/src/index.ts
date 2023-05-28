import * as functions from "firebase-functions";
import * as express from 'express';
import * as pug from 'pug';
import {app} from "./lite";

export const lite = functions.https.onRequest(app)

// // Start writing functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

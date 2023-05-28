import {readFileSync} from 'fs'
import * as express from "express";
import * as cookieParser from 'cookie-parser';
import {getAuth, signInWithEmailAndPassword, User} from "@firebase/auth";
import * as AsyncLock from 'async-lock';
import {collection, doc, getDoc, getDocs, getFirestore, query, where} from "@firebase/firestore";
import {initializeApp} from "@firebase/app";

export const app = express();

app.set('view engine', 'pug')

type Credentials = {
    email: string;
    password: string;
}
const CREDENTIAL_EXPIRATION_MS = 60 * 1000;
const CREDENTIAL_COOKIE_NAME = 'credentials';

app.get('/login', (req, res) => {
    res.render('login', {redirect: req.query.redirect})
})

app.post('/login', (req, res) => {
    const credentials: Credentials = {
        email: req.body.email,
        password: req.body.password,
    };
    res.cookie(CREDENTIAL_COOKIE_NAME, btoa(JSON.stringify(credentials)), {
        expires: new Date(Date.now() + CREDENTIAL_EXPIRATION_MS)
    }).redirect(req.body.redirect || '.')
})

app.use('/logout', (req, res) => {
    res.clearCookie(CREDENTIAL_COOKIE_NAME)
    res.redirect('login')
})

app.use(cookieParser())
app.use((req, res, next) => {
    let {credentials} = req.cookies;
    if (!credentials) {
        const url = req.path
            .replace(/^\/+/, '')
            .replace(/[^\/]+/g, '..')
            .replace(/[^\/]+\/?$/, '')
            + 'login'
            + '?redirect=' + encodeURIComponent(req.path.replace(/^\//, ''))
        res.redirect(url)
        return;
    }

    try {
        credentials = atob(credentials)
        credentials = JSON.parse(credentials)
        console.assert(credentials.email)
        console.assert(credentials.password)
        req.credentials = credentials
        res.cookie(CREDENTIAL_COOKIE_NAME, req.cookies.credentials, {
            expires: new Date(Date.now() + CREDENTIAL_EXPIRATION_MS)
        })
        next()
    } catch (e) {
        next(e)
    }
})

declare global {
    namespace Express {
        interface Request {
            credentials: Credentials
        }
    }
}

initializeApp(JSON.parse(readFileSync('appConfig.json', 'utf8')))

const lock = new AsyncLock()
const AUTH = 'auth';
async function performAuthenticated(credentials: Credentials, f: (user: User) => Promise<void>) {
    const auth = getAuth()
    lock.acquire(AUTH, async () => {
        const {user} = await signInWithEmailAndPassword(auth, credentials.email, credentials.password)
        try {
            await f(user)
        } finally {
            await auth.signOut()
        }
    })
}

function op(f: (user: User, req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>) {
    return function (req, res, next) {
        performAuthenticated(req.credentials, user => f(user, req, res, next)).catch(next)
    }
}

app.get('/', op(async (user, req, res, next) => {
    const db = getFirestore()
    const assetsQs = await getDocs(query(collection(db, 'assets'), where('available', '==', true)))
    const assetPromises = assetsQs.docs.map(async qds => {
        const latestOwnerId = qds.data().latestOwnerId;
        const ownerDs = latestOwnerId && await getDoc(doc(db, 'assets', qds.id, 'owners', latestOwnerId));
        const ownerUserDs = ownerDs && ownerDs.exists() && await getDoc(doc(db, 'users', ownerDs.data().uid));
        return [qds.id, {
            ...qds.data(),
            owner: ownerDs && {...ownerDs.data(), user: ownerUserDs && ownerUserDs.data()},
        }]
    })
    const assetItems = await Promise.all(assetPromises)
    // @ts-ignore
    const assets = assetItems.reduce((a, [k, v]) => ({...a, [k]: v}), {})
    res.render('assets', {user, assets})
}))

app.get('/assets/:asset', op(async (user, req, res) => {
    const db = getFirestore()
    const ds = await getDoc(doc(db, 'assets', req.params.asset))
    const asset = ds.data()
    const ownerDs = asset && asset.latestOwnerId && await getDoc(doc(db, 'assets', ds.id, 'owners', asset.latestOwnerId));
    const ownerUserDs = ownerDs && ownerDs.exists() && await getDoc(doc(db, 'users', ownerDs.data().uid));
    const baseUserDs = asset && asset.baseUid && await getDoc(doc(db, 'users', asset.baseUid));
    res.render('asset', {
        user,
        assetId: req.query.asset,
        asset,
        owner: ownerDs && ownerDs.exists() && ownerDs.data(),
        ownerUser: ownerUserDs && ownerUserDs.exists() && ownerUserDs.data(),
        baseUser: baseUserDs && baseUserDs.exists() && baseUserDs.data(),
    })
}))

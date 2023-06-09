import {readFileSync} from 'fs'
import * as express from "express";
import * as cookieParser from 'cookie-parser';
import {getAuth, signInWithEmailAndPassword, User} from "@firebase/auth";
import * as AsyncLock from 'async-lock';
import {
    collection,
    doc,
    getDoc,
    getDocs,
    getFirestore,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch
} from "@firebase/firestore";
import {initializeApp} from "@firebase/app";
import {ulid} from "ulid";
import {getFunctions, httpsCallable} from "@firebase/functions";

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

function getLoginUrl(path: string) {
    return path
            .replace(/^\/+/, '')
            .replace(/[^\/]+|(?<=\/)$/g, '..')
            .replace(/[^\/]+$/, '')
        + 'login'
        + '?redirect=' + encodeURIComponent(path.replace(/^\//, ''))
}

app.use((req, res, next) => {
    let {credentials} = req.cookies;
    if (!credentials) {
        res.redirect(getLoginUrl(req.path))
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
    await lock.acquire(AUTH, async () => {
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

// here wrapping in `op` is not needed, but it's good to get errors ASAP
app.get('/', op(async (user, req, res) => {
    res.render('index')
}))

app.get('/assets/', op(async (user, req, res, next) => {
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
    const assetId = req.params.asset;

    const db = getFirestore()
    const ds = await getDoc(doc(db, 'assets', assetId))
    const asset = ds.data()
    const ownerDs = asset && asset.latestOwnerId && await getDoc(doc(db, 'assets', ds.id, 'owners', asset.latestOwnerId));
    const ownerUserDs = ownerDs && ownerDs.exists() && await getDoc(doc(db, 'users', ownerDs.data().uid));
    const baseUserDs = asset && asset.baseUid && await getDoc(doc(db, 'users', asset.baseUid));
    const userDs = await getDoc(doc(db, 'users', user.uid));
    res.render('asset', {
        user: userDs.data(),
        assetId,
        asset,
        owner: ownerDs && ownerDs.exists() && ownerDs.data(),
        ownerUser: ownerUserDs && ownerUserDs.exists() && ownerUserDs.data(),
        baseUser: baseUserDs && baseUserDs.exists() && baseUserDs.data(),
    })
}))

for (const field of ['owner', 'base']) {
    app.get('/assets/:asset/edit/' + field, op(async (user, req, res) => {
        const db = getFirestore()
        const usersQs = await getDocs(query(collection(db, 'users'), orderBy('displayName')))
        res.render('editAssetUser', {
            users: usersQs.docs.reduce((a, ds) => ({...a, [ds.id]: ds.data()}), {}),
            previousUid: req.query.previousUid,
            assetId: req.params.asset,
        })
    }))
}

app.post('/assets/:asset/edit/owner', op(async (user, req, res) => {
    const db = getFirestore()
    const ownerId = ulid()
    const batch = writeBatch(db)
    batch.set(doc(db, 'assets', req.params.asset, 'owners', ownerId), {
        uid: req.body.uid,
        since: serverTimestamp(),
    })
    batch.update(doc(db, 'assets', req.params.asset), {
        latestOwnerUid: req.body.uid,
        latestOwnerId: ownerId,
    })
    await batch.commit()
    res.redirect('../../' + req.params.asset)
}))

app.post('/assets/:asset/edit/base', op(async (user, req, res) => {
    const db = getFirestore()
    await updateDoc(doc(db, 'assets', req.params.asset), {
        baseUid: req.body.uid
    })
    res.redirect('../../' + req.params.asset)
}))

app.get('/users/', op(async (user, req, res) => {
    const db = getFirestore()
    const usersQs = await getDocs(collection(db, 'users'))
    const userDs = await getDoc(doc(db, 'users', user.uid));
    let systemUsers: User[] | undefined;
    if (userDs.exists() && userDs.data().customClaims && userDs.data().customClaims.admin) {
        const {data} = await httpsCallable<unknown, {
            users: User[];
        }>(getFunctions(), 'listAllUsers')()
        systemUsers = data.users;
    }
    res.render('users', {
        user: userDs.data(),
        users: usersQs.docs.reduce((a, ds) => ({...a, [ds.id]: ds.data()}), {}),
        systemUsers: systemUsers.reduce((a, u) => ({...a, [u.uid]: u}), {}),
    })
}))

app.get('/users/:uid/edit/:field', (req, res) => {
    res.render('editUserField', {previousValue: req.query.previousValue})
})

app.post('/users/:uid/edit/:field', op(async (user, req, res) => {
    await httpsCallable(getFunctions(), 'editUserField')({
        uid: req.params.uid,
        field: req.params.field,
        value: req.body.value || null,
    })
    res.redirect('../..')
}))

app.use((err, req, res, next) => {
    console.error(err)
    res.status(500)
    res.render('error', {err, loginUrl: getLoginUrl(req.path)})
})

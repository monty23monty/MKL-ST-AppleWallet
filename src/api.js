// src/api.js
import {del, get, post} from 'aws-amplify/api';
import {fetchAuthSession} from 'aws-amplify/auth';

/* ── helper ─────────────────────────────────────────── */

async function getAuthHeaders() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) throw new Error('User is not signed in');
    return {Authorization: idToken};
}

/* ── metrics & passes ───────────────────────────────── */

export async function getMetrics() {
    const headers = await getAuthHeaders();
    const {body} = await get({
        apiName: 'wallet',
        path: '/admin/metrics',
        options: {headers}
    }).response;
    return body.json();
}

export async function listPasses() {
    const headers = await getAuthHeaders();
    const {body} = await get({
        apiName: 'wallet',
        path: '/admin/passes',
        options: {headers}
    }).response;
    return body.json();
}

export async function bulkSend() {
    const headers = await getAuthHeaders();
    const {body} = await post({
        apiName: 'wallet',
        path: '/admin/bulkSend',
        options: {headers, body: {}}
    }).response;
    return body.json();
}

export async function resendPass(serial) {
    const headers = await getAuthHeaders();
    await post({
        apiName: 'wallet',
        path: `/admin/resend/${serial}`,
        options: {headers, body: {}}
    }).response;
}

export async function createPass(body) {
    const headers = await getAuthHeaders();
    const {body: resBody} = await post({
        apiName: 'wallet',
        path: '/createPass',
        options: {headers, body}
    }).response;
    return resBody.json();
}

export async function getPassData(serial) {
    const headers = await getAuthHeaders();
    const {body} = await get({
        apiName: 'wallet',
        path: `/admin/passes/${serial}`,
        options: {headers}
    }).response;
    return body.json();
}

export async function updatePassData(serial, passData) {
    const headers = await getAuthHeaders();
    const {body} = await post({
        apiName: 'wallet',
        path: `/admin/passes/${serial}`,
        options: {headers, body: {passData}}
    }).response;
    return body.json();
}

/* ── mail helpers ───────────────────────────────────── */

export async function mailPending() {
    const headers = await getAuthHeaders();
    const {body} = await post({
        apiName: 'wallet',
        path: '/admin/bulkSend',
        options: {headers, body: {}}
    }).response;
    return body.text();          // keeps the original string result
}

export async function pushFixture(payload) {
    const headers = await getAuthHeaders();
    const {body} = await post({
        apiName: 'wallet',
        path: '/admin/bulkFixture',
        options: {headers, body: payload}
    }).response;
    return body.text();
}

/* ── fixtures CRUD ─────────────────────────────────── */

export async function listFixtures() {
    const headers = await getAuthHeaders();
    const {body} = await get({
        apiName: 'wallet',
        path: '/admin/fixtures',
        options: {headers}
    }).response;
    return body.json();          // [{fixtureId, gameDate, opponent}]
}

export async function storeFixtures(arr) {              // arr = [{gameDate, opponent}]
    const headers = await getAuthHeaders();
    const fixtures = arr.map(f => ({
        fixtureId: f.fixtureId || `${f.gameDate}#${f.opponent}`,
        gameDate: f.gameDate,
        opponent: f.opponent
    }));
    await post({
        apiName: 'wallet',
        path: '/admin/fixtures',
        options: {headers, body: fixtures}
    }).response;
}

export async function deleteFixture(fixtureId) {
    const headers = await getAuthHeaders();
    await del({
        apiName: 'wallet',
        path: `/admin/fixtures/${encodeURIComponent(fixtureId)}`,
        options: {headers}
    }).response;
}

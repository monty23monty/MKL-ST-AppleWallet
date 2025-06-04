// src/api.js
import { get, post } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';

// Helper to fetch the current user's ID token (JWT)
async function getAuthHeaders() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) throw new Error('User is not signed in');
    return { Authorization: idToken };
}

/** GET  https://…/admin/metrics */
export async function getMetrics() {
    const headers = await getAuthHeaders();
    const { body } = await get({
        apiName: 'wallet',
        path: '/admin/metrics',
        options: { headers },
    }).response;

    return body.json();
}

/** GET  https://…/admin/passes */
export async function listPasses() {
    const headers = await getAuthHeaders();
    const { body } = await get({
        apiName: 'wallet',
        path: '/admin/passes',
        options: { headers },
    }).response;

    return body.json();
}

/** POST https://…/admin/bulkSend   (empty JSON body) */
export async function bulkSend() {
    const headers = await getAuthHeaders();
    const { body } = await post({
        apiName: 'wallet',
        path: '/admin/bulkSend',
        options: { headers, body: {} },
    }).response;

    return body.json();
}

/** POST https://…/admin/resend/{serial}   (empty JSON body) */
export async function resendPass(serial) {
    const headers = await getAuthHeaders();
    const { body } = await post({
        apiName: 'wallet',
        path: `/admin/resend/${serial}`,
        options: { headers, body: {} },
    }).response;

    return body.json();
}

// ⬆ existing imports & calls
export async function createPass(body) {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    if (!idToken) throw new Error('User is not signed in');

    const { body: responseBody } = await post({
        apiName: 'wallet',
        path: '/createPass',
        options: {
            headers: { Authorization: idToken },
            body,
        },
    }).response;

    return responseBody.json();
}

export async function getPassData(serial) {
    const headers = await getAuthHeaders();
    const { body } = await get({
        apiName: 'wallet',
        path: `/admin/passes/${serial}`,
        options: { headers },
    }).response;
    return body.json();
}

/** PUT  /admin/passes/{serial} */
export async function updatePassData(serial, passData) {
    const headers = await getAuthHeaders();
    const { body } = await post({
        apiName: 'wallet',
        path: `/admin/passes/${serial}`,
        options: {
            headers,
            body: JSON.stringify({ passData })
        },
    }).response;
    return body.json();
}
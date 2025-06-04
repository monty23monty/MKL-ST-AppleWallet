// src/api.js
import { get, post } from 'aws-amplify/api';   // v6 functional API

/** GET  https://…/admin/metrics */
export async function getMetrics() {
    const { body } = await get({
        apiName: 'wallet',
        path: '/admin/metrics',
    }).response;

    return body.json();               // ⇨ JS object
}

/** GET  https://…/admin/passes */
export async function listPasses() {
    const { body } = await get({
        apiName: 'wallet',
        path: '/admin/passes',
    }).response;

    return body.json();
}

/** POST https://…/admin/bulkSend   (empty JSON body) */
export async function bulkSend() {
    const { body } = await post({
        apiName: 'wallet',
        path: '/admin/bulkSend',
        options: { body: {} },
    }).response;

    return body.json();
}

/** POST https://…/admin/resend/{serial}   (empty JSON body) */
export async function resendPass(serial) {
    const { body } = await post({
        apiName: 'wallet',
        path: `/admin/resend/${serial}`,
        options: { body: {} },
    }).response;

    return body.json();
}

// src/api.js
/* ── metrics & passes ───────────────────────────────── */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function buildUrl(path) {
    // If path is already absolute, return as is
    if (/^https?:\/\//.test(path)) return path;
    // Otherwise, join with BASE_URL
    return BASE_URL.replace(/\/$/, '') + path;
}

export async function getMetrics(idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    const response = await fetch(buildUrl('/admin/metrics'), { headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch metrics: ${response.status} ${text}`);
    }
    return response.json();
}

export async function listPasses(idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    const response = await fetch(buildUrl('/admin/passes'), { headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to fetch passes: ${response.status} ${text}`);
    }
    return response.json();
}

export async function bulkSend(idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    const response = await fetch(buildUrl('/admin/bulkSend'), { method: 'POST', headers });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to bulk send: ${response.status} ${text}`);
    }
    return response.json();
}

export async function resendPass(serial, idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    await fetch(buildUrl(`/admin/resend/${serial}`), { method: 'POST', headers });
}

export async function createPass(body, idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = {
        'Content-Type': 'application/json',
        Authorization: idToken };
    const response = await fetch(buildUrl('/createPass'), { method: 'POST', headers, body: JSON.stringify(body) });
    if (!response.ok) throw new Error('Failed to create pass');
    return response.json();
}

export async function getPassData(serial, idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    const response = await fetch(buildUrl(`/admin/passes/${serial}`), { headers });
    if (!response.ok) throw new Error('Failed to fetch pass data');
    return response.json();
}

export async function updatePassData(
    serial,
    passData,
    idToken,
    files = {}
) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = {
        'Content-Type': 'application/json',
        Authorization: idToken
    };
    const body = JSON.stringify({
        passData,
        files   // may be empty object or { filename: base64, … }
    });
    const res = await fetch(
        buildUrl(`/admin/passes/${encodeURIComponent(serial)}`),
        {
            method: 'POST',
            headers,
            body
        }
    );
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Failed to update pass: ${res.status} ${txt}`);
    }
    return res.json();
}


/* ── mail helpers ───────────────────────────────────── */

export async function mailPending(idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    const response = await fetch(buildUrl('/admin/bulkSend'), { method: 'POST', headers });
    if (!response.ok) throw new Error('Failed to send mail');
    return response.text();          // keeps the original string result
}

export async function pushFixture(payload, idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    const response = await fetch(buildUrl('/admin/bulkFixture'), { method: 'POST', headers, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error('Failed to push fixture');
    return response.text();
}

/* ── fixtures CRUD ─────────────────────────────────── */

export async function listFixtures(idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    const response = await fetch(buildUrl('/admin/fixtures'), { headers });
    if (!response.ok) throw new Error('Failed to fetch fixtures');
    return response.json();          // [{fixtureId, gameDate, opponent}]
}

export async function storeFixtures(arr, idToken) {              // arr = [{gameDate, opponent}]
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    const fixtures = arr.map(f => ({
        fixtureId: f.fixtureId || `${f.gameDate}#${f.opponent}`,
        gameDate: f.gameDate,
        opponent: f.opponent
    }));
    await fetch(buildUrl('/admin/fixtures'), { method: 'POST', headers, body: JSON.stringify(fixtures) });
}

export async function deleteFixture(fixtureId, idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const headers = { Authorization: idToken };
    await fetch(buildUrl(`/admin/fixtures/${encodeURIComponent(fixtureId)}`), { method: 'DELETE', headers });
}

function authHeaders(idToken) {
    if (!idToken) throw new Error('User is not signed in');
    return { Authorization: idToken };
}

export async function listTemplateFiles(idToken) {
    const res = await fetch(buildUrl('/admin/template-files'), {
        headers: authHeaders(idToken)
    });
    if (!res.ok) throw new Error('Failed to list template files');
    return res.json();     // ['pass.json', 'icon.png', …]
}

export async function getTemplateFile(name, idToken) {
    const res = await fetch(buildUrl(`/admin/template-files/${encodeURIComponent(name)}`), {
        headers: authHeaders(idToken)
    });
    if (!res.ok) throw new Error('Failed to fetch file');
    if (name.toLowerCase().endsWith('.json')) {
        return await res.text();           // JSON as string
    } else {
        return await res.blob();           // binary Blob
    }
}

export async function uploadTemplateFile(name, data, idToken) {
    const isJson = name.toLowerCase().endsWith('.json');
    const headers = {
        ...authHeaders(idToken),
        'Content-Type': isJson ? 'application/json' : data.type || 'application/octet-stream'
    };
    let body;
    if (isJson) {
        body = data; // string
    } else {
        // Blob/File → ArrayBuffer
        body = await data.arrayBuffer();
    }
    const res = await fetch(buildUrl(`/admin/template-files/${encodeURIComponent(name)}`), {
        method: 'PUT',
        headers,
        body
    });
    if (!res.ok) throw new Error('Failed to upload file');
}

export async function deleteTemplateFile(name, idToken) {
    const res = await fetch(buildUrl(`/admin/template-files/${encodeURIComponent(name)}`), {
        method: 'DELETE',
        headers: authHeaders(idToken)
    });
    if (!res.ok) throw new Error('Failed to delete file');
}

export async function listPassAssets(serial, idToken) {
    const res = await fetch(
        buildUrl(`/admin/passes/${serial}/assets`),
        {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${idToken}`
            }
        }
    );
    if (!res.ok) {
        throw new Error(`Failed to list assets (${res.status})`);
    }
    return await res.json(); // array of filenames
}

export async function getPassFile(serial, filename, idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const url = buildUrl(`/admin/passes/${encodeURIComponent(serial)}/files/${encodeURIComponent(filename)}`);
    const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: idToken }
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`GET ${filename} failed: ${res.status} ${txt}`);
    }
    if (filename.toLowerCase().endsWith('.json')) {
        return await res.text();    // JSON payload
    } else {
        return await res.blob();    // binary Blob
    }
}

/**
 * Upload or replace a single file inside the .pkpass.
 * content may be either a string (for JSON) or a Blob/File.
 */
export async function uploadPassFile(serial, filename, content, idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const url = buildUrl(`/admin/passes/${encodeURIComponent(serial)}/files/${encodeURIComponent(filename)}`);
    const isJson = filename.toLowerCase().endsWith('.json');
    const headers = { Authorization: idToken };
    let body;

    if (isJson) {
        headers['Content-Type'] = 'application/json';
        body = content; // stringified JSON
    } else {
        // for binaries, let fetch handle the Blob content-type
        body = content;
    }

    const res = await fetch(url, {
        method: 'PUT',
        headers,
        body
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`PUT ${filename} failed: ${res.status} ${txt}`);
    }
    return await res.text();
}

/**
 * Delete a single file from the .pkpass bundle.
 */
export async function deletePassFile(serial, filename, idToken) {
    if (!idToken) throw new Error('User is not signed in');
    const url = buildUrl(`/admin/passes/${encodeURIComponent(serial)}/files/${encodeURIComponent(filename)}`);
    const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: idToken }
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(`DELETE ${filename} failed: ${res.status} ${txt}`);
    }
}
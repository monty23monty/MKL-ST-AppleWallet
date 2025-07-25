// src/components/Field.jsx

import React from 'react';

export default function Field({ label, type = 'text', path, data, set }) {
    // drill into `data` to pull out the current value at `path`
    const value = path.split('.').reduce((o, k) => {
        if (o == null) return '';
        return Array.isArray(o) ? o[Number(k)] : o[k];
    }, data) ?? '';

    // update handler that clones + sets the new value
    const onChange = e => {
        const clone = structuredClone(data);
        const segs  = path.split('.');
        let cur     = clone;
        while (segs.length > 1) cur = cur[segs.shift()];
        cur[segs[0]] = e.target.value;
        set(clone);
    };

    // **THIS RETURN IS WHAT YOU WERE MISSING**
    return (
        <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={onChange}
                style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
            />
        </div>
    );
}

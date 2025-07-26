import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import Editor from '@monaco-editor/react';
import {
    getPassData,
    listPasses,
    updatePassData,
    listPassAssets
} from '../api';
import HoverCard from '../components/HoverCard.jsx';
import PassPreview from '../components/PassPreview.jsx';

/* ── constants ───────────────────────────────────────────────── */
const PREVIEW_MARGIN = 3;
const PREVIEW_WIDTH  = 260;
const PREVIEW_HEIGHT = 160;
/* ────────────────────────────────────────────────────────────── */

/* ── Field component ─────────────────────────────────────────── */
function Field({ label, type = 'text', path, data, set }) {
    const value = path.split('.').reduce((o, k) => {
        if (o == null) return '';
        return Array.isArray(o) ? o[Number(k)] : o[k];
    }, data) ?? '';

    const onChange = e => {
        const clone = structuredClone(data);
        const segs  = path.split('.');
        let cur     = clone;
        while (segs.length > 1) cur = cur[segs.shift()];
        cur[segs[0]] = e.target.value;
        set(clone);
    };

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
/* ────────────────────────────────────────────────────────────── */

/* ── helper functions ───────────────────────────────────────── */
const rgbToHex = rgb => {
    const [r, g, b] = rgb.replace(/[^0-9,]/g, '').split(',').map(Number);
    return (
        '#' +
        [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
    );
};
const hexToRgb = h => {
    const [r, g, b] = h.slice(1).match(/.{2}/g).map(x => parseInt(x, 16));
    return `rgb(${r},${g},${b})`;
};
const isoToLocal = z     => new Date(z).toISOString().slice(0, 16);
const toIsoZ     = local => new Date(local).toISOString();
/* ────────────────────────────────────────────────────────────── */

export default function UpdatePass() {
    // DEBUG: log on every render
    console.log('UpdatePass render', { selected: useParams().serial, rawMode: undefined });

    const auth        = useAuth();
    const token       = auth.user?.access_token;
    const { serial }  = useParams();
    const navigate    = useNavigate();

    const [passes,     setPasses]     = useState([]);
    const [selected,   setSelected]   = useState(serial || '');
    const [data,       setData]       = useState(null);
    const [loading,    setLoading]    = useState(false);
    const [saving,     setSaving]     = useState(false);

    const [rawMode,    setRawMode]    = useState(false);
    const [rawJson,    setRawJson]    = useState('{}');
    const [rawFiles,   setRawFiles]   = useState({});
    const [assetList,  setAssetList]  = useState([]);

    const [preview,    setPreview]    = useState(null);
    const [hoverTimer, setHoverTimer] = useState(null);

    // 1) Load all passes
    useEffect(() => {
        setLoading(true);
        if (!token) return;
        listPasses(token)
            .then(setPasses)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [token]);

    // 2) Respond to URL change
    useEffect(() => {
        setSelected(serial || '');
    }, [serial]);

    // 3) Fetch passData when `selected` changes
    useEffect(() => {
        if (!selected) {
            setData(null);
            return;
        }
        setLoading(true);
        getPassData(selected, token)
            .then(pd => {
                setData({
                    ...pd,
                    backgroundColor: rgbToHex(pd.backgroundColor),
                    foregroundColor: rgbToHex(pd.foregroundColor),
                    labelColor:      rgbToHex(pd.labelColor),
                    relevantDate:    isoToLocal(pd.relevantDate),
                    eventTicket: {
                        ...pd.eventTicket,
                        headerFields: pd.eventTicket.headerFields.map(h => ({
                            ...h,
                            value: isoToLocal(h.value)
                        }))
                    }
                });
                setRawJson(JSON.stringify(pd, null, 2));
                setRawFiles({});
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selected, token]);

    // 4) Fetch assets only when we flip into rawMode
    useEffect(() => {
        if (rawMode && selected) {
            listPassAssets(selected, token)
                .then(setAssetList)
                .catch(console.error);
        }
    }, [rawMode, selected, token]);

    // Hover handlers
    const startHover = (pass, evt) => {
        clearTimeout(hoverTimer);
        const { clientX, clientY } = evt;
        const left = clientX + PREVIEW_MARGIN + PREVIEW_WIDTH > window.innerWidth;
        const x    = left
            ? clientX - PREVIEW_MARGIN - PREVIEW_WIDTH
            : clientX + PREVIEW_MARGIN;
        const y = Math.min(clientY, window.innerHeight - PREVIEW_HEIGHT - PREVIEW_MARGIN);
        const t = setTimeout(() => {
            setPreview({ data: JSON.parse(pass.passData || '{}'), x, y, show: false });
            requestAnimationFrame(() => setPreview(p => p && { ...p, show: true }));
        }, 800);
        setHoverTimer(t);
    };
    const stopHover = () => {
        clearTimeout(hoverTimer);
        setPreview(p => p && { ...p, show: false });
    };

    // File → base64 helper
    const fileToBase64 = file =>
        new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload  = () => res(reader.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

    // Form submit
    const handleFormSubmit = async e => {
        e.preventDefault();
        setSaving(true);
        const pd = {
            ...data,
            backgroundColor: rgbToHex(data.backgroundColor),
            foregroundColor: hexToRgb(data.foregroundColor),
            labelColor:      hexToRgb(data.labelColor),
            relevantDate:    toIsoZ(data.relevantDate),
            eventTicket: {
                ...data.eventTicket,
                headerFields: data.eventTicket.headerFields.map(h => ({
                    ...h,
                    value: toIsoZ(h.value)
                })),
                auxiliaryFields: data.eventTicket.auxiliaryFields
            },
            barcode: { ...data.barcode }
        };
        try {
            await updatePassData(selected, pd, {}, token);
            alert('Pass updated!');
            setRawJson(JSON.stringify(pd, null, 2));
        } catch (err) {
            console.error(err);
            alert('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Raw submit
    const handleRawSubmit = async () => {
        let pd;
        try {
            pd = JSON.parse(rawJson);
        } catch {
            return alert('Invalid JSON');
        }
        const filesPayload = {};
        for (const [fname, file] of Object.entries(rawFiles)) {
            filesPayload[fname] = await fileToBase64(file);
        }
        setSaving(true);
        try {
            await updatePassData(selected, pd, filesPayload, token);
            alert('Raw data + assets updated!');
            setRawMode(false);
            // reload into form
            setData({
                ...pd,
                backgroundColor: rgbToHex(pd.backgroundColor),
                foregroundColor: rgbToHex(pd.foregroundColor),
                labelColor:      rgbToHex(pd.labelColor),
                relevantDate:    isoToLocal(pd.relevantDate),
                eventTicket: {
                    ...pd.eventTicket,
                    headerFields: pd.eventTicket.headerFields.map(h => ({
                        ...h,
                        value: isoToLocal(h.value)
                    }))
                }
            });
        } catch (err) {
            console.error(err);
            alert('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // === RENDER LOGIC ===
    if (loading) return <p>Loading…</p>;

    // --- LIST SCREEN ---
    if (!selected) {
        return (
            <div style={{ position: 'relative' }}>
                <h2>Update a Pass</h2>
                <ul>
                    {passes.map(p => (
                        <li key={p.serialNumber}>
                            <button
                                onMouseEnter={e => startHover(p, e)}
                                onMouseLeave={stopHover}
                                onClick={() => navigate(`/update-pass/${p.serialNumber}`)}
                            >
                                {p.serialNumber} — {p.email}
                            </button>
                        </li>
                    ))}
                </ul>
                {preview && (
                    <HoverCard
                        data={preview.data}
                        top={preview.y}
                        left={preview.x}
                        show={preview.show}
                    />
                )}
            </div>
        );
    }

    // --- DATA-LOADED GUARD ---
    if (data === null) {
        return <p>Loading pass data…</p>;
    }

    // --- EDIT SCREEN ---
    return (
        <div style={{ padding: 20 }}>
            <h2>Pass {selected}</h2>

            {/* MODE TOGGLE */}
            <div style={{ marginBottom: 16 }}>
                <button
                    onClick={() => setRawMode(false)}
                    disabled={!rawMode}
                    style={{ marginRight: 8 }}
                >
                    Form Editor
                </button>
                <button onClick={() => setRawMode(true)} disabled={rawMode}>
                    Raw Editor
                </button>
            </div>

            {/* FLEX LAYOUT */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40 }}>
                {/* LEFT: Form or Raw */}
                <div style={{ flex: 1 }}>
                    {rawMode ? (
                        <>
                            <h3>Edit pass.json</h3>
                            <Editor
                                height="300px"
                                defaultLanguage="json"
                                value={rawJson}
                                onChange={v => setRawJson(v || '')}
                                options={{
                                    minimap: { enabled: false },
                                    formatOnPaste: true,
                                    formatOnType: true,
                                    tabSize: 2
                                }}
                            />

                            <h3 style={{ marginTop: 20 }}>Existing Assets</h3>
                            {assetList.length > 0 ? (
                                <ul>
                                    {assetList.map((name, i) => (
                                        <li key={`${name}-${i}`}>{name}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p>(no assets found)</p>
                            )}

                            <h3>Upload Replacements</h3>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={e => {
                                    const files = Array.from(e.target.files);
                                    setRawFiles(f =>
                                        files.reduce((acc, file) => {
                                            acc[file.name] = file;
                                            return acc;
                                        }, { ...f })
                                    );
                                }}
                            />
                            {Object.keys(rawFiles).length > 0 && (
                                <ul>
                                    {Object.keys(rawFiles).map((name, i) => (
                                        <li key={`${name}-${i}`}>{name}</li>
                                    ))}
                                </ul>
                            )}

                            <button onClick={handleRawSubmit} disabled={saving} style={{ marginTop: 12 }}>
                                {saving ? 'Saving…' : 'Save Raw'}
                            </button>
                        </>
                    ) : (
                        <form onSubmit={handleFormSubmit}>
                            <Field
                                label="Organization Name"
                                path="organizationName"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Description"
                                path="description"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Background Color"
                                type="color"
                                path="backgroundColor"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Foreground Color"
                                type="color"
                                path="foregroundColor"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Label Color"
                                type="color"
                                path="labelColor"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Logo Text"
                                path="logoText"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Relevant Date & Time"
                                type="datetime-local"
                                path="relevantDate"
                                data={data}
                                set={setData}
                            />

                            <h3>Header Field</h3>
                            <Field
                                label="Header Label"
                                path="eventTicket.headerFields.0.label"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Header Value"
                                type="datetime-local"
                                path="eventTicket.headerFields.0.value"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Header DateStyle"
                                path="eventTicket.headerFields.0.dateStyle"
                                data={data}
                                set={setData}
                            />

                            <h3>Primary Field</h3>
                            <Field
                                label="Primary Label"
                                path="eventTicket.primaryFields.0.label"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Primary Value"
                                path="eventTicket.primaryFields.0.value"
                                data={data}
                                set={setData}
                            />

                            <h3>Secondary Fields</h3>
                            <Field
                                label="Sec 1 Label"
                                path="eventTicket.secondaryFields.0.label"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Sec 1 Value"
                                path="eventTicket.secondaryFields.0.value"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Sec 2 Label"
                                path="eventTicket.secondaryFields.1.label"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Sec 2 Value"
                                path="eventTicket.secondaryFields.1.value"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Sec 2 Alignment"
                                path="eventTicket.secondaryFields.1.textAlignment"
                                data={data}
                                set={setData}
                            />

                            <h3>Auxiliary Fields</h3>
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 13 }}>
                                    <input
                                        type="checkbox"
                                        checked={!!data.eventTicket.auxiliaryFields?.find(a => a.key === 'standing')}
                                        onChange={e => {
                                            if (e.target.checked) {
                                                setData(d => ({
                                                    ...d,
                                                    eventTicket: {
                                                        ...d.eventTicket,
                                                        auxiliaryFields: [{ key: 'standing', label: 'STANDING', value: '' }]
                                                    }
                                                }));
                                            } else {
                                                setData(d => ({
                                                    ...d,
                                                    eventTicket: {
                                                        ...d.eventTicket,
                                                        auxiliaryFields: [{}, {}, {}]
                                                    }
                                                }));
                                            }
                                        }}
                                        style={{ marginRight: 6 }}
                                    />
                                    Standing Ticket
                                </label>
                            </div>
                            {data.eventTicket.auxiliaryFields?.[0]?.key === 'standing' ? (
                                <Field
                                    label="Standing Number"
                                    path="eventTicket.auxiliaryFields.0.value"
                                    data={data}
                                    set={setData}
                                />
                            ) : (
                                <>
                                    <Field
                                        label="Block"
                                        path="eventTicket.auxiliaryFields.0.value"
                                        data={data}
                                        set={setData}
                                    />
                                    <Field
                                        label="Row"
                                        path="eventTicket.auxiliaryFields.1.value"
                                        data={data}
                                        set={setData}
                                    />
                                    <Field
                                        label="Seat"
                                        path="eventTicket.auxiliaryFields.2.value"
                                        data={data}
                                        set={setData}
                                    />
                                </>
                            )}

                            <h3>Barcode</h3>
                            <Field
                                label="Barcode Message"
                                path="barcode.message"
                                data={data}
                                set={setData}
                            />
                            <Field
                                label="Barcode AltText"
                                path="barcode.altText"
                                data={data}
                                set={setData}
                            />

                            <button
                                type="submit"
                                disabled={saving}
                                style={{ marginTop: 16, padding: '8px 16px', width: '100%' }}
                            >
                                {saving ? 'Saving…' : 'Save & Push'}
                            </button>
                        </form>
                    )}
                </div>

                {/* LIVE PREVIEW */}
                <div style={{ minWidth: 300 }}>
                    <h3>Live Preview</h3>
                    <PassPreview
                        data={
                            rawMode ? JSON.parse(rawJson) : JSON.parse(JSON.stringify(data))
                        }
                    />
                </div>
            </div>
        </div>
    );
}

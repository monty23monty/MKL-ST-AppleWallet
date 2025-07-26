import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth }   from 'react-oidc-context';
import Editor        from '@monaco-editor/react';
import {
    getPassData,
    updatePassData,
    listPassAssets, deletePassFile, uploadPassFile
} from '../api';
import Field        from '../components/Field.jsx';
import PassPreview  from '../components/PassPreview.jsx';

/* ── helper functions ───────────────────────────────────────── */
const rgbToHex = rgb => {
    const [r, g, b] = rgb.replace(/[^0-9,]/g, '').split(',').map(Number);
    return '#' + [r, g, b].map(x =>
        x.toString(16).padStart(2, '0')
    ).join('').toUpperCase();
};
const hexToRgb = h => {
    const [r, g, b] = h.slice(1).match(/.{2}/g).map(x => parseInt(x, 16));
    return `rgb(${r},${g},${b})`;
};
const isoToLocal = z     => new Date(z).toISOString().slice(0, 16);
const toIsoZ     = local => new Date(local).toISOString();

/* ───────────────────────────────────────────────────────────── */

export default function PassEdit() {
    const { serial } = useParams();
    const auth       = useAuth();
    const idToken    = auth.user?.id_token;

    const fileInputRef = useRef(null);
    const [newFile, setNewFile]           = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileBlob, setFileBlob]         = useState(null);
    const [data,           setData]         = useState(null);
    const [rawJson,        setRawJson]      = useState('{}');
    const [rawMode,        setRawMode]      = useState(false);
    const [assetList,      setAssetList]    = useState([]);
    const [rawFiles,       setRawFiles]     = useState({});
    const [loading,        setLoading]      = useState(false);
    const [saving,         setSaving]       = useState(false);
    const [isStanding,     setIsStanding]   = useState(false);
    const [standingNumber, setStandingNumber]= useState('');

    // Select an existing asset for replace/delete
    function selectFile(name) {
        setSelectedFile(name);
        setFileBlob(null);
    }

// Upload the “new file” that was picked in the “Upload New File” section
    async function handleNewFileUpload() {
        if (!newFile) return;
        setLoading(true);
        try {
            await uploadPassFile(serial, newFile.name, newFile, idToken);
            alert(`Uploaded ${newFile.name}`);
            setNewFile(null);
            const list = await listPassAssets(serial, idToken);
            setAssetList(list);
        } catch (err) {
            console.error(err);
            alert('Upload failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

// Replace the currently‑selected asset with the file picked by the hidden input
    async function handleUploadFile() {
        if (!selectedFile || !fileBlob) return alert('No replacement file chosen');
        setLoading(true);
        try {
            await uploadPassFile(serial, selectedFile, fileBlob, idToken);
            alert(`Replaced ${selectedFile}`);
            const list = await listPassAssets(serial, idToken);
            setAssetList(list);
        } catch (err) {
            console.error(err);
            alert('Replace failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

// Delete the currently‑selected asset
    async function handleDeleteFile() {
        if (!selectedFile) return;
        if (!window.confirm(`Delete ${selectedFile}?`)) return;
        setLoading(true);
        try {
            await deletePassFile(serial, selectedFile, idToken);
            alert(`Deleted ${selectedFile}`);
            setSelectedFile(null);
            const list = await listPassAssets(serial, idToken);
            setAssetList(list);
        } catch (err) {
            console.error(err);
            alert('Delete failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    }


    // 1) Load & normalize passData
    useEffect(() => {
        if (!serial || !idToken) return;
        setLoading(true);
        getPassData(serial, idToken)
            .then(pd => {
                const normalized = {
                    ...pd,
                    backgroundColor: rgbToHex(pd.backgroundColor),
                    foregroundColor: rgbToHex(pd.foregroundColor),
                    labelColor:      rgbToHex(pd.labelColor),
                    logoText:        pd.logoText || '',
                    relevantDate:    isoToLocal(pd.relevantDate),
                    eventTicket: {
                        ...pd.eventTicket,
                        headerFields:    pd.eventTicket.headerFields.map(h => ({
                            ...h, value: isoToLocal(h.value)
                        })),
                        primaryFields:   pd.eventTicket.primaryFields.map(f => ({ ...f })),
                        secondaryFields: pd.eventTicket.secondaryFields.map(f => ({ ...f })),
                        auxiliaryFields: pd.eventTicket.auxiliaryFields.map(f => ({ ...f }))
                    },
                    barcode: {
                        message:         pd.barcode?.message         || '',
                        altText:         pd.barcode?.altText         || '',
                        format:          pd.barcode?.format          || '',
                        messageEncoding: pd.barcode?.messageEncoding || ''
                    }
                };
                setData(normalized);
                setRawJson(JSON.stringify(pd, null, 2));

                // detect standing
                const aux = normalized.eventTicket.auxiliaryFields;
                const s = aux.find(a =>
                    a.key === 'standing' ||
                    (a.label || '').toUpperCase() === 'STANDING'
                );
                if (s) {
                    setIsStanding(true);
                    setStandingNumber(s.value || '');
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [serial, idToken]);

    useEffect(() => {
        if (!rawMode || !serial || !idToken) {
            setAssetList([]);
            return;
        }
        listPassAssets(serial, idToken)
            .then(filenames => setAssetList(filenames))
            .catch(err => {
                console.error("Could not list assets:", err);
                setAssetList([]);  // graceful fallback
            });
    }, [rawMode, serial, idToken]);

    // 2) When entering raw mode, fetch the asset filenames
    useEffect(() => {
        if (rawMode && serial && idToken) {
            listPassAssets(serial, idToken)
                .then(setAssetList)
                .catch(console.error);
        }
    }, [rawMode, serial, idToken]);

    // 3) Helper to convert File → base64 for upload
    const fileToBase64 = file =>
        new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload  = () => res(reader.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

    const previewData = useMemo(() => {
        if (!data) return null;
        const clone = structuredClone(data);
        if (isStanding) {
            clone.eventTicket.auxiliaryFields = [
                { key:'standing', label:'STANDING', value: standingNumber }
            ];
        }
        return clone;
    }, [data, isStanding, standingNumber]);

    // 4a) Handle form‐mode submit
    const handleFormSubmit = async e => {
        e.preventDefault();
        if (!serial || !idToken) return;
        setSaving(true);

        const pd = {
            ...data,
            backgroundColor: hexToRgb(data.backgroundColor),
            foregroundColor: hexToRgb(data.foregroundColor),
            labelColor:      hexToRgb(data.labelColor),
            logoText:        data.logoText,
            relevantDate:    toIsoZ(data.relevantDate),
            eventTicket: {
                ...data.eventTicket,
                headerFields: data.eventTicket.headerFields.map(h => ({
                    ...h, value: toIsoZ(h.value)
                })),
                primaryFields:   [...data.eventTicket.primaryFields],
                secondaryFields: [...data.eventTicket.secondaryFields],
                auxiliaryFields: isStanding
                    ? [{ key:'standing', label:'STANDING', value: standingNumber }]
                    : [...data.eventTicket.auxiliaryFields]
            },
            barcode: {
                message:         data.barcode.message,
                altText:         data.barcode.altText,
                format:          data.barcode.format,
                messageEncoding: data.barcode.messageEncoding
            }
        };

        try {
            await updatePassData(serial, pd, idToken);
            alert('Pass updated!');
        } catch (err) {
            console.error(err);
            alert('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // 4b) Handle raw‐mode submit, including file replacements
    const handleRawSubmit = async () => {
        let pd;
        try {
            pd = JSON.parse(rawJson);
        } catch {
            return alert('Invalid JSON');
        }
        // build filesPayload
        const filesPayload = {};
        for (const [name, file] of Object.entries(rawFiles)) {
            filesPayload[name] = await fileToBase64(file);
        }

        setSaving(true);
        try {
            // pass filesPayload as third argument
            await updatePassData(serial, pd, idToken, filesPayload);
            alert('Raw JSON + assets saved!');
            setRawMode(false);
        } catch (err) {
            console.error(err);
            alert('Failed: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading || !data) return <p>Loading pass…</p>;

    return (
        <div style={{ padding: 20 }}>
            <h2>Edit Pass {serial}</h2>
            <div style={{ marginBottom: 16 }}>
                <button onClick={() => setRawMode(false)} disabled={!rawMode} style={{ marginRight: 8 }}>
                    Form Editor
                </button>
                <button onClick={() => setRawMode(true)} disabled={rawMode}>
                    Raw Editor
                </button>
            </div>

            <div style={{ display: 'flex', gap: 40 }}>
                <div style={{ flex: 1 }}>
                    {rawMode ? (
                        <div style={{ padding: 20 }}>
                            {/* 1) JSON editor → use rawJson, not fileContent */}
                            <h3>Edit pass.json</h3>
                            <Editor
                                height="400px"
                                defaultLanguage="json"
                                value={rawJson}
                                onChange={v => setRawJson(v || '')}
                                options={{
                                    minimap: { enabled: false },
                                    tabSize: 2,
                                    formatOnType: true,
                                    formatOnPaste: true
                                }}
                            />

                            {/* 2) Upload New File */}
                            <div style={{ marginTop: 24 }}>
                                <h3>Upload New File</h3>
                                <input
                                    type="file"
                                    onChange={e => setNewFile(e.target.files?.[0] || null)}
                                />
                                <button
                                    onClick={handleNewFileUpload}
                                    disabled={!newFile}
                                    style={{ marginLeft: 8 }}
                                >
                                    Upload
                                </button>
                            </div>

                            {/* 3) Existing Assets */}
                            <div style={{ marginTop: 24 }}>
                                <h3>Existing Assets</h3>
                                <ul style={{ listStyle: 'disc', paddingLeft: 20 }}>
                                    {assetList.map(name => (
                                        <li key={name}>
                                            <button
                                                onClick={() => selectFile(name)}
                                                style={{
                                                    background: name === selectedFile ? '#efefef' : 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '2px 4px'
                                                }}
                                            >
                                                {name}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* 4) Replace / Delete panel */}
                            {selectedFile && (
                                <div style={{ marginTop: 24, padding: 12, border: '1px solid #ccc' }}>
                                    <h4>Replace or Delete “{selectedFile}”</h4>

                                    {/* hidden file‑picker */}
                                    <input
                                        type="file"
                                        style={{ display: 'none' }}
                                        ref={fileInputRef}
                                        onChange={e => {
                                            const file = e.target.files?.[0]
                                            if (!file) return
                                            setFileBlob(file)
                                            handleUploadFile()
                                        }}
                                    />

                                    <button
                                        onClick={() => fileInputRef.current.click()}
                                        style={{ marginRight: 8 }}
                                    >
                                        Replace File
                                    </button>

                                    <button
                                        onClick={handleDeleteFile}
                                        style={{ color: 'red' }}
                                    >
                                        Delete File
                                    </button>
                                </div>
                            )}
                            <div style={{ marginTop: 24 }}>
                                <button
                                    onClick={handleRawSubmit}
                                    disabled={saving}
                                    style={{ padding: '8px 16px' }}
                                >
                                    {saving ? 'Updating…' : 'Save Raw'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleFormSubmit}>
                            {/* core fields */}
                            <Field label="Organization Name" path="organizationName" data={data} set={setData}/>
                            <Field label="Description"       path="description"       data={data} set={setData}/>
                            <Field label="Background Color"  type="color" path="backgroundColor" data={data} set={setData}/>
                            <Field label="Foreground Color"  type="color" path="foregroundColor" data={data} set={setData}/>
                            <Field label="Label Color"       type="color" path="labelColor"      data={data} set={setData}/>
                            <Field label="Logo Text"         path="logoText"         data={data} set={setData}/>
                            <Field label="Relevant Date"     type="datetime-local" path="relevantDate"    data={data} set={setData}/>

                            {/* header */}
                            <h3>Header Field</h3>
                            <Field label="Label"    path="eventTicket.headerFields.0.label"     data={data} set={setData}/>
                            <Field label="Value"    type="datetime-local" path="eventTicket.headerFields.0.value" data={data} set={setData}/>
                            <Field label="DateStyle" path="eventTicket.headerFields.0.dateStyle" data={data} set={setData}/>

                            {/* primary */}
                            <h3>Primary Field</h3>
                            <Field label="Label" path="eventTicket.primaryFields.0.label" data={data} set={setData}/>
                            <Field label="Value" path="eventTicket.primaryFields.0.value" data={data} set={setData}/>

                            {/* secondary */}
                            <h3>Secondary Fields</h3>
                            <Field label="Sec 1 Label"      path="eventTicket.secondaryFields.0.label"        data={data} set={setData}/>
                            <Field label="Sec 1 Value"      path="eventTicket.secondaryFields.0.value"        data={data} set={setData}/>
                            <Field label="Sec 2 Label"      path="eventTicket.secondaryFields.1.label"        data={data} set={setData}/>
                            <Field label="Sec 2 Value"      path="eventTicket.secondaryFields.1.value"        data={data} set={setData}/>
                            <Field label="Sec 2 Alignment"  path="eventTicket.secondaryFields.1.textAlignment" data={data} set={setData}/>

                            {/* auxiliary */}
                            <h3>Auxiliary Fields</h3>
                            <label style={{ display:'block', marginBottom:12, fontSize:13 }}>
                                <input
                                    type="checkbox"
                                    checked={isStanding}
                                    onChange={e => setIsStanding(e.target.checked)}
                                    style={{ marginRight:6 }}
                                />
                                Standing Ticket
                            </label>
                            {isStanding ? (
                                <Field
                                    label="Standing Number"
                                    path="eventTicket.auxiliaryFields.0.value"
                                    data={data}
                                    set={setData}
                                />
                            ) : (
                                <>
                                    <Field label="Block" path="eventTicket.auxiliaryFields.0.value" data={data} set={setData}/>
                                    <Field label="Row"   path="eventTicket.auxiliaryFields.1.value" data={data} set={setData}/>
                                    <Field label="Seat"  path="eventTicket.auxiliaryFields.2.value" data={data} set={setData}/>
                                </>
                            )}

                            {/* barcode */}
                            <h3>Barcode</h3>
                            <Field label="Message"          path="barcode.message"         data={data} set={setData}/>
                            <Field label="Alt Text"         path="barcode.altText"         data={data} set={setData}/>
                            <Field label="Format"           path="barcode.format"          data={data} set={setData}/>
                            <Field label="Message Encoding" path="barcode.messageEncoding" data={data} set={setData}/>

                            <button
                                type="submit"
                                disabled={saving}
                                style={{ marginTop:16, padding:'8px 16px' }}
                            >
                                {saving ? 'Saving…' : 'Save & Push'}
                            </button>
                        </form>
                    )}
                </div>

                <div style={{ minWidth: 300 }}>
                    <h3>Live Preview</h3>
                    <PassPreview data={previewData} />
                </div>
            </div>
        </div>
    );
}

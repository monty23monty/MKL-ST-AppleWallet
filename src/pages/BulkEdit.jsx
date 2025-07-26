// src/pages/BulkEdit.jsx
import React, { useEffect, useState } from 'react';
import { useAuth }                from 'react-oidc-context';
import {
    listPasses,
    getPassData,
    updatePassData,
    listTemplateFiles
} from '../api';

/** ── Helpers ─────────────────────────────────────────────────── */
const rgbToHex = rgb => {
    // expects "rgb(r,g,b)" or "rgb(r, g, b)"
    const [r, g, b] = rgb
        .replace(/[^0-9,]/g, '')
        .split(',')
        .map(Number);
    return (
        '#' +
        [r, g, b]
            .map(x => x.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
    );
};
const isoToLocal = z => {
    // "2025-07-26T14:00:00Z" → "2025-07-26T14:00"
    return new Date(z).toISOString().slice(0, 16);
};
/** ───────────────────────────────────────────────────────────── */

export default function BulkEdit() {
    const auth    = useAuth();
    const idToken = auth.user?.id_token;

    //── A) Passes & selection ─────────────────────────────────────
    const [passes, setPasses]               = useState([]);
    const [selected, setSelected]           = useState(new Set());
    const [loadingPasses, setLoadingPasses] = useState(false);
    const [searchQuery, setSearchQuery]     = useState('');

    //── B) Bulk‑edit fields ────────────────────────────────────────
    const [backgroundColor, setBackgroundColor] = useState('');
    const [foregroundColor, setForegroundColor] = useState('');
    const [labelColor, setLabelColor]           = useState('');
    const [logoText, setLogoText]               = useState('');
    const [relevantDate, setRelevantDate]       = useState('');
    const [hdrLabel, setHdrLabel]               = useState('');
    const [hdrValue, setHdrValue]               = useState('');
    const [sec1Label, setSec1Label]             = useState('');
    const [sec1Value, setSec1Value]             = useState('');
    const [filesToUpload, setFilesToUpload]     = useState({});

    //── C) Template assets + new‑image box ────────────────────────
    const [templateFiles, setTemplateFiles]       = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [newImageName, setNewImageName] = useState('');
    const [newImageFile, setNewImageFile] = useState(null);

    //── D) Busy state ─────────────────────────────────────────────
    const [saving, setSaving] = useState(false);

    // ── Load all passes ───────────────────────────────────────────
    useEffect(() => {
        if (!idToken) return;
        setLoadingPasses(true);
        listPasses(idToken)
            .then(setPasses)
            .catch(console.error)
            .finally(() => setLoadingPasses(false));
    }, [idToken]);

    // ── Load template file list ───────────────────────────────────
    useEffect(() => {
        if (!idToken) return;
        setLoadingTemplates(true);
        listTemplateFiles(idToken)
            .then(setTemplateFiles)
            .catch(console.error)
            .finally(() => setLoadingTemplates(false));
    }, [idToken]);

    // ── Pre‑fill override fields from first pass ──────────────────
    useEffect(() => {
        if (passes.length === 0) return;
        try {
            const first = passes[0];
            const pd = typeof first.passData === 'string'
                ? JSON.parse(first.passData)
                : first.passData;

            setBackgroundColor(rgbToHex(pd.backgroundColor));
            setForegroundColor(rgbToHex(pd.foregroundColor));
            setLabelColor(rgbToHex(pd.labelColor));
            setLogoText(pd.logoText || '');
            setRelevantDate(isoToLocal(pd.relevantDate));

            const hdr = pd.eventTicket.headerFields?.[0];
            if (hdr) {
                setHdrLabel(hdr.label || '');
                setHdrValue(isoToLocal(hdr.value));
            }

            const sec1 = pd.eventTicket.secondaryFields?.[0];
            if (sec1) {
                setSec1Label(sec1.label || '');
                setSec1Value(sec1.value || '');
            }
        } catch (err) {
            console.error('Failed to parse first passData:', err);
        }
    }, [passes]);

    // ── Filter passes by name ─────────────────────────────────────
    const filteredPasses = passes.filter(p => {
        const name = `${p.firstName||''} ${p.lastName||''}`.toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });

    // ── Toggle single selection ───────────────────────────────────
    function toggleSerial(serial) {
        const next = new Set(selected);
        next.has(serial) ? next.delete(serial) : next.add(serial);
        setSelected(next);
    }

    // ── Select/Clear all filtered ─────────────────────────────────
    function toggleSelectAll() {
        const allSelected = filteredPasses.every(p =>
            selected.has(p.serialNumber)
        );
        const next = new Set(selected);
        if (allSelected) {
            filteredPasses.forEach(p => next.delete(p.serialNumber));
        } else {
            filteredPasses.forEach(p => next.add(p.serialNumber));
        }
        setSelected(next);
    }

    // ── Convert File → base64 ─────────────────────────────────────
    const fileToBase64 = file =>
        new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload  = () => res(reader.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(file);
        });

    // ── Add brand‑new image to filesToUpload ──────────────────────
    function addNewImage() {
        if (!newImageName.trim() || !newImageFile) return;
        setFilesToUpload(fs => ({
            ...fs,
            [newImageName.trim()]: newImageFile
        }));
        setNewImageName('');
        setNewImageFile(null);
    }

    // ── Perform bulk update ───────────────────────────────────────
    async function handleBulkUpdate() {
        if (!idToken) return;
        if (selected.size === 0) {
            alert('Please select at least one pass');
            return;
        }
        setSaving(true);

        for (let serial of selected) {
            try {
                // fetch and merge
                const pd = await getPassData(serial, idToken);
                const merged = { ...(typeof pd === 'string' ? JSON.parse(pd) : pd) };

                if (backgroundColor) merged.backgroundColor = backgroundColor;
                if (foregroundColor) merged.foregroundColor = foregroundColor;
                if (labelColor)      merged.labelColor      = labelColor;
                if (logoText)        merged.logoText        = logoText;
                if (relevantDate)    merged.relevantDate    = new Date(relevantDate).toISOString();

                if (hdrLabel || hdrValue) {
                    merged.eventTicket.headerFields = [
                        {
                            ...merged.eventTicket.headerFields[0],
                            label: hdrLabel  || merged.eventTicket.headerFields[0].label,
                            value: hdrValue
                                ? new Date(hdrValue).toISOString()
                                : merged.eventTicket.headerFields[0].value
                        },
                        ...merged.eventTicket.headerFields.slice(1)
                    ];
                }

                if (sec1Label || sec1Value) {
                    merged.eventTicket.secondaryFields = [
                        {
                            ...merged.eventTicket.secondaryFields[0],
                            label: sec1Label || merged.eventTicket.secondaryFields[0].label,
                            value: sec1Value || merged.eventTicket.secondaryFields[0].value
                        },
                        ...merged.eventTicket.secondaryFields.slice(1)
                    ];
                }

                // file payload
                const filesPayload = {};
                for (let [name, file] of Object.entries(filesToUpload)) {
                    filesPayload[name] = await fileToBase64(file);
                }

                // call update
                await updatePassData(serial, merged, idToken, filesPayload);
            } catch (err) {
                console.error(`Error updating ${serial}`, err);
                alert(`Failed for ${serial}: ${err.message}`);
            }
        }

        setSaving(false);
        alert('Bulk update complete');
    }

    if (loadingPasses || loadingTemplates) {
        return <p>Loading…</p>;
    }

    return (
        <div style={{
            padding: 24,
            maxWidth: 1200,
            margin: '0 auto',
            fontFamily: 'sans-serif'
        }}>
            <h2 style={{ marginBottom: 24 }}>Bulk Edit Passes</h2>

            <div style={{ display: 'flex', gap: 32 }}>
                {/* A) Passes List */}
                <section style={{
                    flex: '1 1 300px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <h3 style={{ marginTop: 0 }}>Select Passes</h3>

                    <input
                        type="text"
                        placeholder="Search by name…"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{ marginBottom: 12, padding: 4, width: '100%' }}
                    />

                    <button
                        onClick={toggleSelectAll}
                        style={{ marginBottom: 12, padding: '4px 8px', fontSize: 14 }}
                    >
                        {filteredPasses.every(p => selected.has(p.serialNumber))
                            ? 'Clear All'
                            : 'Select All'}
                    </button>

                    <div style={{ flex: '1 1 auto', overflowY: 'auto' }}>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {filteredPasses.map(p => (
                                <li key={p.serialNumber} style={{ marginBottom: 4 }}>
                                    <label style={{ cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={selected.has(p.serialNumber)}
                                            onChange={() => toggleSerial(p.serialNumber)}
                                            style={{ marginRight: 8 }}
                                        />
                                        {p.firstName} {p.lastName}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* B) Override Fields */}
                <section style={{
                    flex: '2 1 600px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    padding: 16
                }}>
                    <h3 style={{ marginTop: 0 }}>Override Fields</h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 16
                    }}>
                        <label>
                            Background Color<br/>
                            <input
                                type="color"
                                value={backgroundColor}
                                onChange={e => setBackgroundColor(e.target.value)}
                            />
                        </label>
                        <label>
                            Foreground Color<br/>
                            <input
                                type="color"
                                value={foregroundColor}
                                onChange={e => setForegroundColor(e.target.value)}
                            />
                        </label>
                        <label>
                            Label Color<br/>
                            <input
                                type="color"
                                value={labelColor}
                                onChange={e => setLabelColor(e.target.value)}
                            />
                        </label>
                        <label>
                            Logo Text<br/>
                            <input
                                type="text"
                                value={logoText}
                                onChange={e => setLogoText(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </label>
                        <label>
                            Relevant Date<br/>
                            <input
                                type="datetime-local"
                                value={relevantDate}
                                onChange={e => setRelevantDate(e.target.value)}
                            />
                        </label>
                        <label>
                            Header Label<br/>
                            <input
                                type="text"
                                value={hdrLabel}
                                onChange={e => setHdrLabel(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </label>
                        <label>
                            Header Value<br/>
                            <input
                                type="datetime-local"
                                value={hdrValue}
                                onChange={e => setHdrValue(e.target.value)}
                            />
                        </label>
                        <label>
                            Sec #1 Label<br/>
                            <input
                                type="text"
                                value={sec1Label}
                                onChange={e => setSec1Label(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </label>
                        <label>
                            Sec #1 Value<br/>
                            <input
                                type="text"
                                value={sec1Value}
                                onChange={e => setSec1Value(e.target.value)}
                                style={{ width: '100%' }}
                            />
                        </label>
                    </div>
                </section>
            </div>

            {/* C) Image Overrides */}
            <section style={{
                marginTop: 32,
                border: '1px solid #ddd',
                borderRadius: 8,
                padding: 16
            }}>
                <h3 style={{ marginTop: 0 }}>Override Images</h3>

                {/* Upload New Image */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: 24,
                    gap: 12
                }}>
                    <input
                        type="text"
                        placeholder="Filename (e.g. icon.png)"
                        value={newImageName}
                        onChange={e => setNewImageName(e.target.value)}
                        style={{ flex: '1 1 auto', padding: '4px 8px' }}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        onChange={e => setNewImageFile(e.target.files?.[0] || null)}
                    />
                    <button
                        onClick={addNewImage}
                        disabled={!newImageName.trim() || !newImageFile}
                        style={{ padding: '6px 12px', cursor: 'pointer' }}
                    >
                        Add
                    </button>
                </div>

                {/* Template Overrides + New */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 16
                }}>
                    {templateFiles.map(name => (
                        <div key={name}>
                            <label style={{ display: 'block', marginBottom: 4 }}>{name}</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={e =>
                                    setFilesToUpload(fs => ({
                                        ...fs,
                                        [name]: e.target.files?.[0]
                                    }))
                                }
                            />
                        </div>
                    ))}

                    {Object.entries(filesToUpload)
                        .filter(([name]) => !templateFiles.includes(name))
                        .map(([name, file]) => (
                            <div key={name} style={{ fontSize: 14, color: '#555' }}>
                                <strong>{name}</strong><br/>
                                {file.name}
                            </div>
                        ))
                    }
                </div>
            </section>

            {/* D) Apply Button */}
            <div style={{ marginTop: 32, textAlign: 'right' }}>
                <button
                    onClick={handleBulkUpdate}
                    disabled={saving}
                    style={{
                        padding: '10px 24px',
                        fontSize: 16,
                        borderRadius: 4,
                        background: '#007bff',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer'
                    }}
                >
                    {saving ? 'Updating…' : 'Apply to Selected'}
                </button>
            </div>
        </div>
    );
}

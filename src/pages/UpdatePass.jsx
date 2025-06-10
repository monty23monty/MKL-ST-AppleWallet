import { useEffect, useState } from 'react';
import { listPasses, getPassData, updatePassData, resendPass } from '../api';

function Field({ label, type = 'text', path, data, set }) {
    const value = path.split('.').reduce((o, k) => {
        if (o == null) return '';
        return Array.isArray(o) ? o[Number(k)] : o[k];
    }, data) || '';

    const onChange = e => {
        const clone = structuredClone(data);
        const segs = path.split('.');
        let cur = clone;
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

function rgbToHex(rgb) {
    const [r, g, b] = rgb.replace(/[^0-9,]/g, '').split(',').map(Number);
    return (
        '#' +
        [r, g, b]
            .map(x => x.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase()
    );
}

function hexToRgb(h) {
    const [r, g, b] = h
        .slice(1)
        .match(/.{2}/g)
        .map(x => parseInt(x, 16));
    return `rgb(${r},${g},${b})`;
}

function isoToLocal(z) {
    return new Date(z).toISOString().slice(0, 16);
}

function toIsoZ(local) {
    return new Date(local).toISOString();
}

export default function UpdatePass() {
    const [passes, setPasses] = useState([]);
    const [selected, setSelected] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setLoading(true);
        listPasses()
            .then(setPasses)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (!selected) {
            setData(null);
            return;
        }
        setLoading(true);
        getPassData(selected)
            .then(pd => {
                const transformed = {
                    ...pd,
                    backgroundColor: rgbToHex(pd.backgroundColor),
                    foregroundColor: rgbToHex(pd.foregroundColor),
                    labelColor: rgbToHex(pd.labelColor),
                    relevantDate: isoToLocal(pd.relevantDate),
                    eventTicket: {
                        ...pd.eventTicket,
                        headerFields: pd.eventTicket.headerFields.map(h => ({
                            ...h,
                            value: isoToLocal(h.value),
                        })),
                    },
                };
                setData(transformed);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selected]);

    const handleSubmit = async e => {
        e.preventDefault();
        setSaving(true);
        try {
            const pd = {
                ...data,
                backgroundColor: hexToRgb(data.backgroundColor),
                foregroundColor: hexToRgb(data.foregroundColor),
                labelColor: hexToRgb(data.labelColor),
                relevantDate: toIsoZ(data.relevantDate),
                eventTicket: {
                    ...data.eventTicket,
                    headerFields: data.eventTicket.headerFields.map(h => ({
                        ...h,
                        value: toIsoZ(h.value),
                    })),
                },
            };
            await updatePassData(selected, pd);
            await resendPass(selected);
            alert('Pass updated and pushed!');
        } catch (err) {
            console.error(err);
            alert('Failed to update: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading…</p>;

    return (
        <div>
            <h2>Update a Pass</h2>
            <label>
                Choose pass:
                <select
                    value={selected}
                    onChange={e => setSelected(e.target.value)}
                    style={{ marginLeft: 8 }}
                >
                    <option value="">— select —</option>
                    {passes.map(p => (
                        <option key={p.serialNumber} value={p.serialNumber}>
                            {p.email} | {p.serialNumber}
                        </option>
                    ))}
                </select>
            </label>

            {data && (
                <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
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
                        path="backgroundColor"
                        type="color"
                        data={data}
                        set={setData}
                    />
                    <Field
                        label="Foreground Color"
                        path="foregroundColor"
                        type="color"
                        data={data}
                        set={setData}
                    />
                    <Field
                        label="Label Color"
                        path="labelColor"
                        type="color"
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
                        path="relevantDate"
                        type="datetime-local"
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
                        path="eventTicket.headerFields.0.value"
                        type="datetime-local"
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
                        label="Sec 1 Label"
                        path="eventTicket.secondaryFields.0.label"
                        data={data}
                        set={setData}
                    />
                    <Field
                        label="Sec 1 Value"
                        path="eventTicket.secondaryFields.0.value"
                        data={data}
                        set={setData}
                    />
                    <Field
                        label="Sec 2 Label"
                        path="eventTicket.secondaryFields.1.label"
                        data={data}
                        set={setData}
                    />
                    <Field
                        label="Sec 2 Value"
                        path="eventTicket.secondaryFields.1.value"
                        data={data}
                        set={setData}
                    />
                    <Field
                        label="Sec 2 Alignment"
                        path="eventTicket.secondaryFields.1.textAlignment"
                        data={data}
                        set={setData}
                    />

                    <h3>Auxiliary Fields</h3>
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
    );
}

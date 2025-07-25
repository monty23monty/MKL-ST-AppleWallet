import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth }   from 'react-oidc-context';
import { getPassData, updatePassData } from '../api';
import Field        from '../components/Field.jsx';
import PassPreview  from '../components/PassPreview.jsx';

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

export default function PassEdit() {
    const { serial } = useParams();
    const auth       = useAuth();
    const idToken    = auth.user?.id_token;

    const [data,       setData]       = useState(null);
    const [loading,    setLoading]    = useState(false);
    const [saving,     setSaving]     = useState(false);
    const [isStanding, setIsStanding] = useState(false);
    const [standingNumber, setStandingNumber] = useState('');

    useEffect(() => {
        if (!serial || !idToken) return;
        setLoading(true);
        getPassData(serial, idToken)
            .then(pd => {
                // FULL normalization of every field
                const normalized = {
                    ...pd,
                    backgroundColor: rgbToHex(pd.backgroundColor),
                    foregroundColor: rgbToHex(pd.foregroundColor),
                    labelColor:      rgbToHex(pd.labelColor),
                    logoText:        pd.logoText || '',
                    relevantDate:    isoToLocal(pd.relevantDate),
                    eventTicket: {
                        // keep any other keys on eventTicket
                        ...pd.eventTicket,
                        headerFields: pd.eventTicket.headerFields.map(h => ({
                            ...h,
                            value: isoToLocal(h.value)
                        })),
                        primaryFields: pd.eventTicket.primaryFields.map(pf => ({ ...pf })),
                        secondaryFields: pd.eventTicket.secondaryFields.map(sf => ({ ...sf })),
                        auxiliaryFields: pd.eventTicket.auxiliaryFields.map(af => ({ ...af }))
                    },
                    barcode: {
                        message: pd.barcode?.message || '',
                        altText: pd.barcode?.altText  || ''
                    }
                };

                setData(normalized);

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

    const previewData = useMemo(() => {
        if (!data) return null;
        const clone = structuredClone(data);
        if (isStanding) {
            clone.eventTicket.auxiliaryFields = [
                { key: 'standing', label: 'STANDING', value: standingNumber }
            ];
        }
        return clone;
    }, [data, isStanding, standingNumber]);

    const handleSubmit = async e => {
        e.preventDefault();
        if (!serial || !idToken) return;
        setSaving(true);

        // build the payload back to raw values
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
                    ...h,
                    value: toIsoZ(h.value)
                })),
                primaryFields: [...data.eventTicket.primaryFields],
                secondaryFields: [...data.eventTicket.secondaryFields],
                auxiliaryFields: isStanding
                    ? [{ key:'standing', label:'STANDING', value: standingNumber }]
                    : [...data.eventTicket.auxiliaryFields]
            },
            barcode: {
                message: data.barcode.message,
                altText: data.barcode.altText
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

    if (loading || !data) return <p>Loading pass…</p>;

    return (
        <div style={{ display: 'flex', gap: 40, padding: 20 }}>
            <form onSubmit={handleSubmit} style={{ flex: 1 }}>
                <h2>Edit Pass {serial}</h2>

                {/* core fields */}
                <Field label="Organization Name" path="organizationName" data={data} set={setData} />
                <Field label="Description"       path="description"       data={data} set={setData} />
                <Field label="Background Color"  type="color" path="backgroundColor" data={data} set={setData} />
                <Field label="Foreground Color"  type="color" path="foregroundColor" data={data} set={setData} />
                <Field label="Label Color"       type="color" path="labelColor"      data={data} set={setData} />
                <Field label="Logo Text"         path="logoText"         data={data} set={setData} />
                <Field label="Relevant Date"     type="datetime-local" path="relevantDate"    data={data} set={setData} />

                {/* header */}
                <h3>Header Field</h3>
                <Field label="Label"    path="eventTicket.headerFields.0.label"     data={data} set={setData} />
                <Field label="Value"    type="datetime-local" path="eventTicket.headerFields.0.value" data={data} set={setData} />
                <Field label="DateStyle" path="eventTicket.headerFields.0.dateStyle" data={data} set={setData} />

                {/* primary */}
                <h3>Primary Field</h3>
                <Field label="Label" path="eventTicket.primaryFields.0.label" data={data} set={setData} />
                <Field label="Value" path="eventTicket.primaryFields.0.value" data={data} set={setData} />

                {/* secondary */}
                <h3>Secondary Fields</h3>
                <Field label="Sec 1 Label"      path="eventTicket.secondaryFields.0.label"        data={data} set={setData} />
                <Field label="Sec 1 Value"      path="eventTicket.secondaryFields.0.value"        data={data} set={setData} />
                <Field label="Sec 2 Label"      path="eventTicket.secondaryFields.1.label"        data={data} set={setData} />
                <Field label="Sec 2 Value"      path="eventTicket.secondaryFields.1.value"        data={data} set={setData} />
                <Field label="Sec 2 Alignment"  path="eventTicket.secondaryFields.1.textAlignment" data={data} set={setData} />

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
                        <Field label="Block" path="eventTicket.auxiliaryFields.0.value" data={data} set={setData} />
                        <Field label="Row"   path="eventTicket.auxiliaryFields.1.value" data={data} set={setData} />
                        <Field label="Seat"  path="eventTicket.auxiliaryFields.2.value" data={data} set={setData} />
                    </>
                )}

                {/* barcode */}
                <h3>Barcode</h3>
                <Field label="Message" path="barcode.message" data={data} set={setData} />
                <Field label="Alt Text" path="barcode.altText" data={data} set={setData} />

                <button
                    type="submit"
                    disabled={saving}
                    style={{ marginTop:16, padding:'8px 16px' }}
                >
                    {saving ? 'Saving…' : 'Save & Push'}
                </button>
            </form>

            <div style={{ minWidth: 300 }}>
                <h3>Live Preview</h3>
                <PassPreview data={previewData} />
            </div>
        </div>
    );
}

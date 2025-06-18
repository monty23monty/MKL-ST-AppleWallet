import {useEffect, useState} from 'react';
import {getPassData, listPasses, updatePassData} from '../api';
import {useNavigate, useParams} from 'react-router-dom';
import HoverCard from "../components/HoverCard.jsx";
import PassPreview from "../components/PassPreview.jsx";

const PREVIEW_MARGIN = 3;   // gap between cursor and preview
const PREVIEW_WIDTH = 260;  // real width of <PassPreview>
const PREVIEW_HEIGHT = 160;  // real height of <PassPreview>

function Field({label, type = 'text', path, data, set}) {
    const value = path.split('.').reduce((o, k) => {
        if (o == null) return '';
        return Array.isArray(o) ? o[Number(k)] : o[k];
    }, data) ?? '';

    const onChange = e => {
        const clone = structuredClone(data);
        const segs = path.split('.');
        let cur = clone;
        while (segs.length > 1) cur = cur[segs.shift()];
        cur[segs[0]] = e.target.value;
        set(clone);
    };

    return (
        <div style={{marginBottom: 12}}>
            <label style={{display: 'block', fontSize: 12, marginBottom: 4}}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={onChange}
                style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
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
    const date = new Date(local);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    const second = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
}

export default function UpdatePass() {
    const {serial} = useParams();
    const navigate = useNavigate();

    const [passes, setPasses] = useState([]);
    const [selected, setSelected] = useState(serial || '');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [sortKey, setSortKey] = useState('firstName');
    const [sortDir, setSortDir] = useState('asc');
    const [preview, setPreview] = useState(null); // {data,x,y,fade}
    const [hoverTimer, setHoverTimer] = useState(null);

    const [searchName, setSearchName] = useState('');
    const [searchBlock, setSearchBlock] = useState('');
    const [searchRow, setSearchRow] = useState('');
    const [searchSeat, setSearchSeat] = useState('');


    useEffect(() => {
        setSelected(serial || '');
    }, [serial]);

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
            alert('Pass updated and pushed!');
        } catch (err) {
            console.error(err);
            alert('Failed to update: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading…</p>;

    const filtered = passes
        .filter(p => {
            const pd = JSON.parse(p.passData || '{}');
            const name = `${pd.firstName || ''} ${pd.lastName || ''}`.toLowerCase();
            const block = (pd.eventTicket?.auxiliaryFields?.[0]?.value || '')
                .toString().toLowerCase();
            const row = (pd.eventTicket?.auxiliaryFields?.[1]?.value || '')
                .toString().toLowerCase();
            const seat = (pd.eventTicket?.auxiliaryFields?.[2]?.value || '')
                .toString().toLowerCase();

            return name.includes(searchName.toLowerCase()) &&
                block.includes(searchBlock.toLowerCase()) &&
                row.includes(searchRow.toLowerCase()) &&
                seat.includes(searchSeat.toLowerCase());
        })
        .sort((a, b) => {
            const pa = JSON.parse(a.passData || '{}');
            const pb = JSON.parse(b.passData || '{}');
            const va = (pa[sortKey] || '').toString().toLowerCase();
            const vb = (pb[sortKey] || '').toString().toLowerCase();
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

    const startHover = (pass, event) => {
        clearTimeout(hoverTimer);

        const {clientX, clientY} = event;
        const placeLeft =
            clientX + PREVIEW_MARGIN + PREVIEW_WIDTH > window.innerWidth;

        const x = placeLeft
            ? clientX - PREVIEW_MARGIN - PREVIEW_WIDTH
            : clientX + PREVIEW_MARGIN;

        const y = Math.min(
            clientY,
            window.innerHeight - PREVIEW_HEIGHT - PREVIEW_MARGIN
        );

        const timer = setTimeout(() => {
            /* 1️⃣  mount hidden card … */
            setPreview({
                data: JSON.parse(pass.passData || '{}'),
                x, y,
                show: false
            });

            /* 2️⃣  … next frame → toggle visible (triggers fade-in) */
            requestAnimationFrame(() =>
                setPreview(p => p && {...p, show: true})
            );
        }, 300);

        setHoverTimer(timer);
    };

    const stopHover = () => {
        clearTimeout(hoverTimer);
        setPreview(p => p && {...p, show: false});
    };

    if (!selected) {
        return (
            <div style={{position: 'relative'}}>
                <h2>Update a Pass</h2>

                <div style={{display: 'flex', gap: 8, marginBottom: 8}}>
                    <input
                        type="text" placeholder="Name"
                        value={searchName} onChange={e => setSearchName(e.target.value)}
                        style={{flex: 2, padding: 6}}
                    />
                    <input
                        type="text" placeholder="Block"
                        value={searchBlock} onChange={e => setSearchBlock(e.target.value)}
                        style={{flex: 1, padding: 6}}
                    />
                    <input
                        type="text" placeholder="Row"
                        value={searchRow} onChange={e => setSearchRow(e.target.value)}
                        style={{width: 60, padding: 6}}
                    />
                    <input
                        type="text" placeholder="Seat"
                        value={searchSeat} onChange={e => setSearchSeat(e.target.value)}
                        style={{width: 60, padding: 6}}
                    />
                </div>

                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                    <tr>
                        {['First Name', 'Last Name', 'Email',
                            'Block', 'Row', 'Seat', 'Type'].map(k => (
                            <th
                                key={k}
                                style={{
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #ccc',
                                    textAlign: 'left'
                                }}
                                onClick={() => {
                                    if (sortKey === k) {
                                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortKey(k);
                                        setSortDir('asc');
                                    }
                                }}
                            >
                                {k}
                            </th>
                        ))}
                        <th/>
                    </tr>
                    </thead>

                    <tbody>
                    {filtered.map(p => {
                        const pd = JSON.parse(p.passData || '{}');
                        return (
                            <tr
                                key={p.serialNumber}
                                onMouseEnter={e => startHover(p, e)}
                                onMouseLeave={stopHover}
                                style={{borderBottom: '1px solid #eee'}}
                            >
                                <td>{pd.firstName}</td>
                                <td>{pd.lastName}</td>
                                <td>{p.email}</td>
                                <td>{pd.eventTicket?.auxiliaryFields?.[0]?.value}</td>
                                <td>{pd.eventTicket?.auxiliaryFields?.[1]?.value}</td>
                                <td>{pd.eventTicket?.auxiliaryFields?.[2]?.value}</td>
                                <td>{pd.eventTicket?.secondaryFields?.[1]?.value}</td>
                                <td>
                                    <button
                                        onClick={() =>
                                            navigate(`/update-pass/${p.serialNumber}`)
                                        }
                                    >
                                        Edit
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>

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

    return (
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 40}}>
            <div style={{flex: 1}}>
                <div>
                    <h2>Update a Pass</h2>

                    {data && (
                        <form onSubmit={handleSubmit} style={{marginTop: 20}}>
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
                                style={{marginTop: 16, padding: '8px 16px', width: '100%'}}
                            >
                                {saving ? 'Saving…' : 'Save & Push'}
                            </button>
                        </form>
                    )}
                </div>

            </div>
            <PassPreview data={data}/>
        </div>
    );
}

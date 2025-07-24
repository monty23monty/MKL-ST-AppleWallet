import {useEffect, useMemo, useState} from 'react'; // already in React ≥18, but add if missing
import {getPassData, listPasses, updatePassData} from '../api';
import {useNavigate, useParams} from 'react-router-dom';
import HoverCard from '../components/HoverCard.jsx';
import PassPreview from '../components/PassPreview.jsx';
import { useAuth } from 'react-oidc-context';


/* ───── hover-card constants ─────────────────────────────────── */
const PREVIEW_MARGIN = 3;
const PREVIEW_WIDTH = 260;
const PREVIEW_HEIGHT = 160;

/* ─────────────────────────────────────────────────────────────── */

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

/* ───── helpers ──────────────────────────────────────────────── */
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
const isoToLocal = z => new Date(z).toISOString().slice(0, 16);
const toIsoZ = local => new Date(local).toISOString();
/* ─────────────────────────────────────────────────────────────── */

export default function UpdatePass() {
    const auth = useAuth();
    const accessToken = auth.user?.access_token;
    const {serial} = useParams();
    const navigate = useNavigate();

    const [passes, setPasses] = useState([]);
    const [selected, setSelected] = useState(serial || '');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    /* search boxes */
    const [searchName, setSearchName] = useState('');
    const [searchBlock, setSearchBlock] = useState('');
    const [searchRow, setSearchRow] = useState('');
    const [searchSeat, setSearchSeat] = useState('');

    const [sortKey, setSortKey] = useState('firstName');
    const [sortDir, setSortDir] = useState('asc');

    /* hover preview */
    const [preview, setPreview] = useState(null);
    const [hoverTimer, setHoverTimer] = useState(null);

    /* standing toggle state */
    const [isStanding, setIsStanding] = useState(false);
    const [standingNumber, setStandingNumber] = useState('');


    /* ───── load list once ───────────────────────────────────────── */
    useEffect(() => {
        setLoading(true);
        if (!accessToken) return;
        listPasses(accessToken)
            .then(setPasses)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [accessToken]);

    /* ───── respond to URL change ────────────────────────────────── */
    useEffect(() => {
        setSelected(serial || '');
    }, [serial]);

    /* ───── fetch selected pass ─────────────────────────────────── */
    useEffect(() => {
        if (!selected) {
            setData(null);
            return;
        }
        setLoading(true);
        if (!accessToken) return;
        getPassData(selected, accessToken)
            .then(pd => {
                setData({
                    ...pd,
                    backgroundColor: rgbToHex(pd.backgroundColor),
                    foregroundColor: rgbToHex(pd.foregroundColor),
                    labelColor: rgbToHex(pd.labelColor),
                    relevantDate: isoToLocal(pd.relevantDate),
                    eventTicket: {
                        ...pd.eventTicket,
                        headerFields: pd.eventTicket.headerFields.map(h => ({
                            ...h, value: isoToLocal(h.value)
                        }))
                    }
                });

                /* detect standing */
                const aux = pd.eventTicket?.auxiliaryFields || [];
                const s = aux.find(a =>
                    (a.label || '').toUpperCase() === 'STANDING' || a.key === 'standing'
                );
                if (s) {
                    setIsStanding(true);
                    setStandingNumber(s.value || '');
                } else {
                    setIsStanding(false);
                    setStandingNumber('');
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selected, accessToken]);

    /* ───── hover helpers (unchanged) ───────────────────────────── */
    const startHover = (pass, evt) => {
        clearTimeout(hoverTimer);
        const {clientX, clientY} = evt;
        const left = clientX + PREVIEW_MARGIN + PREVIEW_WIDTH > window.innerWidth;
        const x = left
            ? clientX - PREVIEW_MARGIN - PREVIEW_WIDTH
            : clientX + PREVIEW_MARGIN;
        const y = Math.min(
            clientY,
            window.innerHeight - PREVIEW_HEIGHT - PREVIEW_MARGIN
        );

        const t = setTimeout(() => {
            setPreview({data: JSON.parse(pass.passData || '{}'), x, y, show: false});
            requestAnimationFrame(() =>
                setPreview(p => p && {...p, show: true})
            );
        }, 1000);
        setHoverTimer(t);
    };
    const stopHover = () => {
        clearTimeout(hoverTimer);
        setPreview(p => p && {...p, show: false});
    };

    /* live version of data for the preview */
    const previewData = useMemo(() => {
        if (!data) return null;

        const clone = structuredClone(data);

        if (isStanding) {
            clone.eventTicket.auxiliaryFields = [
                {key: 'standing', label: 'STANDING', value: standingNumber}
            ];
        }
        // seated: just use whatever is in clone already
        return clone;
    }, [data, isStanding, standingNumber]);


    /* ───── save handler ────────────────────────────────────────── */
    const handleSubmit = async e => {
        e.preventDefault();
        setSaving(true);

        const pd = {
            ...data,
            backgroundColor: hexToRgb(data.backgroundColor),
            foregroundColor: hexToRgb(data.foregroundColor),
            labelColor: hexToRgb(data.labelColor),
            relevantDate: toIsoZ(data.relevantDate),
            eventTicket: {
                ...data.eventTicket,
                headerFields: data.eventTicket.headerFields.map(h => ({
                    ...h, value: toIsoZ(h.value)
                })),
                auxiliaryFields: isStanding
                    ? [
                        {key: 'standing', label: 'STANDING', value: standingNumber}
                    ]
                    : data.eventTicket.auxiliaryFields
            }
        };

        try {
            await updatePassData(selected, pd, accessToken);
            alert('Pass updated and pushed!');
        } catch (err) {
            console.error(err);
            alert('Failed to update: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading…</p>;

    /* ───── filtered list (unchanged) ───────────────────────────── */
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
            const pa = JSON.parse(a.passData || '{}'), pb = JSON.parse(b.passData || '{}');
            const va = (pa[sortKey] || '').toString().toLowerCase();
            const vb = (pb[sortKey] || '').toString().toLowerCase();
            if (va < vb) return sortDir === 'asc' ? -1 : 1;
            if (va > vb) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });

    /* ───── LIST SCREEN ─────────────────────────────────────────── */
    if (!selected) {
        return (
            <div style={{position: 'relative'}}>
                <h2>Update a Pass</h2>

                <div style={{display: 'flex', gap: 8, marginBottom: 8}}>
                    <input type="text" placeholder="Name"
                           value={searchName} onChange={e => setSearchName(e.target.value)}
                           style={{flex: 2, padding: 6}}/>
                    <input type="text" placeholder="Block"
                           value={searchBlock} onChange={e => setSearchBlock(e.target.value)}
                           style={{flex: 1, padding: 6}}/>
                    <input type="text" placeholder="Row"
                           value={searchRow} onChange={e => setSearchRow(e.target.value)}
                           style={{width: 60, padding: 6}}/>
                    <input type="text" placeholder="Seat"
                           value={searchSeat} onChange={e => setSearchSeat(e.target.value)}
                           style={{width: 60, padding: 6}}/>
                </div>

                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                    <thead>
                    <tr>
                        {['First Name', 'Last Name', 'Email',
                            'Block', 'Row', 'Seat', 'Type'].map(k => (
                            <th key={k}
                                style={{
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #ccc',
                                    textAlign: 'left'
                                }}
                                onClick={() => {
                                    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                    else {
                                        setSortKey(k);
                                        setSortDir('asc');
                                    }
                                }}>
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
                            <tr key={p.serialNumber}
                                onMouseEnter={e => startHover(p, e)}
                                onMouseLeave={stopHover}
                                style={{borderBottom: '1px solid #eee'}}>
                                <td>{pd.firstName}</td>
                                <td>{pd.lastName}</td>
                                <td>{p.email}</td>
                                <td>{pd.eventTicket?.auxiliaryFields?.[0]?.value}</td>
                                <td>{pd.eventTicket?.auxiliaryFields?.[1]?.value}</td>
                                <td>{pd.eventTicket?.auxiliaryFields?.[2]?.value}</td>
                                <td>{pd.eventTicket?.secondaryFields?.[1]?.value}</td>
                                <td>
                                    <button onClick={() => navigate(`/update-pass/${p.serialNumber}`)}>
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

    /* ───── EDIT SCREEN ─────────────────────────────────────────── */
    return (
        <div style={{display: 'flex', alignItems: 'flex-start', gap: 40}}>
            <div style={{flex: 1}}>
                <h2>Update a Pass</h2>

                {data && (
                    <form onSubmit={handleSubmit} style={{marginTop: 20}}>
                        {/* core fields */}
                        <Field label="Organization Name" path="organizationName"
                               data={data} set={setData}/>
                        <Field label="Description" path="description"
                               data={data} set={setData}/>
                        <Field label="Background Color" type="color"
                               path="backgroundColor" data={data} set={setData}/>
                        <Field label="Foreground Color" type="color"
                               path="foregroundColor" data={data} set={setData}/>
                        <Field label="Label Color" type="color"
                               path="labelColor" data={data} set={setData}/>
                        <Field label="Logo Text" path="logoText"
                               data={data} set={setData}/>
                        <Field label="Relevant Date & Time" type="datetime-local"
                               path="relevantDate" data={data} set={setData}/>

                        {/* header / primary / secondary sections – keep unchanged */}
                        <h3>Header Field</h3>
                        <Field label="Header Label"
                               path="eventTicket.headerFields.0.label"
                               data={data} set={setData}/>
                        <Field label="Header Value" type="datetime-local"
                               path="eventTicket.headerFields.0.value"
                               data={data} set={setData}/>
                        <Field label="Header DateStyle"
                               path="eventTicket.headerFields.0.dateStyle"
                               data={data} set={setData}/>

                        <h3>Primary Field</h3>
                        <Field label="Primary Label"
                               path="eventTicket.primaryFields.0.label"
                               data={data} set={setData}/>
                        <Field label="Primary Value"
                               path="eventTicket.primaryFields.0.value"
                               data={data} set={setData}/>

                        <h3>Secondary Fields</h3>
                        <Field label="Sec 1 Label"
                               path="eventTicket.secondaryFields.0.label"
                               data={data} set={setData}/>
                        <Field label="Sec 1 Value"
                               path="eventTicket.secondaryFields.0.value"
                               data={data} set={setData}/>
                        <Field label="Sec 2 Label"
                               path="eventTicket.secondaryFields.1.label"
                               data={data} set={setData}/>
                        <Field label="Sec 2 Value"
                               path="eventTicket.secondaryFields.1.value"
                               data={data} set={setData}/>
                        <Field label="Sec 2 Alignment"
                               path="eventTicket.secondaryFields.1.textAlignment"
                               data={data} set={setData}/>

                        {/* standing or seated */}
                        <h3>Auxiliary Fields</h3>
                        <div style={{marginBottom: 16}}>
                            <label style={{fontSize: 13}}>
                                <input
                                    type="checkbox"
                                    checked={isStanding}
                                    onChange={e => setIsStanding(e.target.checked)}
                                    style={{marginRight: 6}}
                                />
                                Standing Ticket
                            </label>
                        </div>

                        {isStanding ? (
                            <div style={{marginBottom: 12}}>
                                <label style={{display: 'block', fontSize: 12, marginBottom: 4}}>
                                    STANDING
                                </label>
                                <input
                                    type="text"
                                    value={standingNumber}
                                    onChange={e => setStandingNumber(e.target.value)}
                                    style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
                                    required
                                />
                            </div>
                        ) : (
                            <>
                                <Field label="Block"
                                       path="eventTicket.auxiliaryFields.0.value"
                                       data={data} set={setData}/>
                                <Field label="Row"
                                       path="eventTicket.auxiliaryFields.1.value"
                                       data={data} set={setData}/>
                                <Field label="Seat"
                                       path="eventTicket.auxiliaryFields.2.value"
                                       data={data} set={setData}/>
                            </>
                        )}

                        <h3>Barcode</h3>
                        <Field label="Barcode Message"
                               path="barcode.message" data={data} set={setData}/>
                        <Field label="Barcode AltText"
                               path="barcode.altText" data={data} set={setData}/>

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

            <PassPreview data={previewData}/>
        </div>
    );
}

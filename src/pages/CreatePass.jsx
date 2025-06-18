import React, {useState} from 'react'
import {createPass} from '../api'

const init = {
    organizationName: "Milton Keynes Lightning",
    description: "2025 / 26 Season Ticket",
    backgroundColor: "#D8BD5A",
    foregroundColor: "#000000",
    labelColor: "#000000",
    logoText: "MKL Season Ticket",
    relevantDate: "2025-05-23T13:00",
    eventTicket: {
        headerFields: [{
            key: "nextGame", label: "NEXT GAME",
            value: "2025-10-10T19:00", dateStyle: "PKDateStyleShort"
        }],
        primaryFields: [{key: "ticket", label: "2025/26", value: "Adult Season Ticket"}],
        secondaryFields: [
            {key: "opponent", label: "OPPONENT", value: "Leeds Knights"},
            {
                key: "ticketType", label: "TICKET TYPE", value: "Child",
                textAlignment: "PKTextAlignmentRight"
            }
        ],
        auxiliaryFields: [
            {key: "block", label: "BLOCK", value: "13"},
            {key: "row", label: "ROW", value: "B"},
            {key: "seat", label: "SEAT", value: "5"}
        ]
    },
    barcode: {
        format: "PKBarcodeFormatQR",
        message: "LTN-ABCD-1357",
        messageEncoding: "iso-8859-1",
        altText: "Ticket 1357"
    }
}

function Field({label, type = "text", path, data, set}) {
    const value = path.split('.').reduce((o, k) => {
        if (o == null) return ''
        return Array.isArray(o) ? o[Number(k)] : o[k]
    }, data) || ''

    const onChange = e => {
        const clone = structuredClone(data)
        const segs = path.split('.')
        let cur = clone
        while (segs.length > 1) cur = cur[segs.shift()]
        cur[segs[0]] = e.target.value
        set(clone)
    }

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
    )
}

export default function CreatePass() {
    const [email, setEmail] = useState('')
    const [data, setData] = useState(init)
    const [status, setStatus] = useState('idle')
    const [isStanding, setIsStanding] = useState(false);
    const [standingNumber, setStandingNumber] = useState('');

    function hexToRgb(h) {
        const [r, g, b] = h.slice(1).match(/.{2}/g).map(x => parseInt(x, 16));
        return `rgb(${r},${g},${b})`;
    }

    function toIsoZ(datetimeLocal) {
        // e.g. "2025-05-23T13:00"
        return new Date(datetimeLocal).toISOString(); // gives "2025-05-23T13:00:00.000Z"
    }

    const submit = async e => {
        e.preventDefault();
        setStatus('working');

        // build a clean passData
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
                        {
                            key: 'standing',
                            label: 'STANDING',
                            value: standingNumber
                        }
                    ]
                    : data.eventTicket.auxiliaryFields,
            },

        };

        try {
            await createPass({email, passData: pd});
            setStatus('done');
        } catch {
            setStatus('error');
        }
    };

    return (
        <form onSubmit={submit} style={{maxWidth: 400, margin: '2em auto', fontFamily: 'sans-serif'}}>
            <h2 style={{textAlign: 'center'}}>Generate Season Ticket Pass</h2>

            {/* Handle email directly */}
            <div style={{marginBottom: 12}}>
                <label style={{display: 'block', fontSize: 12, marginBottom: 4}}>
                    Customer Email
                </label>
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
                    disabled={status === 'working'}
                />
            </div>

            {/* All the passData fields */}
            <Field label="Organization Name" path="organizationName" type="text" data={data} set={setData}/>
            <Field label="Description" path="description" type="text" data={data} set={setData}/>
            <Field label="Background Color" path="backgroundColor" type="color" data={data} set={setData}/>
            <Field label="Foreground Color" path="foregroundColor" type="color" data={data} set={setData}/>
            <Field label="Label Color" path="labelColor" type="color" data={data} set={setData}/>
            <Field label="Logo Text" path="logoText" type="text" data={data} set={setData}/>
            <Field label="Relevant Date & Time" path="relevantDate" type="datetime-local" data={data} set={setData}/>

            <h3>Header Field</h3>
            <Field label="Header Label" path="eventTicket.headerFields.0.label" type="text" data={data} set={setData}/>
            <Field label="Header Value" path="eventTicket.headerFields.0.value" type="datetime-local" data={data}
                   set={setData}/>
            <Field label="Header DateStyle" path="eventTicket.headerFields.0.dateStyle" type="text" data={data}
                   set={setData}/>

            <h3>Primary Field</h3>
            <Field label="Primary Label" path="eventTicket.primaryFields.0.label" type="text" data={data}
                   set={setData}/>
            <Field label="Primary Value" path="eventTicket.primaryFields.0.value" type="text" data={data}
                   set={setData}/>

            <h3>Secondary Fields</h3>
            <Field label="Sec 1 Label" path="eventTicket.secondaryFields.0.label" type="text" data={data}
                   set={setData}/>
            <Field label="Sec 1 Value" path="eventTicket.secondaryFields.0.value" type="text" data={data}
                   set={setData}/>
            <Field label="Sec 2 Label" path="eventTicket.secondaryFields.1.label" type="text" data={data}
                   set={setData}/>
            <Field label="Sec 2 Value" path="eventTicket.secondaryFields.1.value" type="text" data={data}
                   set={setData}/>
            <Field label="Sec 2 Alignment" path="eventTicket.secondaryFields.1.textAlignment" type="text" data={data}
                   set={setData}/>

            <h3>Auxiliary Fields</h3>
            {isStanding ? (
                <>
                    {/* single STANDING input */}
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
                </>
            ) : (
                <>
                    <Field label="Block" path="eventTicket.auxiliaryFields.0.value"
                           type="text" data={data} set={setData}/>
                    <Field label="Row" path="eventTicket.auxiliaryFields.1.value"
                           type="text" data={data} set={setData}/>
                    <Field label="Seat" path="eventTicket.auxiliaryFields.2.value"
                           type="text" data={data} set={setData}/>
                </>
            )}
            <div style={{marginBottom: 16}}>
                <label style={{fontSize: 13, fontWeight: 500}}>
                    <input
                        type="checkbox"
                        checked={isStanding}
                        onChange={e => setIsStanding(e.target.checked)}
                        style={{marginRight: 6}}
                    />
                    Standing Ticket
                </label>
            </div>

            <h3>Barcode</h3>
            <Field label="Barcode Message" path="barcode.message" type="text" data={data} set={setData}/>
            <Field label="Barcode AltText" path="barcode.altText" type="text" data={data} set={setData}/>

            <button
                type="submit"
                disabled={status === 'working'}
                style={{marginTop: 16, padding: '8px 16px', width: '100%'}}
            >
                {status === 'working' ? 'Generating…' : 'Generate Pass'}
            </button>

            {status === 'done' && <p style={{color: 'green', marginTop: 12}}>✓ Pass stored.</p>}
            {status === 'error' && <p style={{color: 'crimson', marginTop: 12}}>✖ Error creating pass.</p>}
        </form>
    )
}

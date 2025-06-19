import React, {useState} from 'react';
import {createPass} from '../api';

/* ───── helpers ─────────────────────────────────────────────── */
const hexToRgb = h => {
    const [r, g, b] = h.slice(1).match(/.{2}/g).map(x => parseInt(x, 16));
    return `rgb(${r},${g},${b})`;
};

function buildPassData(row) {
    const isStanding = !!row.standing;
    const aux = isStanding
        ? [{key: 'standing', label: 'STANDING', value: row.standing}]
        : [
            {key: 'block', label: 'BLOCK', value: row.block},
            {key: 'row', label: 'ROW', value: row.row},
            {key: 'seat', label: 'SEAT', value: row.seat},
        ];

    return {
        organizationName: 'Milton Keynes Lightning',
        description: '2025 / 26 Season Ticket',
        backgroundColor: hexToRgb('#D8BD5A'),
        foregroundColor: hexToRgb('#000000'),
        labelColor: hexToRgb('#000000'),
        logoText: 'MKL Season Ticket',
        relevantDate: new Date().toISOString(),

        eventTicket: {
            headerFields: [{
                key: 'nextGame',
                label: 'NEXT GAME',
                value: '2025-10-10T19:00:00.000Z',
                dateStyle: 'PKDateStyleShort'
            }],
            primaryFields: [{
                key: 'ticket',
                label: '2025/26',
                value: row.primary
            }],
            secondaryFields: [
                {key: 'opponent', label: 'OPPONENT', value: 'Leeds Knights'},
                {
                    key: 'ticketType', label: 'TICKET TYPE', value: row.sec2,
                    textAlignment: 'PKTextAlignmentRight'
                }
            ],
            auxiliaryFields: aux
        },

        barcode: {
            format: 'PKBarcodeFormatQR',
            message: row.barcode,
            messageEncoding: 'iso-8859-1',
            altText: row.barcode
        }
    };
}

/* ───────────────────────────────────────────────────────────── */

export default function BulkCreate() {
    const [rows, setRows] = useState([]);
    const [creating, setCreating] = useState(false);
    const [result, setResult] = useState(null);

    const parseCsv = text => {
        const [headerLine, ...lines] = text.trim().split(/\r?\n/);
        const headers = headerLine.split(',').map(h => h.trim().toLowerCase());

        const parsed = lines
            .map(line => line.split(',').map(c => c.trim()))
            .filter(cols => cols.length >= 6)   // need at least email…barcode
            .map(cols => Object.fromEntries(
                headers.map((h, i) => [h, cols[i] ?? ''])
            ));

        setRows(parsed);
        setResult(null);
    };

    const handleFile = e => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => parseCsv(ev.target.result);
        reader.readAsText(file);
    };

    const handleCreate = async () => {
        setCreating(true);
        let ok = 0, fail = 0;

        for (const r of rows) {
            try {
                const pd = buildPassData(r);
                await createPass({email: r.email, passData: pd});
                ok++;
            } catch (err) {
                console.error(err);
                fail++;
            }
        }
        setResult({ok, fail});
        setCreating(false);
    };

    return (
        <div style={{maxWidth: 900, margin: '2em auto', fontFamily: 'sans-serif'}}>
            <h2>Bulk Create Season-Tickets</h2>

            <input type="file" accept=".csv"
                   onChange={handleFile}
                   style={{marginBottom: 20}}/>

            {rows.length > 0 && (
                <>
                    <p>{rows.length} rows imported — verify below, then press **Create**.</p>

                    <table style={{width: '100%', borderCollapse: 'collapse'}}>
                        <thead>
                        <tr>{Object.keys(rows[0]).map(h =>
                            <th key={h} style={{
                                textAlign: 'left',
                                borderBottom: '1px solid #ccc'
                            }}>
                                {h.toUpperCase()}
                            </th>)}</tr>
                        </thead>
                        <tbody>
                        {rows.map((r, i) =>
                            <tr key={i} style={{borderBottom: '1px solid #eee'}}>
                                {Object.values(r).map((v, j) =>
                                    <td key={j}>{v}</td>)}
                            </tr>)}
                        </tbody>
                    </table>

                    <button onClick={handleCreate}
                            disabled={creating}
                            style={{marginTop: 16, padding: '8px 20px'}}>
                        {creating ? 'Creating…' : 'Create Passes'}
                    </button>

                    {result && (
                        <p style={{marginTop: 12}}>
                            ✓ {result.ok} created&nbsp;&nbsp;
                            {result.fail ? `✖ ${result.fail} failed` : null}
                        </p>
                    )}
                </>
            )}
        </div>
    );
}

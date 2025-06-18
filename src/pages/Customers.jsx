import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {listPasses, resendPass} from '../api';

export default function Customers() {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);

    /* per-column search terms */
    const [sEmail, setSEmail] = useState('');
    const [sFirst, setSFirst] = useState('');
    const [sLast, setSLast] = useState('');
    const [sBlock, setSBlock] = useState('');
    const [sRow, setSRow] = useState('');
    const [sSeat, setSSeat] = useState('');
    const [sStatus, setSStatus] = useState('');

    useEffect(() => {
        listPasses().then(setRows);
    }, []);

    /* ---------- filtered rows ------------------------------------------ */
    const filtered = rows.filter(r => {
        const pd = JSON.parse(r.passData || '{}');
        const email = (r.email || '').toLowerCase();
        const first = (pd.firstName || '').toLowerCase();
        const last = (pd.lastName || '').toLowerCase();
        const block = (pd.eventTicket?.auxiliaryFields?.[0]?.value || '')
            .toString().toLowerCase();
        const row = (pd.eventTicket?.auxiliaryFields?.[1]?.value || '')
            .toString().toLowerCase();
        const seat = (pd.eventTicket?.auxiliaryFields?.[2]?.value || '')
            .toString().toLowerCase();
        const status = (r.emailStatus || '').toLowerCase();

        return email.includes(sEmail.toLowerCase()) &&
            first.includes(sFirst.toLowerCase()) &&
            last.includes(sLast.toLowerCase()) &&
            block.includes(sBlock.toLowerCase()) &&
            row.includes(sRow.toLowerCase()) &&
            seat.includes(sSeat.toLowerCase()) &&
            status.includes(sStatus.toLowerCase());
    });
    /* ------------------------------------------------------------------- */

    return (
        <>
            <h2>Customers</h2>

            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                {/* labels */}
                <tr>
                    {['Email', 'First Name', 'Last Name',
                        'Block', 'Row', 'Seat', 'Status'].map(h => (
                        <th
                            key={h}
                            style={{
                                textAlign: 'left',
                                borderBottom: '1px solid #ccc',
                                padding: '4px 0'
                            }}
                        >
                            {h}
                        </th>
                    ))}
                    <th/>
                </tr>

                {/* search inputs – widths auto-match each column */}
                <tr>
                    <th>
                        <input
                            value={sEmail} onChange={e => setSEmail(e.target.value)}
                            placeholder="Search"
                            style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
                        />
                    </th>
                    <th>
                        <input
                            value={sFirst} onChange={e => setSFirst(e.target.value)}
                            placeholder="Search"
                            style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
                        />
                    </th>
                    <th>
                        <input
                            value={sLast} onChange={e => setSLast(e.target.value)}
                            placeholder="Search"
                            style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
                        />
                    </th>
                    <th>
                        <input
                            value={sBlock} onChange={e => setSBlock(e.target.value)}
                            placeholder="Search"
                            style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
                        />
                    </th>
                    <th>
                        <input
                            value={sRow} onChange={e => setSRow(e.target.value)}
                            placeholder="Search"
                            style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
                        />
                    </th>
                    <th>
                        <input
                            value={sSeat} onChange={e => setSSeat(e.target.value)}
                            placeholder="Search"
                            style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
                        />
                    </th>
                    <th>
                        <input
                            value={sStatus} onChange={e => setSStatus(e.target.value)}
                            placeholder="Search"
                            style={{width: '100%', padding: 6, boxSizing: 'border-box'}}
                        />
                    </th>
                    <th/>
                </tr>
                </thead>

                <tbody>
                {filtered.map(r => {
                    const pd = JSON.parse(r.passData || '{}');
                    const aux = pd.eventTicket?.auxiliaryFields || [];
                    return (
                        <tr key={r.serialNumber} style={{borderBottom: '1px solid #eee'}}>
                            <td>{r.email}</td>
                            <td>{pd.firstName}</td>
                            <td>{pd.lastName}</td>
                            <td>{aux[0]?.value}</td>
                            <td>{aux[1]?.value}</td>
                            <td>{aux[2]?.value}</td>
                            <td>{r.emailStatus}</td>
                            <td style={{whiteSpace: 'nowrap', padding: '4px 0'}}>
                                <button
                                    onClick={() => navigate(`/update-pass/${r.serialNumber}`)}
                                    style={{marginRight: 8}}
                                >
                                    Update Pass
                                </button>
                                <button onClick={() => resendPass(r.serialNumber)}>
                                    Resend
                                </button>
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </>
    );
}

import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {listPasses, mailPending, resendPass} from '../api';

export default function Customers() {
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [sending, setSending] = useState(false);     // bulk progress

    /* per-column search terms */
    const [sEmail, setSEmail] = useState('');
    const [sFirst, setSFirst] = useState('');
    const [sLast, setSLast] = useState('');
    const [sBlock, setSBlock] = useState('');
    const [sRow, setSRow] = useState('');
    const [sSeat, setSSeat] = useState('');
    const [sStatus, setSStatus] = useState('');

    /** refresh helper */
    const refresh = () => listPasses().then(setRows);

    useEffect(refresh, []);

    /* ── filtering ─────────────────────────────────────────────── */
    const filtered = rows.filter(r => {
        const pd = JSON.parse(r.passData || '{}');
        const aux = pd.eventTicket?.auxiliaryFields || [];
        const email = (r.email || '').toLowerCase();
        const first = (pd.firstName || '').toLowerCase();
        const last = (pd.lastName || '').toLowerCase();
        const block = (aux[0]?.value || '').toString().toLowerCase();
        const row = (aux[1]?.value || '').toString().toLowerCase();
        const seat = (aux[2]?.value || '').toString().toLowerCase();
        const status = (r.emailStatus || '').toLowerCase();

        return email.includes(sEmail.toLowerCase()) &&
            first.includes(sFirst.toLowerCase()) &&
            last.includes(sLast.toLowerCase()) &&
            block.includes(sBlock.toLowerCase()) &&
            row.includes(sRow.toLowerCase()) &&
            seat.includes(sSeat.toLowerCase()) &&
            status.includes(sStatus.toLowerCase());
    });

    const pendingCount = rows.filter(r => r.emailStatus === 'pending').length;

    /* ── bulk-send handler ─────────────────────────────────────── */
    const handleBulkSend = async () => {
        if (!pendingCount) return;
        if (!window.confirm(`Queue e-mails for ${pendingCount} pending passes?`)) return;

        setSending(true);
        try {
            await mailPending();
            alert('Bulk send queued – refresh in a minute to watch statuses update.');
            refresh();                  // pick up new “queued” statuses
        } catch (err) {
            alert(err.message || 'Bulk send failed');
        } finally {
            setSending(false);
        }
    };

    /* ── render ───────────────────────────────────────────────── */
    return (
        <>
            <h2>Customers</h2>

            <button
                onClick={handleBulkSend}
                disabled={sending || !pendingCount}
                style={{margin: '12px 0', padding: '6px 22px'}}
            >
                {sending ? 'Queuing…' : `Mail all pending (${pendingCount})`}
            </button>

            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                {/* column labels */}
                <tr>
                    {['Email', 'First Name', 'Last Name',
                        'Block', 'Row', 'Seat', 'Status'].map(h => (
                        <th key={h} style={{textAlign: 'left', borderBottom: '2px solid #000'}}>
                            {h}
                        </th>))}
                    <th/>
                </tr>

                {/* search boxes */}
                <tr>
                    <th><input value={sEmail} onChange={e => setSEmail(e.target.value)}
                               placeholder="Search" style={{width: '100%', padding: 6}}/></th>
                    <th><input value={sFirst} onChange={e => setSFirst(e.target.value)}
                               placeholder="Search" style={{width: '100%', padding: 6}}/></th>
                    <th><input value={sLast} onChange={e => setSLast(e.target.value)}
                               placeholder="Search" style={{width: '100%', padding: 6}}/></th>
                    <th><input value={sBlock} onChange={e => setSBlock(e.target.value)}
                               placeholder="Search" style={{width: '100%', padding: 6}}/></th>
                    <th><input value={sRow} onChange={e => setSRow(e.target.value)}
                               placeholder="Search" style={{width: '100%', padding: 6}}/></th>
                    <th><input value={sSeat} onChange={e => setSSeat(e.target.value)}
                               placeholder="Search" style={{width: '100%', padding: 6}}/></th>
                    <th><input value={sStatus} onChange={e => setSStatus(e.target.value)}
                               placeholder="Search" style={{width: '100%', padding: 6}}/></th>
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
                                    Update&nbsp;Pass
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

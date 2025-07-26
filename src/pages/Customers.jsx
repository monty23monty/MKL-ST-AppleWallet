import {useEffect, useState} from 'react';
import {useAuth} from 'react-oidc-context';
import {useNavigate} from 'react-router-dom';
import {listPasses, mailPending, resendPass} from '../api';

export default function Customers() {
    const auth     = useAuth();
    const idToken  = auth.user?.id_token;
    const navigate = useNavigate();

    const [rows,    setRows]    = useState([]);
    const [sending, setSending] = useState(false);

    // search terms
    const [sEmail, setSEmail] = useState('');
    const [sFirst, setSFirst] = useState('');
    const [sLast,  setSLast]  = useState('');
    const [sBlock, setSBlock] = useState('');
    const [sRow,   setSRow]   = useState('');
    const [sSeat,  setSSeat]  = useState('');
    const [sStatus,setSStatus]= useState('');

    const refresh = () => {
        if (!idToken) return;
        listPasses(idToken).then(setRows);
    };

    useEffect(refresh, [idToken]);

    const pendingCount = rows.filter(r => r.emailStatus === 'pending').length;

    // filter, now reading names from r.firstName / r.lastName
    const filtered = rows.filter(r => {
        const pd     = JSON.parse(r.passData || '{}');
        const aux    = pd.eventTicket?.auxiliaryFields || [];
        const email  = (r.email     || '').toLowerCase();
        const first  = (r.firstName || pd.firstName || '').toLowerCase();
        const last   = (r.lastName  || pd.lastName  || '').toLowerCase();
        const block  = (aux[0]?.value || '').toString().toLowerCase();
        const row    = (aux[1]?.value || '').toString().toLowerCase();
        const seat   = (aux[2]?.value || '').toString().toLowerCase();
        const status = (r.emailStatus || '').toLowerCase();

        return email.includes(sEmail.toLowerCase()) &&
            first.includes(sFirst.toLowerCase()) &&
            last.includes(sLast.toLowerCase()) &&
            block.includes(sBlock.toLowerCase()) &&
            row.includes(sRow.toLowerCase()) &&
            seat.includes(sSeat.toLowerCase()) &&
            status.includes(sStatus.toLowerCase());
    });

    const handleBulkSend = async () => {
        if (!pendingCount) return;
        if (!window.confirm(`Queue e-mails for ${pendingCount} pending passes?`)) return;

        setSending(true);
        try {
            await mailPending(idToken);
            alert('Bulk send queued – refresh in a minute to watch statuses update.');
            refresh();
        } catch (err) {
            alert(err.message || 'Bulk send failed');
        } finally {
            setSending(false);
        }
    };

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
                <tr>
                    {['Email','First Name','Last Name','Block','Row','Seat','Status'].map(h => (
                        <th key={h} style={{textAlign:'left',borderBottom:'2px solid #000'}}>
                            {h}
                        </th>
                    ))}
                    <th/>
                </tr>
                <tr>
                    {[sEmail,sFirst,sLast,sBlock,sRow,sSeat,sStatus].map((val,i) => (
                        <th key={i}>
                            <input
                                value={val}
                                onChange={e => ([setSEmail,setSFirst,setSLast,setSBlock,setSRow,setSSeat,setSStatus][i])(e.target.value)}
                                placeholder="Search"
                                style={{width:'100%',padding:6}}
                            />
                        </th>
                    ))}
                    <th/>
                </tr>
                </thead>
                <tbody>
                {filtered.map(r => {
                    const pd  = JSON.parse(r.passData || '{}');
                    const aux = pd.eventTicket?.auxiliaryFields || [];
                    const first = r.firstName || pd.firstName || '';
                    const last  = r.lastName  || pd.lastName  || '';

                    return (
                        <tr key={r.serialNumber} style={{borderBottom:'1px solid #eee'}}>
                            <td>{r.email}</td>
                            <td>{first}</td>
                            <td>{last}</td>
                            <td>{aux[0]?.value}</td>
                            <td>{aux[1]?.value}</td>
                            <td>{aux[2]?.value}</td>
                            <td>{r.emailStatus}</td>
                            <td style={{whiteSpace:'nowrap',padding:'4px 0'}}>
                                <button
                                    onClick={() => navigate(`/update-pass/${r.serialNumber}`)}
                                    style={{marginRight:8}}
                                >
                                    Update Pass
                                </button>
                                <button onClick={() => resendPass(r.serialNumber, idToken)}>
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

import { useEffect, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { listPasses } from '../api';
import HoverCard from '../components/HoverCard.jsx';

/* ───── hover-card constants ─────────────────────────────────── */
const PREVIEW_MARGIN = 3;
const PREVIEW_WIDTH  = 260;
const PREVIEW_HEIGHT = 160;
/* ─────────────────────────────────────────────────────────────── */

export default function PassList() {
    const auth     = useAuth();
    const idToken  = auth.user?.id_token;
    const navigate = useNavigate();

    const [rows,       setRows]       = useState([]);
    const [preview,    setPreview]    = useState(null);
    const [hoverTimer, setHoverTimer] = useState(null);

    // search terms
    const [sEmail,  setSEmail]  = useState('');
    const [sFirst,  setSFirst]  = useState('');
    const [sLast,   setSLast]   = useState('');
    const [sBlock,  setSBlock]  = useState('');
    const [sRow,    setSRow]    = useState('');
    const [sSeat,   setSSeat]   = useState('');
    const [sStatus, setSStatus] = useState('');

    const refresh = () => {
        if (!idToken) return;
        listPasses(idToken).then(setRows);
    };

    useEffect(refresh, [idToken]);

    const startHover = (row, e) => {
        clearTimeout(hoverTimer);
        const { clientX, clientY } = e;
        const left = clientX + PREVIEW_MARGIN + PREVIEW_WIDTH > window.innerWidth;
        const x    = left
            ? clientX - PREVIEW_MARGIN - PREVIEW_WIDTH
            : clientX + PREVIEW_MARGIN;
        const y = Math.min(
            clientY,
            window.innerHeight - PREVIEW_HEIGHT - PREVIEW_MARGIN
        );
        const t = setTimeout(() => {
            setPreview({
                data: JSON.parse(row.passData || '{}'),
                x,
                y,
                show: false
            });
            requestAnimationFrame(() =>
                setPreview(p => p && { ...p, show: true })
            );
        }, 300);
        setHoverTimer(t);
    };

    const stopHover = () => {
        clearTimeout(hoverTimer);
        setPreview(p => p && { ...p, show: false });
    };

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

        return (
            email.includes(sEmail.toLowerCase()) &&
            first.includes(sFirst.toLowerCase()) &&
            last.includes(sLast.toLowerCase()) &&
            block.includes(sBlock.toLowerCase()) &&
            row.includes(sRow.toLowerCase()) &&
            seat.includes(sSeat.toLowerCase()) &&
            status.includes(sStatus.toLowerCase())
        );
    });

    return (
        <>
            <h2>Passes</h2>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                <tr>
                    {['Email','First Name','Last Name','Block','Row','Seat','Status'].map(h => (
                        <th
                            key={h}
                            style={{ textAlign: 'left', borderBottom: '2px solid #000', padding: '8px' }}
                        >
                            {h}
                        </th>
                    ))}
                    <th style={{ borderBottom: '2px solid #000' }}/>
                </tr>
                <tr>
                    {[sEmail,sFirst,sLast,sBlock,sRow,sSeat,sStatus].map((val, i) => (
                        <th key={i} style={{ padding: '4px' }}>
                            <input
                                value={val}
                                onChange={e =>
                                    [setSEmail,setSFirst,setSLast,setSBlock,setSRow,setSSeat,setSStatus][i](e.target.value)
                                }
                                placeholder="Search"
                                style={{ width: '100%', padding: 6, boxSizing: 'border-box' }}
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
                        <tr
                            key={r.serialNumber}
                            style={{ borderBottom: '1px solid #eee', cursor: 'pointer' }}
                            onMouseEnter={e => startHover(r, e)}
                            onMouseLeave={stopHover}
                        >
                            <td style={{ padding: '8px' }}>{r.email}</td>
                            <td style={{ padding: '8px' }}>{first}</td>
                            <td style={{ padding: '8px' }}>{last}</td>
                            <td style={{ padding: '8px' }}>{aux[0]?.value}</td>
                            <td style={{ padding: '8px' }}>{aux[1]?.value}</td>
                            <td style={{ padding: '8px' }}>{aux[2]?.value}</td>
                            <td style={{ padding: '8px' }}>{r.emailStatus}</td>
                            <td style={{ whiteSpace: 'nowrap', padding: '8px' }}>
                                <button
                                    onClick={() => navigate(`/passes/${r.serialNumber}`)}
                                    style={{ marginRight: 8 }}
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
        </>
    );
}

import { useEffect, useState } from 'react';
import { getMetrics, bulkSend } from '../api';

export default function Dashboard() {
    const [m, set] = useState(null);
    useEffect(()=>{ getMetrics().then(set); },[]);
    if(!m) return <p>Loading…</p>;
    return (
        <>
            <h1>Season Dashboard</h1>
            <ul>
                <li>Pending: {m.pending}</li>
                <li>Queued : {m.queued}</li>
                <li>Mailed : {m.mailed}</li>
            </ul>
            <button onClick={bulkSend}>Send season passes</button>
        </>
    );
}

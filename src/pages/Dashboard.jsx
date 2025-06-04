import { useEffect, useState } from 'react';
import { getMetrics, bulkSend } from '../api';

export default function Dashboard() {
    const [m, setM] = useState(null);
    const [sending, setSending] = useState(false);

    // helper to load metrics
    const loadMetrics = async () => {
        try {
            const data = await getMetrics();
            setM(data);
        } catch (err) {
            console.error('Failed to load metrics', err);
        }
    };

    useEffect(() => {
        loadMetrics();
    }, []);

    const handleSend = async () => {
        setSending(true);
        try {
            await bulkSend();
            await loadMetrics();     // re-fetch AFTER bulkSend resolves
        } catch (err) {
            console.error('bulkSend failed', err);
        } finally {
            setSending(false);
        }
    };

    if (!m) return <p>Loading…</p>;

    return (
        <>
            <h1>Season Dashboard</h1>
            <ul>
                <li>Pending: {m.pending}</li>
                <li>Queued : {m.queued}</li>
                <li>Mailed : {m.mailed}</li>
            </ul>
            <button onClick={handleSend} disabled={sending}>
                {sending ? 'Sending…' : 'Send season passes'}
            </button>
        </>
    );
}

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { getMetrics, bulkSend } from '../api';

export default function Dashboard() {
    const auth = useAuth();
    const idToken = auth.user?.id_token;

    // we'll store the raw { [status: string]: number } map here
    const [metrics, setMetrics] = useState({});
    const [sending, setSending] = useState(false);

    const loadMetrics = useCallback(async () => {
        if (!idToken) return;
        try {
            const data = await getMetrics(idToken);
            setMetrics(data);
        } catch (err) {
            console.error('Failed to load metrics', err);
        }
    }, [idToken]);

    useEffect(() => {
        loadMetrics();
    }, [loadMetrics]);

    const handleSend = async () => {
        setSending(true);
        try {
            await bulkSend(idToken);
            await loadMetrics();
        } catch (err) {
            console.error('bulkSend failed', err);
        } finally {
            setSending(false);
        }
    };

    if (!metrics) {
        return <p>Loading…</p>;
    }

    return (
        <>
            <h1>Season Dashboard</h1>
            <ul>
                {Object.entries(metrics).map(([status, count]) => {
                    const label = status.charAt(0).toUpperCase() + status.slice(1);
                    return <li key={status}>{label}: {count}</li>;
                })}
            </ul>
            <button onClick={handleSend} disabled={sending}>
                {sending ? 'Sending…' : 'Send season passes'}
            </button>
        </>
    );
}

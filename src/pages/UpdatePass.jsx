// src/pages/UpdatePass.jsx
import { useEffect, useState } from 'react';
import { listPasses, getPassData, updatePassData, resendPass } from '../api';

export default function UpdatePass() {
    const [passes, setPasses]             = useState([]);
    const [selected, setSelected]         = useState('');
    const [passData, setPassData]         = useState(null);
    const [editedValue, setEditedValue]   = useState('');
    const [loading, setLoading]           = useState(false);
    const [saving, setSaving]             = useState(false);

    // load list of passes on mount
    useEffect(() => {
        setLoading(true);
        listPasses()
            .then(setPasses)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    // when you pick one, fetch its full passData
    useEffect(() => {
        if (!selected) {
            setPassData(null);
            return;
        }
        setLoading(true);
        getPassData(selected)
            .then(data => {
                setPassData(data);
                // prefill one field (e.g. first headerFields value)
                const init = data.eventTicket?.headerFields?.[0]?.value || '';
                setEditedValue(init);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [selected]);

    const handleSubmit = async e => {
        e.preventDefault();
        setSaving(true);
        try {
            // 1) mutate the JSON locally
            const updated = {
                ...passData,
                eventTicket: {
                    ...passData.eventTicket,
                    headerFields: passData.eventTicket.headerFields.map((f, i) =>
                        i === 0 ? { ...f, value: editedValue } : f
                    )
                }
            };

            // 2) PUT it back to your API
            await updatePassData(selected, updated);

            // 3) trigger the push
            await resendPass(selected);

            alert('Pass updated and pushed!');
        } catch (err) {
            console.error(err);
            alert('Failed to update: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <p>Loading…</p>;

    return (
        <div>
            <h2>Update a Pass</h2>

            <label>
                Choose pass:
                <select
                    value={selected}
                    onChange={e => setSelected(e.target.value)}
                    style={{ marginLeft: 8 }}
                >
                    <option value="">— select —</option>
                    {passes.map(p => (
                        <option key={p.serialNumber} value={p.serialNumber}>
                            {p.email} | {p.serialNumber}
                        </option>
                    ))}
                </select>
            </label>

            {passData && (
                <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
                    <div>
                        <label>
                            Next Game (headerFields[0].value):
                            <input
                                type="text"
                                value={editedValue}
                                onChange={e => setEditedValue(e.target.value)}
                                style={{ display: 'block', width: '100%', marginTop: 4 }}
                            />
                        </label>
                    </div>

                    <button type="submit" disabled={saving} style={{ marginTop: 12 }}>
                        {saving ? 'Saving…' : 'Save & Push'}
                    </button>
                </form>
            )}
        </div>
    );
}

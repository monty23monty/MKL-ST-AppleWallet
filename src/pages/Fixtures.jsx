import React, {useEffect, useState} from 'react';
import {deleteFixture, listFixtures, pushFixture, storeFixtures} from '../api';
import { useAuth } from 'react-oidc-context';

const toISO = (d, t) => {
    if (!d || !t) throw new Error(`Invalid date/time: "${d}" "${t}"`);
    // d = '09/09/2023', t = '19:00'
    const [day, month, year] = d.split('/');
    const [hour, minute] = t.split(':');
    if (!day || !month || !year || !hour || !minute)
        throw new Error(`Bad date/time format: "${d}" "${t}"`);
    // Note: month - 1 because JS months are 0-based
    const dt = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute)
    );
    if (isNaN(dt.getTime())) throw new Error(`Could not parse date/time: "${d}" "${t}"`);
    return dt.toISOString();
};
const local = iso => new Date(iso).toLocaleString();

export default function Fixtures() {
    const auth = useAuth();
    const accessToken = auth.user?.access_token;
    const [rows, setRows] = useState([]);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [opp, setOpp] = useState('');
    const [busy, setBusy] = useState(false);

    /* initial fetch */
    useEffect(() => {
        if (!accessToken) return;
        listFixtures(accessToken).then(setRows);
    }, [accessToken]);

    /* store helper and refresh */
    const save = async arr => {
        await storeFixtures(arr, accessToken);
        const updated = await listFixtures(accessToken);
        setRows(updated);
    };

    /* manual add */
    const addManual = () => {
        if (!date || !time || !opp) return alert('Fill all fields first');
        save([{gameDate: toISO(date, time), opponent: opp}])
            .then(() => {
                setDate('');
                setTime('');
                setOpp('');
            });
    };

    /* CSV upload */
    const handleCsv = e => {
        const f = e.target.files?.[0];
        if (!f) return;
        const rd = new FileReader();
        rd.onload = ev => {
            const [head, ...lines] = ev.target.result.trim().split(/\r?\n/);
            const hdr = head.split(',').map(h => h.trim().toLowerCase());
            const out = lines.map(ln => {
                const c = ln.split(',').map(x => x.trim());
                const rec = Object.fromEntries(hdr.map((h, i) => [h, c[i] || '']));
                return {gameDate: toISO(rec.date, rec.time), opponent: rec.opponent};
            });
            save(out);
        };
        rd.readAsText(f);
    };

    const del = async f => {
        if (!window.confirm(`Delete fixture ${f.opponent} – ${local(f.gameDate)} ?`))
            return;
        await deleteFixture(f.fixtureId, accessToken);
        setRows(rows.filter(r => r.fixtureId !== f.fixtureId));
    };

    const push = async f => {
        if (!window.confirm(`Push ${f.opponent} – ${local(f.gameDate)} to all passes?`))
            return;
        setBusy(true);
        try {
            await pushFixture({datetime: f.gameDate, opponent: f.opponent}, accessToken);
            alert('Update queued – passes will refresh soon.');
        } catch (e) {
            alert(e.message || 'Failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{maxWidth: 900, margin: '2em auto', fontFamily: 'sans-serif'}}>
            <h2>Season-ticket Fixtures</h2>

            {/* manual line */}
            <div style={{display: 'flex', gap: 12, marginBottom: 16}}>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}/>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}/>
                <input type="text" placeholder="Opponent"
                       value={opp} onChange={e => setOpp(e.target.value)}/>
                <button onClick={addManual}>Add</button>
            </div>

            {/* csv */}
            <input type="file" accept=".csv" onChange={handleCsv}
                   style={{marginBottom: 20}}/>

            {/* list */}
            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                <tr>
                    <th>Date / Time</th>
                    <th>Opponent</th>
                    <th colSpan={2}/>
                </tr>
                </thead>
                <tbody>
                {rows.map(f =>
                    <tr key={f.fixtureId}
                        style={{borderBottom: '1px solid #eee'}}>
                        <td>{local(f.gameDate)}</td>
                        <td>{f.opponent}</td>
                        <td>
                            <button disabled={busy} onClick={() => push(f)}>
                                {busy ? 'Working…' : 'Push'}
                            </button>
                        </td>
                        <td>
                            <button onClick={() => del(f)}>Delete</button>
                        </td>
                    </tr>)}
                </tbody>
            </table>
        </div>
    );
}

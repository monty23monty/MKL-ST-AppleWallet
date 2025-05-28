import { useEffect, useState } from 'react';
import { listPasses, resendPass } from '../api';

export default function Customers(){
    const [rows, set] = useState([]);
    useEffect(()=>{ listPasses().then(set); },[]);
    return (
        <>
            <h2>Customers</h2>
            <table><thead><tr><th>Email</th><th>Serial</th><th>Status</th><th/></tr></thead>
                <tbody>
                {rows.map(r=>(
                    <tr key={r.serialNumber}>
                        <td>{r.email}</td><td>{r.serialNumber}</td><td>{r.emailStatus}</td>
                        <td><button onClick={()=>resendPass(r.serialNumber)}>Resend</button></td>
                    </tr>
                ))}
                </tbody>
            </table>
        </>
    );
}

// App.jsx / App.tsx
import { useState } from 'react';
import { Amplify } from 'aws-amplify';
import { signOut } from 'aws-amplify/auth';           // 👈 modular Auth
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import awsConfig from './awsConfig';                  // default export from CLI
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';

Amplify.configure(awsConfig);                         // still the same

function App({ signOut: uiSignOut /* injected by withAuthenticator */ }) {
    const [tab, setTab] = useState('dash');

    async function handleSignOut() {
        // Either call the helper prop or the low-level API—your choice
        await signOut();          // low-level modular API
        // uiSignOut();           // one-liner that UI package gives you
    }

    return (
        <div style={{ padding: 20 }}>
            <nav>
                <button onClick={() => setTab('dash')}>Dashboard</button>
                <button onClick={() => setTab('cust')}>Customers</button>
                <button onClick={handleSignOut}>Sign&nbsp;out</button>
            </nav>

            {tab === 'dash' ? <Dashboard /> : <Customers />}
        </div>
    );
}

export default App;               // unchanged

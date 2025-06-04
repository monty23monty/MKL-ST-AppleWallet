// App.jsx / App.tsx
import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { Amplify } from 'aws-amplify';
import { signOut } from 'aws-amplify/auth';           // 👈 modular Auth
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import awsConfig from './awsConfig';                  // default export from CLI
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';

Amplify.configure(awsConfig);                         // still the same

function App() {

    async function handleSignOut() {
        // Either call the helper prop or the low-level API—your choice
        await signOut();          // low-level modular API
        // uiSignOut();           // one-liner that UI package gives you
    }

    return (
        <div className="container">
            <nav>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/customers">Customers</NavLink>
                <button onClick={handleSignOut}>Sign&nbsp;out</button>
            </nav>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
            </Routes>
        </div>
    );
}

export default withAuthenticator(App);               // unchanged

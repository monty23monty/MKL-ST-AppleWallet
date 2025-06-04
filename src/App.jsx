// App.jsx / App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { signOut } from 'aws-amplify/auth';           // 👈 modular Auth
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CreatePass from './pages/CreatePass';
import UpdatePass from './pages/UpdatePass';
import Navbar from './components/Navbar';
import { useEffect, useState } from 'react';

function App() {
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('darkMode') === 'true';
    });

    useEffect(() => {
        document.body.classList.toggle('dark', darkMode);
        localStorage.setItem('darkMode', darkMode);
    }, [darkMode]);

    async function handleSignOut() {
        // Either call the helper prop or the low-level API—your choice
        await signOut();          // low-level modular API
        // uiSignOut();           // one-liner that UI package gives you
    }

    return (
        <div className="container">
            <Navbar onSignOut={handleSignOut} darkMode={darkMode} setDarkMode={setDarkMode} />
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/create-pass" element={<CreatePass />} />
                <Route path="/update-pass" element={<UpdatePass />} />
            </Routes>
        </div>
    );
}

export default withAuthenticator(App);               // unchanged

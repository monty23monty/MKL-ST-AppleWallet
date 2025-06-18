// App.jsx / App.tsx
import {Navigate, Route, Routes} from 'react-router-dom';
import {signOut} from 'aws-amplify/auth'; // 👈 modular Auth
import {withAuthenticator} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CreatePass from './pages/CreatePass';
import UpdatePass from './pages/UpdatePass';
import Navbar from './components/Navbar';

function App() {

    async function handleSignOut() {
        // Either call the helper prop or the low-level API—your choice
        await signOut();          // low-level modular API
        // uiSignOut();           // one-liner that UI package gives you
    }

    return (
        <div className="container">
            <Navbar onSignOut={handleSignOut}/>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
                <Route path="/dashboard" element={<Dashboard/>}/>
                <Route path="/customers" element={<Customers/>}/>
                <Route path="/create-pass" element={<CreatePass/>}/>
                <Route path="/update-pass" element={<UpdatePass/>}/>
                <Route path="/update-pass/:serial" element={<UpdatePass/>}/>
            </Routes>
        </div>
    );
}

export default withAuthenticator(App);               // unchanged

import {Navigate, Route, Routes} from 'react-router-dom';
import {signOut} from 'aws-amplify/auth';
import {withAuthenticator} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CreatePass from './pages/CreatePass';
import BulkCreate from './pages/BulkCreate';
import Fixtures from './pages/Fixtures'; // ← NEW
import UpdatePass from './pages/UpdatePass';
import Navbar from './components/Navbar';

function App() {
    async function handleSignOut() {
        await signOut();
    }

    return (
        <div className="container">
            <Navbar onSignOut={handleSignOut}/>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace/>}/>
                <Route path="/dashboard" element={<Dashboard/>}/>
                <Route path="/customers" element={<Customers/>}/>
                <Route path="/create-pass" element={<CreatePass/>}/>
                <Route path="/bulk-create" element={<BulkCreate/>}/>
                <Route path="/fixtures" element={<Fixtures/>}/> {/* NEW */}
                <Route path="/update-pass" element={<UpdatePass/>}/>
                <Route path="/update-pass/:serial" element={<UpdatePass/>}/>
            </Routes>
        </div>
    );
}

export default withAuthenticator(App);

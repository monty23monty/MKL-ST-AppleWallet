import { useAuth } from "react-oidc-context";
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import CreatePass from './pages/CreatePass';
import BulkCreate from './pages/BulkCreate';
import Fixtures from './pages/Fixtures';
import UpdatePass from './pages/UpdatePass';
import Navbar from './components/Navbar';
import { Navigate, Route, Routes } from 'react-router-dom';
import TemplateEditor from './pages/TemplateEditor';
import PassEdit from "./pages/PassEdit.jsx";
import PassList from "./pages/PassList.jsx";
import BulkEdit from "./pages/BulkEdit.jsx";

function App() {
  const auth = useAuth();

  const signOutRedirect = () => {
    const clientId = "446f6ubc33tbcjonhb158ua9p7";
    const logoutUri = "http://localhost:5173"; // Set to your post-logout redirect URI
    const cognitoDomain = "https://eu-west-2lbu472pes.auth.eu-west-2.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  if (auth.isLoading) {
    return <div>Loading...</div>;
  }

  if (auth.error) {
    return <div>Encountering error... {auth.error.message}</div>;
  }

  if (auth.isAuthenticated) {
    return (
      <div className="container">
        <Navbar onSignOut={signOutRedirect} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/create-pass" element={<CreatePass />} />
          <Route path="/bulk-create" element={<BulkCreate />} />
          <Route path="/fixtures" element={<Fixtures />} />
          <Route path="/update-pass" element={<UpdatePass />} />
          <Route path="/update-pass/:serial" element={<UpdatePass />} />
          <Route path="/template-editor" element={<TemplateEditor />} />
          <Route path="/passes/:serial" element={<PassEdit />} />
          <Route path="/passes" element={<PassList />} />
          <Route path="/bulk-edit" element={<BulkEdit />} />
        </Routes>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => auth.signinRedirect()}>Sign in</button>
      <button onClick={() => signOutRedirect()}>Sign out</button>
    </div>
  );
}

export default App;

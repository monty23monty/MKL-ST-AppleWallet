import { NavLink } from 'react-router-dom';
import './Navbar.css';

export default function Navbar({ onSignOut }) {
    return (
        <header className="navbar">
            <div className="navbar-brand">
                <img src="/vite.svg" alt="Logo" className="navbar-logo" />
                <NavLink to="/dashboard" className="home-link" title="Dashboard">
                    🏠
                </NavLink>
            </div>
            <nav>
                <NavLink to="/customers">Customers</NavLink>
                <NavLink to="/create-pass">Create Pass</NavLink>
                <NavLink to="/update-pass">Update Pass</NavLink>
                <button onClick={onSignOut}>Sign&nbsp;out</button>
            </nav>
        </header>
    );
}

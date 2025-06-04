import { NavLink } from 'react-router-dom';
import './Navbar.css';

export default function Navbar({ onSignOut, darkMode, setDarkMode }) {
    const toggleTheme = () => setDarkMode(!darkMode);

    return (
        <header className="navbar">
            <div className="navbar-brand">
                <img src="/vite.svg" alt="Logo" className="navbar-logo" />
                <NavLink to="/dashboard" className="home-link" title="Dashboard" aria-label="Dashboard">
                    🏠
                </NavLink>
            </div>
            <nav>
                <NavLink to="/customers">Customers</NavLink>
                <NavLink to="/create-pass">Create Pass</NavLink>
                <NavLink to="/update-pass">Update Pass</NavLink>
                <button onClick={toggleTheme} className="theme-toggle">
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <button onClick={onSignOut}>Sign&nbsp;out</button>
            </nav>
        </header>
    );
}

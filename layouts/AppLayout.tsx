import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

const NavLinks: React.FC<{ role: UserRole }> = ({ role }) => {
  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center px-4 py-2 text-gray-100 hover:bg-slate-700 rounded-md transition-colors duration-200 ${isActive ? 'bg-slate-700' : ''}`;

  if (role === 'patient') {
    return (
      <>
        <NavLink to="/" className={navLinkClass}>Mi Portal</NavLink>
        <NavLink to="/mis-citas" className={navLinkClass}>Mis Citas</NavLink>
        <NavLink to="/historial" className={navLinkClass}>Mi Historial</NavLink>
        <NavLink to="/facturacion" className={navLinkClass}>Facturación</NavLink>
      </>
    );
  }

  // Default for clinic staff
  return (
    <>
      <NavLink to="/" end className={navLinkClass}>Dashboard</NavLink>
      <NavLink to="/agenda" className={navLinkClass}>Agenda</NavLink>
      {/* Admin-only: Usuarios management link */}
      {role === 'admin' && (
        <NavLink to="/admin/usuarios" className={navLinkClass}>Usuarios</NavLink>
      )}
      {/* Add more staff links here */}
    </>
  );
};

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  
  return (
    <div className="flex flex-col w-64 bg-slate-800 text-white h-screen p-4 sticky top-0">
      <div className="flex items-center mb-10">
  <svg xmlns="http://www.w.org/2000/svg" className="h-8 w-8 text-teal-400 mr-3 icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
        </svg>
        <span className="text-2xl font-bold">AyniSalud</span>
      </div>
      <nav className="flex flex-col space-y-2">
        {user && <NavLinks role={user.role} />}
      </nav>
      <div className="mt-auto">
        {/* Potentially add settings or other links here */}
      </div>
    </div>
  );
};

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-sm p-4 flex justify-end items-center">
      <div className="flex items-center">
        <div className="text-right mr-4">
          <p className="font-semibold">{user?.name}</p>
          <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
        </div>
        <img src={user?.avatarUrl} alt="User Avatar" className="w-10 h-10 rounded-full" />
        <button onClick={handleLogout} className="ml-6 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-md transition-colors duration-200">
          Logout
        </button>
      </div>
    </header>
  );
};

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex bg-slate-100 min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <Header />
        <div className="p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;

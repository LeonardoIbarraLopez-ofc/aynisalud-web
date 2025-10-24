import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import AppRouter from './routes/Router';

function App() {
  return (
    <div className="bg-slate-100 min-h-screen">
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </div>
  );
}

export default App;
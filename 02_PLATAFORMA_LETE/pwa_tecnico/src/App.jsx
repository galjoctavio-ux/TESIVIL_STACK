import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import RevisionForm from './pages/RevisionForm';
import RevisionWizard from './pages/RevisionWizard'; // Import the new wizard
import Cotizador from './pages/Cotizador';
import AgendaPage from './pages/AgendaPage';
import './App.css';

import ReloadPrompt from './components/ReloadPrompt';

function App() {
  return (
    <>
      <ReloadPrompt />

      <Routes>
        {/* --- RUTAS PÚBLICAS --- */}
        <Route path="/login" element={<Login />} />
        
        {/* --- RUTAS PROTEGIDAS --- */}
        <Route
          path="/" // Set Agenda as the main protected route
          element={
            <ProtectedRoute>
              <AgendaPage />
            </ProtectedRoute>
          }
        />

        {/* --- NUEVA RUTA DE REVISIÓN --- */}
        <Route
          path="/revision/:casoId"
          element={
            <ProtectedRoute>
              <RevisionWizard />
            </ProtectedRoute>
          }
        />

        {/* --- RUTA ANTIGUA (LEGACY) --- */}
        <Route
          path="/revision-legacy/:casoId"
          element={
            <ProtectedRoute>
              <RevisionForm />
            </ProtectedRoute>
          }
        />

        {/* --- RUTA COTIZADOR --- */}
        <Route 
          path="/cotizador" 
          element={
            <ProtectedRoute>
              <Cotizador />
            </ProtectedRoute>
          } 
        />
        
      </Routes>
    </>
  );
}

export default App;
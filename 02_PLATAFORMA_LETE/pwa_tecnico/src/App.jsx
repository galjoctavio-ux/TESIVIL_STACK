import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import RevisionForm from './pages/RevisionForm';
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
        
        {/* --- RUTA PÚBLICA "MAGIC LINK" --- 
            La sacamos de ProtectedRoute. Es segura por el token.
        ---*/}
        {/* <Route path="/revision" element={<RevisionForm />} />  */}


        {/* --- RUTAS PROTEGIDAS --- */}
        <Route
          path="/" // Set Agenda as the main protected route
          element={
            <ProtectedRoute>
              <AgendaPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/revision/:casoId"
          element={
            <ProtectedRoute>
              <RevisionForm />
            </ProtectedRoute>
          }
        />
        {/* The /casos route is now deprecated, AgendaPage at root is the main view */}

        {/* --- 2. NUEVA RUTA PROTEGIDA: COTIZADOR --- */}
        <Route 
          path="/cotizador" 
          element={
            <ProtectedRoute>
              <Cotizador />
            </ProtectedRoute>
          } 
        />
        
        {/* La ruta antigua "/revision/:casoId" ya no es necesaria */}
        
      </Routes>
    </>
  );
}

export default App;
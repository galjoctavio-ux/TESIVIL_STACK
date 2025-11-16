import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import CasosList from './pages/CasosList';
import ProtectedRoute from './components/ProtectedRoute';
import RevisionForm from './pages/RevisionForm';
import Cotizador from './pages/Cotizador'; // <--- 1. IMPORTAR EL COMPONENTE
import './App.css';

import ReloadPrompt from './components/ReloadPrompt';

function App() {
  return (
    <>
      <ReloadPrompt />

      <Routes>
        {/* --- RUTAS PÚBLICAS --- */}
        <Route path="/" element={<Login />} />
        
        {/* --- RUTA PÚBLICA "MAGIC LINK" --- 
            La sacamos de ProtectedRoute. Es segura por el token.
        ---*/}
        {/* <Route path="/revision" element={<RevisionForm />} />  */}


        {/* --- RUTAS PROTEGIDAS --- */}
        <Route
          path="/revision/:casoId"
          element={
            <ProtectedRoute>
              <RevisionForm />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/casos" 
          element={
            <ProtectedRoute>
              <CasosList />
            </ProtectedRoute>
          } 
        />

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
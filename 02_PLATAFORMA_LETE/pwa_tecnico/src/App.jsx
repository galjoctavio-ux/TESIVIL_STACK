import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ReloadPrompt from './components/ReloadPrompt';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import AgendaPage from './pages/AgendaPage';
import RevisionWizard from './pages/RevisionWizard';
import Cotizador from './pages/Cotizador';
import FirmaPage from './pages/FirmaPage';
import DetalleCaso from './pages/DetalleCaso';
import MiBilletera from './pages/MiBilletera';
import ChatSoporte from './pages/ChatSoporte';

function App() {
  return (
    <>
      <ReloadPrompt />

      <Routes>
        {/* --- RUTAS PÚBLICAS --- */}
        <Route path="/login" element={<Login />} />

        {/* --- RUTAS PROTEGIDAS --- */}
        <Route
          path="/"
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
              <RevisionWizard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cotizador"
          element={
            <ProtectedRoute>
              <Cotizador />
            </ProtectedRoute>
          }
        />

        <Route path="/soporte" element={
          <ProtectedRoute>
            <ChatSoporte />
          </ProtectedRoute>
        } />

        <Route
          path="/firma"
          element={
            <ProtectedRoute>
              <FirmaPage />
            </ProtectedRoute>
          }
        />

        <Route path="/billetera" element={<ProtectedRoute><MiBilletera /></ProtectedRoute>} />

        {/* --- CORRECCIÓN CRÍTICA AQUÍ --- 
            Cambiamos "/caso/:id" a "/detalle-caso/:id" 
            para coincidir con DiaTimeline.jsx 
        */}
        <Route
          path="/detalle-caso/:id"
          element={
            <ProtectedRoute>
              <DetalleCaso />
            </ProtectedRoute>
          }
        />

      </Routes>
    </>
  );
}

export default App;
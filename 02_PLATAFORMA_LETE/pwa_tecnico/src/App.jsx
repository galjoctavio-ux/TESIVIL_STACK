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
              <RevisionWizard />
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

        {/* 2. AGREGAR LA RUTA DE SOPORTE */}
        <Route path="/soporte" element={
          <ProtectedRoute>
            <ChatSoporte />
          </ProtectedRoute>
        } />

        {/* --- 3. NUEVA RUTA PROTEGIDA: FIRMA --- */}
        <Route
          path="/firma"
          element={
            <ProtectedRoute>
              <FirmaPage />
            </ProtectedRoute>
          }
        />

        <Route path="/soporte" element={
          <ProtectedRoute>
            <ChatSoporte />
          </ProtectedRoute>
        } />

        <Route path="/billetera" element={<ProtectedRoute><MiBilletera /></ProtectedRoute>} />

        {/* La ruta antigua "/revision/:casoId" ya no es necesaria */}

        <Route
          path="/caso/:id"
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
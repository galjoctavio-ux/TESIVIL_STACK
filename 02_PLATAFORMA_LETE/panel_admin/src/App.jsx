import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MapeoPrecios from './pages/MapeoPrecios';
import GestionMateriales from './pages/GestionMateriales';
import CotizacionesList from './pages/CotizacionesList';
import ConfiguracionFinanciera from './pages/ConfiguracionFinanciera';
import EditarCotizacion from './pages/EditarCotizacion'; // <--- IMPORTACIÓN CORRECTA AQUÍ ARRIBA
import ProtectedRoute from './components/ProtectedRoute';
import ConfiguracionPagos from './pages/ConfiguracionPagos';
import GestionFinanciera from './pages/GestionFinanciera';
import CrmDashboard from './pages/CrmDashboard';
import CrmDashboardV2 from './pages/CrmDashboardV2.jsx';
import './App.css';
import './responsive.css';

function App() {
  return (
    <Routes>
      {/* Ruta Pública */}
      <Route path="/" element={<Login />} />

      {/* Rutas Protegidas */}
      <Route
        path="/dashboard"
        element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
      />
      <Route
        path="/costos"
        element={<ProtectedRoute><MapeoPrecios /></ProtectedRoute>}
      />
      <Route
        path="/materiales"
        element={
          <ProtectedRoute>
            <GestionMateriales />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cotizaciones"
        element={
          <ProtectedRoute>
            <CotizacionesList />
          </ProtectedRoute>
        }
      />
      <Route path="/finanzas-gestion" element={<ProtectedRoute allowedRoles={['admin', 'superadmin']}><GestionFinanciera /></ProtectedRoute>} />

      {/* RUTA DE EDICIÓN MAESTRA (NUEVA) */}
      <Route
        path="/cotizaciones/editar/:id"
        element={
          <ProtectedRoute>
            <EditarCotizacion />
          </ProtectedRoute>
        }
      />

      <Route
        path="/configuracion"
        element={<ProtectedRoute><ConfiguracionFinanciera /></ProtectedRoute>}
      />

      <Route
        path="/pagos-config"
        element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            <ConfiguracionPagos />
          </ProtectedRoute>
        }
      />

      <Route
        path="/crm"
        element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            <CrmDashboard />
          </ProtectedRoute>
        }
      />

      {/* 2. AGREGA ESTA NUEVA RUTA AQUÍ */}
      <Route
        path="/crm-v2"
        element={
          <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
            <CrmDashboardV2 />
          </ProtectedRoute>
        }
      />

      {/* Ruta 404 */}
      <Route path="*" element={
        <div style={{ padding: '50px', textAlign: 'center' }}>
          <h2>404 - Página no encontrada</h2>
          <Link to="/dashboard" style={{ color: '#007bff' }}>Volver al Dashboard</Link>
        </div>
      } />

    </Routes>
  );
}

export default App;
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link } from 'react-router-dom';
import CasosList from '../components/CasosList.jsx';
import Modal from '../components/Modal.jsx';
import CrearCasoForm from '../components/CrearCasoForm.jsx';
import TecnicosList from '../components/TecnicosList.jsx';
import CrearTecnicoForm from '../components/CrearTecnicoForm.jsx';
import AgendarCasoForm from '../components/AgendarCasoForm.jsx';

function Dashboard() {
  const { user, logout } = useAuth();

  const [isCasoModalOpen, setIsCasoModalOpen] = useState(false);
  const [isTecnicoModalOpen, setIsTecnicoModalOpen] = useState(false);
  const [isAgendarModalOpen, setIsAgendarModalOpen] = useState(false);
  const [selectedCaso, setSelectedCaso] = useState(null);
  const [refreshCasosKey, setRefreshCasosKey] = useState(0);
  const [refreshTecnicosKey, setRefreshTecnicosKey] = useState(0);

  const handleCasoActualizado = () => setRefreshCasosKey(prev => prev + 1);
  const handleTecnicoActualizado = () => setRefreshTecnicosKey(prev => prev + 1);

  const openAgendarModal = (caso) => {
    setSelectedCaso(caso);
    setIsAgendarModalOpen(true);
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Dashboard de Administración</h1>
        <div className="header-user-info">
          <span>
            ¡Bienvenido, <strong>{user?.nombre || 'Admin'}</strong>!
          </span>
          <button onClick={logout} className="secondary-button">
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main>
        {/* --- BARRA DE NAVEGACIÓN RÁPIDA --- */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <Link
            to="/costos"
            className="main-button"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}
          >
            💰 Gestión XML y Costos
          </Link>

          <Link
            to="/materiales"
            className="main-button"
            style={{ background: '#17a2b8', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}
          >
            🗄️ Inventario Materiales
          </Link>

          <Link
            to="/cotizaciones"
            className="main-button"
            style={{ background: '#28a745', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}
          >
            📊 Ver Cotizaciones
          </Link>

          <Link
            to="/pagos-config"
            className="main-button"
            style={{
              background: '#6f42c1', /* Color Púrpura para diferenciarlo */
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '200px',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            🛠️ Tarifas Técnicos
          </Link>

          <Link
            to="/finanzas-gestion"
            className="main-button"
            style={{ background: '#2c3e50', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '200px' }}
          >
            🏦 Autorizar Pagos y Bonos
          </Link>

          <Link
            to="/crm"
            className="main-button"
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', /* Degradado Morado IA */
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '200px',
              color: 'white',
              fontWeight: 'bold',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            🧠 CRM Inteligente
          </Link>

          <Link
            to="/configuracion"
            style={{ display: 'flex', alignItems: 'center', padding: '10px', background: '#333', color: 'white', borderRadius: '5px', textDecoration: 'none' }}
          >
            ⚙️ Configuración Financiera
          </Link>
        </div>

        {/* --- GESTIÓN DE CASOS --- */}
        <div className="card">
          <div className="card-header">
            <h2>Gestión de Casos</h2>
            <button onClick={() => setIsCasoModalOpen(true)} className="main-button">
              + Crear Nuevo Caso
            </button>
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '5px' }}>
            <CasosList
              key={refreshCasosKey}
              onDatosActualizados={handleCasoActualizado}
              onAgendarClick={openAgendarModal}
            />
          </div>
        </div>

        {/* --- GESTIÓN DE TÉCNICOS --- */}
        <div className="card">
          <div className="card-header">
            <h2>Gestión de Técnicos</h2>
            <button onClick={() => setIsTecnicoModalOpen(true)} className="main-button">
              + Crear Nuevo Técnico
            </button>
          </div>
          {/* La funcionalidad de notificación ahora está dentro de TecnicosList */}
          <TecnicosList key={refreshTecnicosKey} onTecnicoActualizado={handleTecnicoActualizado} />
        </div>
      </main>

      {/* --- MODALES --- */}
      <Modal isOpen={isCasoModalOpen} onClose={() => setIsCasoModalOpen(false)}>
        <CrearCasoForm onClose={() => setIsCasoModalOpen(false)} onCasoCreado={handleCasoActualizado} />
      </Modal>

      <Modal isOpen={isTecnicoModalOpen} onClose={() => setIsTecnicoModalOpen(false)}>
        <CrearTecnicoForm onClose={() => setIsTecnicoModalOpen(false)} onTecnicoCreado={handleTecnicoActualizado} />
      </Modal>

      {selectedCaso && (
        <Modal isOpen={isAgendarModalOpen} onClose={() => setIsAgendarModalOpen(false)}>
          <AgendarCasoForm caso={selectedCaso} onClose={() => setIsAgendarModalOpen(false)} onCitaCreada={handleCasoActualizado} />
        </Modal>
      )}
    </div>
  );
}

export default Dashboard;
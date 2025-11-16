import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  obtenerListadoCotizaciones,
  aplicarDescuento,
  autorizarCotizacion,
  rechazarCotizacion,
  finalizarProyecto,
  clonarCotizacion,
  reenviarCorreo,
  powerCloneCotizacion
} from '../apiService';
import DetalleCotizacionModal from '../components/DetalleCotizacionModal';
import CierreProyectoModal from '../components/CierreProyectoModal';
import PowerCloneModal from '../components/PowerCloneModal';
import AutorizarCotizacionModal from '../components/AutorizarCotizacionModal';

const CotizacionesList = () => {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mensaje, setMensaje] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [cotizacionEnRevision, setCotizacionEnRevision] = useState(null);
  const [cotizacionACerrar, setCotizacionACerrar] = useState(null);
  const [cotizacionAClonar, setCotizacionAClonar] = useState(null);
  const [cotizacionAAutorizar, setCotizacionAAutorizar] = useState(null);

  useEffect(() => {
    cargarCotizaciones();
  }, []);

  const cargarCotizaciones = async () => {
    setLoading(true);
    try {
      const res = await obtenerListadoCotizaciones();
      if (res.status === 'success') {
        const dataSanitized = res.data.map(c => ({...c, descuento_pct: c.descuento_pct || 0}));
        setCotizaciones(dataSanitized);
      }
    } catch (error) {
      setMensaje(`Error al cargar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // --- ACCIONES ---

  const handleDescuentoClick = async (cotizacionId, descuentoActual) => {
    const nuevoPct = window.prompt("Ingresa el nuevo porcentaje de descuento:", descuentoActual > 0 ? descuentoActual : '');
    if (nuevoPct === null) return;
    try {
      const res = await aplicarDescuento(cotizacionId, parseFloat(nuevoPct) || 0);
      if (res.status === 'success') {
        setMensaje(`✅ ${res.message}`);
        cargarCotizaciones();
      } else { alert(res.error); }
    } catch (error) { alert(error.message); }
  };

  const handleAutorizar = async (id) => {
    if(!window.confirm("¿Aprobar y enviar al cliente?")) return;
    setMensaje("Procesando...");
    try {
      const res = await autorizarCotizacion(id);
      if (res.status === 'success') {
        setMensaje(`✅ ${res.message}`);
        setCotizacionEnRevision(null);
        cargarCotizaciones();
      } else { alert("Error: " + res.error); }
    } catch (error) { alert("Error: " + error.message); }
  };

  const handleRechazar = async (id) => {
    if(!window.confirm("¿Rechazar cotización?")) return;
    try {
      await rechazarCotizacion(id);
      setCotizacionEnRevision(null);
      cargarCotizaciones();
    } catch (error) { alert("Error: " + error.message); }
  };

  const handleFinalizar = async (id, gastoMat, gastoMo) => {
    try {
      const res = await finalizarProyecto(id, gastoMat, gastoMo);
      if (res.status === 'success') {
        setMensaje(`🏁 Proyecto #${id} completado exitosamente.`);
        setCotizacionACerrar(null);
        cargarCotizaciones();
      } else { alert("Error: " + res.error); }
    } catch (error) { alert("Error: " + error.message); }
  };

  const handleClonar = (id) => {
    setCotizacionAClonar(id);
  };

  const handleCloned = async (cotizacionClonada) => {
    setMensaje("Clonando y creando nueva versión...");
    try {
      const res = await powerCloneCotizacion(cotizacionClonada);
      if (res.status === 'success') {
        setMensaje(`✅ ${res.data.mensaje}`);
        cargarCotizaciones();
      } else {
        alert("Error al clonar: " + (res.error || "Desconocido"));
      }
      setCotizacionAClonar(null);
    } catch (error) {
      alert("Error de conexión: " + error.message);
    }
  };

  const handleReenviar = async (id) => {
    if(!window.confirm("¿Reenviar el correo al cliente?")) return;
    setMensaje("Enviando correo...");
    try {
      const res = await reenviarCorreo(id);
      if (res.status === 'success') {
        setMensaje(`✅ ${res.message}`);
      } else {
        alert("Error: " + res.error);
      }
    } catch (error) {
      alert("Error: " + error.message);
    }
  };

  // --- RENDERIZADO ---

  const getStatusBadge = (estado) => {
    switch (estado) {
        case 'PENDIENTE_AUTORIZACION': return <span style={{background:'#ffc107',color:'#000',padding:'4px 8px',borderRadius:'4px',fontSize:'0.85em',fontWeight:'bold'}}>⚠️ REVISIÓN</span>;
        case 'ENVIADA': return <span style={{background:'#28a745',color:'#fff',padding:'4px 8px',borderRadius:'4px',fontSize:'0.85em'}}>✅ ENVIADA</span>;
        case 'COMPLETADA': return <span style={{background:'#343a40',color:'#fff',padding:'4px 8px',borderRadius:'4px',fontSize:'0.85em'}}>🏁 COMPLETADA</span>;
        case 'RECHAZADA': return <span style={{background:'#dc3545',color:'#fff',padding:'4px 8px',borderRadius:'4px',fontSize:'0.85em'}}>❌ RECHAZADA</span>;
        default: return <span style={{background:'#6c757d',color:'#fff',padding:'4px 8px',borderRadius:'4px',fontSize:'0.85em'}}>{estado}</span>;
    }
  };

  const formatCurrency = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num || 0);
  const formatDate = (dateString) => {
    if (!dateString) return 'Fecha no disponible';
    try {
      const date = new Date(dateString);
      // Fallback por si la fecha es inválida
      if (isNaN(date.getTime())) {
        return 'Fecha inválida';
      }
      return new Intl.DateTimeFormat('es-MX', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/Mexico_City',
      }).format(date);
    } catch (error) {
      console.error("Error formatting date:", dateString, error);
      return 'Fecha inválida';
    }
  };

  const filteredCotizaciones = cotizaciones.filter(coti => {
    const searchTermLower = (searchTerm || '').toLowerCase();
    const folio = coti.id ? coti.id.toString() : '';
    const cliente = (coti.cliente_nombre || '').toLowerCase();
    const asesor = ((coti.asesor_nombre || coti.tecnico_nombre) || '').toLowerCase();

    return folio.includes(searchTermLower) ||
           cliente.includes(searchTermLower) ||
           asesor.includes(searchTermLower);
  });

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>📊 Tablero de Cotizaciones</h2>
        <Link to="/dashboard" style={{ textDecoration: 'none', color: '#007bff' }}>&larr; Dashboard</Link>
      </div>

      <input
        type="text"
        placeholder="🔍 Buscar cotización..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ width: '100%', padding: '10px', marginBottom: '20px', border: '1px solid #ccc', borderRadius: '4px' }}
      />

      {mensaje && <div style={{ padding: '10px', marginBottom: '15px', background: '#d4edda', color: '#155724', borderRadius: '5px' }}>{mensaje}</div>}

      {loading ? <p>Cargando...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: '#343a40', color: 'white', textAlign: 'left' }}>
              <th style={{ padding: '12px' }}>Estado</th>
              <th style={{ padding: '12px' }}>Fecha</th>
              <th style={{ padding: '12px' }}>Cliente</th>
              <th style={{ padding: '12px' }}>Asesor</th>
              <th style={{ padding: '12px' }}>Total Venta</th>
              <th style={{ padding: '12px', background:'#555', borderLeft:'1px solid #666' }}>Costo Mat.</th>
              <th style={{ padding: '12px' }}>Desc.</th>
              <th style={{ padding: '12px' }}>IA (Est)</th>
              <th style={{ padding: '12px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredCotizaciones.map((coti) => (
              <tr key={coti.id} style={{ borderBottom: '1px solid #eee', background: coti.estado === 'PENDIENTE_AUTORIZACION' ? '#fffdf0' : (coti.estado === 'COMPLETADA' ? '#f8f9fa' : 'white') }}>
                <td style={{ padding: '12px' }}>{getStatusBadge(coti.estado)}</td>
                <td style={{ padding: '12px' }}><small>{formatDate(coti.fecha_creacion)}</small></td>
                <td style={{ padding: '12px' }}>
                    <div>{coti.cliente_nombre}</div>
                </td>
                <td style={{ padding: '12px' }}>
                    <small style={{color:'#555'}}>{coti.asesor_nombre || coti.tecnico_nombre}</small>
                </td>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>{formatCurrency(coti.precio_venta_final)}</td>

                <td style={{ padding: '12px', color:'#555', fontSize:'0.9em', borderLeft:'1px solid #eee' }}>
                    {formatCurrency(coti.total_materiales_cd)}
                </td>

                <td style={{ padding: '12px', color: parseFloat(coti.descuento_pct) > 0 ? '#dc3545' : '#ccc', fontWeight: 'bold' }}>
                    {parseFloat(coti.descuento_pct) > 0 ? `-${coti.descuento_pct}%` : '0%'}
                </td>
                <td style={{ padding: '12px', color: '#666', fontSize: '0.9em' }}>
                    {coti.estimacion_ia ? formatCurrency(coti.estimacion_ia) : '-'}
                </td>
                <td style={{ padding: '12px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>

                  {/* REVISAR (Pendientes) */}
                  {coti.estado === 'PENDIENTE_AUTORIZACION' && (
                    <>
                      <button onClick={() => setCotizacionEnRevision(coti)} title="Revisar Alerta" style={{ padding: '6px 8px', background: '#ffc107', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        🔍
                      </button>
                      <button onClick={() => setCotizacionAAutorizar(coti)} title="Autorizar y Agendar" style={{ padding: '6px 8px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        📅
                      </button>
                    </>
                  )}

                  {/* FINALIZAR / REENVIAR (Enviadas/Autorizadas) */}
                  {(coti.estado === 'ENVIADA' || coti.estado === 'AUTORIZADA') && (
                    <>
                        <button onClick={() => setCotizacionACerrar(coti)} title="Finalizar Proyecto" style={{ padding: '6px 8px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          🏁
                        </button>
                        <button onClick={() => handleReenviar(coti.id)} title="Reenviar Correo" style={{ padding: '6px 8px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                          ✉️
                        </button>
                    </>
                  )}

                  {/* DETALLES (antes Editar) */}
                  <Link to={`/cotizaciones/editar/${coti.id}`} title="Ver Detalles" style={{ padding: '6px 8px', background: '#17a2b8', color: 'white', borderRadius: '4px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', border: 'none', cursor: 'pointer' }}>
                    👁️
                  </Link>

                  {/* CLONAR */}
                  <button onClick={() => handleClonar(coti.id)} title="Clonar Cotización (Versión B)" style={{ padding: '6px 8px', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    ♻️
                  </button>

                  {/* OTROS */}
                  <button onClick={() => handleDescuentoClick(coti.id, coti.descuento_pct)} title="Descuento" style={{ padding: '6px 8px', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>💲</button>
                  <a href={`/api/cotizar/pdf?uuid=${coti.uuid}`} target="_blank" rel="noopener noreferrer" title="Ver PDF" style={{ padding: '6px 8px', background: '#6c757d', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>📄</a>
                  <a href={`/api/cotizacion/exportar?id=${coti.id}`} target="_blank" rel="noopener noreferrer" title="Exportar Lista" style={{ padding: '6px 8px', background: '#007bff', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>📦</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {cotizacionEnRevision && <DetalleCotizacionModal cotizacion={cotizacionEnRevision} onClose={() => setCotizacionEnRevision(null)} onAutorizar={handleAutorizar} onRechazar={handleRechazar} />}
      {cotizacionACerrar && <CierreProyectoModal cotizacion={cotizacionACerrar} onClose={() => setCotizacionACerrar(null)} onFinalizar={handleFinalizar} />}
      {cotizacionAClonar && <PowerCloneModal cotizacionId={cotizacionAClonar} onClose={() => setCotizacionAClonar(null)} onCloned={handleCloned} />}
      {cotizacionAAutorizar && (
        <AutorizarCotizacionModal
          cotizacion={cotizacionAAutorizar}
          onClose={() => setCotizacionAAutorizar(null)}
          onConfirm={() => {
            setCotizacionAAutorizar(null);
            cargarCotizaciones();
          }}
        />
      )}
    </div>
  );
};

export default CotizacionesList;
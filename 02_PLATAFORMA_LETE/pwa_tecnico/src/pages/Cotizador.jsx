import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { crearRecursoTecnico, obtenerSugerenciasIA, obtenerRecursos } from '../apiService';

// --- IMPORTS PARA MODO OFFLINE ---
import { guardarBorrador, obtenerBorrador, eliminarBorrador, encolarParaEnvio } from '../db';
import { syncManager } from '../services/SyncManager';

// Clave única para guardar el borrador de este formulario
const DRAFT_KEY = 'cotizacion_activa';

// --- Componente ModalCrear (Sin cambios, tal cual lo tenías) ---
const ModalCrear = ({ alCerrar, alGuardar }) => {
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('');
  const [precioTotal, setPrecioTotal] = useState('');

  const handleGuardar = async () => {
    if (!nombre || !unidad || !precioTotal) return alert("Completa todos los campos");
    try {
      // Llamamos a la API con el precio total
      const res = await crearRecursoTecnico(nombre, unidad, parseFloat(precioTotal));
      if (res.status === 'success') {
        alGuardar(res.data);
      } else {
        alert("Error: " + res.error);
      }
    } catch (err) {
      alert("Error de conexión al crear. Intenta cuando tengas internet.");
    }
  };

  // Estilo para que no se desborde en celulares
  const inputModalStyle = {
    width: '100%', padding: '10px', marginBottom: '10px',
    border: '1px solid #ddd', borderRadius: '5px', boxSizing: 'border-box'
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', width: '100%', maxWidth: '400px' }}>
        <h3>Crear Material Nuevo</h3>
        <p style={{ fontSize: '0.9em', color: '#666' }}>Este material se guardará como "Pendiente".</p>

        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del Material" style={inputModalStyle} />
        <input type="text" value={unidad} onChange={e => setUnidad(e.target.value)} placeholder="Unidad (pza, m...)" style={inputModalStyle} />
        <input
          type="number"
          value={precioTotal}
          onChange={e => setPrecioTotal(e.target.value)}
          placeholder="Precio Total (con IVA)"
          style={inputModalStyle}
        />

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button onClick={alCerrar} style={{ flex: 1, padding: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px' }}>Cancelar</button>
          <button onClick={handleGuardar} style={{ flex: 1, padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>Guardar</button>
        </div>
      </div>
    </div>
  );
};

const Cotizador = () => {
  const { user } = useAuth();
  const navigate = useNavigate(); // Hook para navegar atrás
  const location = useLocation();

  // Estados de Datos
  const [casoId, setCasoId] = useState(null);
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');

  // Estados de UI y Carrito
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [materialSeleccionado, setMaterialSeleccionado] = useState(null);
  const [cantidad, setCantidad] = useState('');
  const [itemsCarrito, setItemsCarrito] = useState([]);

  const [moItems, setMoItems] = useState([]);
  const [moDescripcion, setMoDescripcion] = useState('');
  const [moHoras, setMoHoras] = useState('');

  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Estado para saber si ya cargamos la BD local
  const [isLoadedFromDB, setIsLoadedFromDB] = useState(false);

  // IA
  const [aiSugerencias, setAiSugerencias] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  // 1. CARGA INICIAL (Catálogo + Borrador Local + Navegación)
  useEffect(() => {
    const init = async () => {
      // A) Intentar cargar catálogo (si falla, no rompe la app)
      try {
        const res = await obtenerRecursos();
        if (res.status === 'success') {
          setCatalogo(res.data);
        }
      } catch (err) {
        console.warn("Offline: No se pudo cargar catálogo. Usando versión cacheada si existe.");
      } finally {
        setLoading(false);
      }

      // B) Cargar Borrador guardado en IndexedDB
      try {
        const borrador = await obtenerBorrador(DRAFT_KEY);
        // Solo restauramos el borrador si NO venimos de una redirección con datos nuevos (location.state)
        if (borrador && borrador.data && !location.state) {
          const d = borrador.data;
          setCasoId(d.casoId || null);
          setClienteNombre(d.clienteNombre || '');
          setClienteEmail(d.clienteEmail || '');
          setClienteDireccion(d.clienteDireccion || '');
          setClienteTelefono(d.clienteTelefono || '');
          setItemsCarrito(d.itemsCarrito || []);
          setMoItems(d.moItems || []);
          console.log("✅ Borrador restaurado desde celular");
        }
      } catch (e) {
        console.error("Error leyendo borrador:", e);
      }

      // Marcamos que ya terminamos de cargar de la BD
      setIsLoadedFromDB(true);
    };

    init();
  }, []); // Se ejecuta solo una vez al montar

  // 2. PROCESAR DATOS DE NAVEGACIÓN (Prioridad sobre borrador)
  useEffect(() => {
    // Esperamos a que la carga de BD termine para no sobrescribir incorrectamente
    if (location.state && isLoadedFromDB) {
      const { casoId, clienteNombre, clienteDireccion, clienteTelefono } = location.state;
      if (casoId) setCasoId(casoId);
      if (clienteNombre) setClienteNombre(clienteNombre);
      if (clienteDireccion) setClienteDireccion(clienteDireccion);
      if (clienteTelefono) setClienteTelefono(clienteTelefono);
    }
  }, [location.state, isLoadedFromDB]);

  // 3. AUTO-GUARDADO (Guarda en local cada vez que cambia algo)
  useEffect(() => {
    if (!isLoadedFromDB) return; // No guardar hasta haber cargado

    const timer = setTimeout(() => {
      const datosActuales = {
        casoId,
        clienteNombre,
        clienteEmail,
        clienteDireccion,
        clienteTelefono,
        itemsCarrito,
        moItems
      };
      guardarBorrador(DRAFT_KEY, datosActuales);
      // console.log("Auto-guardado en local...");
    }, 1000); // Debounce de 1 segundo

    return () => clearTimeout(timer);
  }, [casoId, clienteNombre, clienteEmail, clienteDireccion, clienteTelefono, itemsCarrito, moItems, isLoadedFromDB]);


  // --- FUNCIÓN MANUAL DE IA ---
  const handlePedirSugerencias = async () => {
    if (itemsCarrito.length === 0) {
      alert("Agrega materiales al carrito primero.");
      return;
    }
    setAiLoading(true);
    setAiSugerencias([]);
    try {
      const nombres = itemsCarrito.map(item => item.nombre);
      const res = await obtenerSugerenciasIA(nombres);
      if (res.status === 'success') {
        setAiSugerencias(res.sugerencias);
      }
    } catch (e) {
      console.error(e);
      alert("Sin conexión para consultar IA.");
    } finally {
      setAiLoading(false);
    }
  };

  // --- Lógica de Materiales ---
  const handleBuscar = (texto) => {
    setBusqueda(texto);
    if (texto.length > 0) {
      const filtrados = catalogo.filter(item => item.nombre.toLowerCase().includes(texto.toLowerCase()));
      setSugerencias(filtrados.slice(0, 10));
    } else { setSugerencias([]); }
  };

  const seleccionarMaterial = (item) => {
    setMaterialSeleccionado(item);
    setBusqueda(''); setSugerencias([]);
  };

  const cancelarSeleccion = () => {
    setMaterialSeleccionado(null);
  };

  const agregarItem = (material, cant) => {
    if (!material || !cant || parseFloat(cant) <= 0) return;
    const nuevoItem = {
      id_recurso: material.id,
      nombre: material.nombre,
      unidad: material.unidad,
      cantidad: parseFloat(cant),
      tiempo_instalacion_min: material.tiempo_instalacion_min
    };
    setItemsCarrito([...itemsCarrito, nuevoItem]);
    setMaterialSeleccionado(null);
    setCantidad('');
    setAiSugerencias([]);
  };

  const eliminarItem = (index) => {
    const lista = [...itemsCarrito];
    lista.splice(index, 1);
    setItemsCarrito(lista);
  };

  // --- Lógica de Mano de Obra ---
  const agregarTareaMO = () => {
    if (!moDescripcion || !moHoras || parseFloat(moHoras) <= 0) {
      setError("Faltan datos de la tarea.");
      return;
    }
    setError('');
    const nuevaTarea = { descripcion: moDescripcion, horas: parseFloat(moHoras) };
    setMoItems([...moItems, nuevaTarea]);
    setMoDescripcion('');
    setMoHoras('');
  };

  const eliminarTareaMO = (index) => {
    const lista = [...moItems];
    lista.splice(index, 1);
    setMoItems(lista);
  };

  // --- LÓGICA DE ENVÍO (MODO OFFLINE-FIRST) ---
  const handleEnviar = async () => {
    if (moItems.length === 0 || !clienteEmail) {
      setError("Faltan datos: Tareas o Email.");
      return;
    }

    // 1. Cálculo de Tiempos para la Alerta
    let tiempoMaterialesMin = 0;
    itemsCarrito.forEach(item => {
      tiempoMaterialesMin += item.cantidad * (item.tiempo_instalacion_min || 0);
    });

    let tiempoTecnicoMin = 0;
    moItems.forEach(tarea => {
      tiempoTecnicoMin += tarea.horas * 60;
    });

    const tiempoMaterialesHoras = (tiempoMaterialesMin / 60).toFixed(1);
    const tiempoTecnicoHoras = (tiempoTecnicoMin / 60).toFixed(1);

    // 2. La Alerta
    if (itemsCarrito.length > 0 && tiempoTecnicoMin < tiempoMaterialesMin) {
      let mensaje = `🟡 ALERTA DE TIEMPO 🔴\n\n`;
      mensaje += `Tiempo estimado (Materiales): ${tiempoMaterialesHoras} horas\n`;
      mensaje += `Tiempo capturado (Técnico): ${tiempoTecnicoHoras} horas\n\n`;
      mensaje += `Estás cotizando MENOS tiempo del sugerido.\n\n`;
      mensaje += `¿Continuar y enviar de todos modos?`;

      if (!window.confirm(mensaje)) {
        return; // Cancelar envío
      }
    }

    setError('');
    setEnviando(true);

    // Preparamos el payload exacto para el Backend
    const payload = {
      tecnico_id: user?.email || 'sistema@lete.com',
      tecnico_nombre: user?.nombre || user?.user_metadata?.name || 'Ingeniero',
      cliente_nombre: clienteNombre,
      cliente_email: clienteEmail,
      cliente_direccion: clienteDireccion,
      cliente_telefono: clienteTelefono,
      caso_id: casoId,
      items: itemsCarrito.map(i => ({ id_recurso: i.id_recurso, cantidad: i.cantidad })),
      mano_de_obra: moItems
    };

    try {
      // A) GUARDAR EN COLA LOCAL (IndexedDB)
      await encolarParaEnvio('cotizacion', payload);

      // B) ELIMINAR BORRADOR (Porque ya se finalizó)
      await eliminarBorrador(DRAFT_KEY);

      // C) DISPARAR SINCRONIZACIÓN (Intento de subida en segundo plano)
      syncManager.procesarCola();

      // D) FEEDBACK INMEDIATO Y SALIDA
      alert('✅ Cotización guardada.\n\nEl sistema la procesará y notificará al cliente en cuanto se genere el PDF.\n\nPuedes continuar con otras tareas.');

      navigate('/'); // Nos vamos al inicio

    } catch (err) {
      console.error(err);
      setError("Error crítico al guardar en disco local.");
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <div className="p-4">Cargando...</div>;

  // Estilo común
  const commonInputStyle = {
    width: '100%', padding: '10px', border: '1px solid #ccc',
    borderRadius: '5px', boxSizing: 'border-box'
  };

  return (
    <>
      {showModal && <ModalCrear alCerrar={() => setShowModal(false)} alGuardar={(nuevo) => { setShowModal(false); setMaterialSeleccionado(nuevo); }} />}

      <div style={{ padding: '15px', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>

        {/* CABECERA CON BOTÓN VOLVER */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', marginRight: '10px' }}>⬅️</button>
          <h2 style={{ margin: 0 }}>⚡ Cotizador (Offline)</h2>
        </div>

        {/* DATOS CLIENTE */}
        <div className="card" style={{ background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '15px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.9em', color: '#666' }}>Cliente (Opcional)</label>
            <input
              type="text"
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              style={commonInputStyle}
              placeholder="Nombre del cliente"
              disabled={!!casoId}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.9em', color: '#666' }}>Dirección (Opcional)</label>
            <input
              type="text"
              value={clienteDireccion}
              onChange={(e) => setClienteDireccion(e.target.value)}
              style={commonInputStyle}
              placeholder="Dirección del cliente"
              disabled={!!casoId}
            />
          </div>

          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.9em', color: '#666' }}>Teléfono (Opcional)</label>
            <input
              type="text"
              value={clienteTelefono}
              onChange={(e) => setClienteTelefono(e.target.value)}
              style={commonInputStyle}
              placeholder="Teléfono del cliente"
              disabled={!!casoId}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9em', color: '#D32F2F', fontWeight: 'bold' }}>Email del Cliente (Obligatorio)</label>
            <input
              type="email"
              value={clienteEmail}
              onChange={(e) => setClienteEmail(e.target.value)}
              style={{
                ...commonInputStyle,
                borderColor: (error && !clienteEmail) ? '#D32F2F' : '#ccc'
              }}
              placeholder="correo@cliente.com"
            />
          </div>
        </div>

        {/* MANO DE OBRA */}
        <div className="card" style={{ background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '15px' }}>
          <h4 style={{ marginTop: 0 }}>⏱️ Tareas de Mano de Obra</h4>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input type="text" value={moDescripcion} onChange={(e) => setMoDescripcion(e.target.value)} placeholder="Descripción" style={{ ...commonInputStyle, flex: 3 }} />
            <input type="number" value={moHoras} onChange={(e) => setMoHoras(e.target.value)} placeholder="Hrs" style={{ ...commonInputStyle, flex: 1 }} />
          </div>
          <button onClick={agregarTareaMO} style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px' }}>+ Agregar Tarea</button>

          <ul style={{ listStyle: 'none', padding: 0, marginTop: '10px' }}>
            {moItems.map((item, idx) => (
              <li key={idx} style={{ background: '#f8f9fa', padding: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <div><span style={{ fontWeight: 'bold', marginRight: '5px' }}>{item.horas} h</span> {item.descripcion}</div>
                <button onClick={() => eliminarTareaMO(idx)} style={{ color: '#dc3545', border: 'none', background: 'none', fontSize: '18px' }}>&times;</button>
              </li>
            ))}
          </ul>
        </div>

        {/* MATERIALES */}
        <div className="card" style={{ background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '15px' }}>
          <h4 style={{ marginTop: 0 }}>📦 Agregar Material</h4>
          {!materialSeleccionado ? (
            <div style={{ position: 'relative' }}>
              <input type="text" value={busqueda} onChange={(e) => handleBuscar(e.target.value)} placeholder="🔍 Buscar..." style={commonInputStyle} />
              {sugerencias.length > 0 && (
                <ul style={{ position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ddd', listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px', overflowY: 'auto' }}>
                  {sugerencias.map(item => (
                    <li key={item.id} onClick={() => seleccionarMaterial(item)} style={{ padding: '10px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
                      <strong>{item.nombre}</strong> ({item.unidad})
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setShowModal(true)} style={{ width: '100%', padding: '10px', marginTop: '10px', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px' }}>+ Crear Nuevo</button>
            </div>
          ) : (
            <div style={{ background: '#e3f2fd', padding: '10px', borderRadius: '4px', border: '1px solid #90caf9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <strong>{materialSeleccionado.nombre}</strong>
                <button onClick={cancelarSeleccion} style={{ color: 'red', background: 'none', border: 'none' }}>Cancelar</button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input id="input-cantidad" type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cant." style={{ ...commonInputStyle, flex: 1 }} />
                <button onClick={() => agregarItem(materialSeleccionado, cantidad)} style={{ flex: 1, background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Agregar</button>
              </div>
            </div>
          )}
        </div>

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {itemsCarrito.map((item, idx) => (
            <li key={idx} style={{ background: 'white', padding: '10px', marginBottom: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <div><span style={{ fontWeight: 'bold', fontSize: '1.1em', marginRight: '5px' }}>{item.cantidad} {item.unidad}</span> {item.nombre}</div>
              <button onClick={() => eliminarItem(idx)} style={{ color: '#dc3545', border: 'none', background: 'none', fontSize: '18px' }}>&times;</button>
            </li>
          ))}
        </ul>

        {/* BOTÓN IA MANUAL */}
        {itemsCarrito.length > 0 && (
          <div style={{ textAlign: 'center', margin: '20px 0' }}>
            <button onClick={handlePedirSugerencias} disabled={aiLoading} style={{ background: 'none', border: '2px solid #6f42c1', color: '#6f42c1', padding: '8px 20px', borderRadius: '30px', cursor: 'pointer' }}>
              {aiLoading ? '🧠 Analizando...' : '✨ ¿Sugerencias IA?'}
            </button>
          </div>
        )}

        {aiSugerencias.length > 0 && !aiLoading && (
          <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <h5 style={{ color: '#0d47a1', margin: 0, marginBottom: '10px' }}>🧠 Sugerencias:</h5>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>{aiSugerencias.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        )}

        {error && <div style={{ color: 'red', marginTop: '10px', textAlign: 'center', fontWeight: 'bold' }}>{error}</div>}

        <div style={{ marginTop: '30px' }}>
          {enviando ? (
            <div className="spinner-container">
              <div className="spinner"></div>
              <p><strong>Guardando en cola de envío...</strong></p>
            </div>
          ) : (
            <button
              onClick={handleEnviar}
              disabled={enviando}
              style={{ width: '100%', padding: '15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold' }}
            >
              ➡️ Finalizar Cotización
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Cotizador;
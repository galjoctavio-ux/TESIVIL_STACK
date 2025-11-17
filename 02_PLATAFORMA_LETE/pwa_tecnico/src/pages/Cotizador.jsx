import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api, { guardarCotizacion, crearRecursoTecnico, obtenerSugerenciasIA, obtenerRecursos } from '../apiService';

// --- Componente ModalCrear (Con arreglos visuales) ---
const ModalCrear = ({ alCerrar, alGuardar }) => {
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('');
  const [precioTotal, setPrecioTotal] = useState(''); // <-- CAMBIADO

  const handleGuardar = async () => {
    if (!nombre || !unidad || !precioTotal) return alert("Completa todos los campos"); // <-- CAMBIADO
    try {
      // Llamamos a la API con el precio total
      const res = await crearRecursoTecnico(nombre, unidad, parseFloat(precioTotal)); // <-- CAMBIADO
      if (res.status === 'success') {
        alGuardar(res.data);
      } else {
        alert("Error: " + res.error);
      }
    } catch (err) {
      alert("Error de conexión al crear");
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
        <p style={{fontSize: '0.9em', color: '#666'}}>Este material se guardará como "Pendiente".</p>

        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del Material" style={inputModalStyle} />
        <input type="text" value={unidad} onChange={e => setUnidad(e.target.value)} placeholder="Unidad (pza, m...)" style={inputModalStyle} />
        <input
          type="number"
          value={precioTotal} // <-- CAMBIADO
          onChange={e => setPrecioTotal(e.target.value)} // <-- CAMBIADO
          placeholder="Precio Total (con IVA)" // <-- CAMBIADO
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
  const [casoId, setCasoId] = useState(null);

  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);

  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');

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
  const [resultadoEnvio, setResultadoEnvio] = useState(null);

  // IA
  const [aiSugerencias, setAiSugerencias] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (location.state) {
      const { casoId, clienteNombre, clienteDireccion } = location.state;
      if (casoId) {
        setCasoId(casoId);
      }
      if (clienteNombre) {
        setClienteNombre(clienteNombre);
      }
      if (clienteDireccion) {
        setClienteDireccion(clienteDireccion);
      }
    }
  }, [location.state]);

  useEffect(() => {
    const fetchRecursos = async () => {
      try {
        const res = await obtenerRecursos(); // <-- ¡CORRECTO!

        if (res.status === 'success') { // La respuesta de fetch ya viene como JSON
          setCatalogo(res.data);
        } else {
          setError("Error al cargar el catálogo de recursos.");
        }
      } catch (err) {
        setError("Error de conexión al cargar catálogo.");
      } finally {
        setLoading(false);
      }
    };
    fetchRecursos();
  }, []);

  // --- FUNCIÓN MANUAL DE IA (Ahorro de Tokens) ---
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
    } catch (e) { console.error(e); } finally { setAiLoading(false); }
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

  // ✅ CORRECCIÓN: Restauramos la función faltante
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
    setAiSugerencias([]); // Limpiar sugerencias viejas
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

  // --- LÓGICA DE ENVÍO ---
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

    try {
      const payload = {
        tecnico_id: user?.email || 'sistema@lete.com',
        tecnico_nombre: user?.user_metadata?.name || user?.name || 'Ingeniero',
        cliente_nombre: clienteNombre,
        cliente_email: clienteEmail,
        cliente_direccion: clienteDireccion,
        caso_id: casoId,
        items: itemsCarrito.map(i => ({ id_recurso: i.id_recurso, cantidad: i.cantidad })),
        mano_de_obra: moItems
      };

      const data = await guardarCotizacion(payload);

      if (data.status === 'success') {
        if (casoId) {
            try {
              await api.patch(`/casos/${casoId}`, { status: 'completado' });
            } catch (patchError) {
              console.error("Error al actualizar el caso a completado:", patchError);
              // Opcional: informar al usuario que la cotización se creó pero el caso no se actualizó.
            }
        }
        setResultadoEnvio({
            estado: data.estado_final || 'ENVIADA',
            mensaje: data.message
        });
      } else {
        setError(data.error || "Error al guardar.");
      }
    } catch (err) {
      setError("Error de conexión: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  if (loading) return <div className="p-4">Cargando...</div>;

  // --- PANTALLA DE RESULTADO ---
  if (resultadoEnvio) {
    const esRevision = resultadoEnvio.estado === 'PENDIENTE_AUTORIZACION';
    const estiloContenedor = esRevision
        ? { background: '#fff3cd', color: '#856404', border: '1px solid #ffeeba' }
        : { background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' };

    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', borderRadius: '8px', margin: '20px', ...estiloContenedor }}>
        <div style={{ fontSize: '50px', marginBottom: '10px' }}>{esRevision ? '⏳' : '✅'}</div>
        <h2>{esRevision ? 'En Revisión' : '¡Enviada!'}</h2>

        {!esRevision && <p style={{fontWeight:'bold'}}>{resultadoEnvio.mensaje}</p>}
        {!esRevision && <p>El cliente recibirá el PDF en su correo ({clienteEmail}) en breve.</p>}

        {esRevision && (
             <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.5)', padding: '15px', borderRadius: '8px', margin: '20px 0' }}>
                <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>📋 Estatus: Pendiente de Validación</p>
                <p style={{ fontSize: '0.9em', margin: 0 }}>Tu cotización requiere validación administrativa. No necesitas hacer nada más.</p>
             </div>
        )}

        <button onClick={() => window.location.reload()} style={{ padding: '12px 24px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', marginTop: '20px', cursor: 'pointer' }}>
          Nueva Cotización
        </button>
      </div>
    );
  }

  // Estilo común corregido (box-sizing)
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
            <button onClick={() => navigate('/casos')} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', marginRight: '10px' }}>⬅️</button>
            <h2 style={{ margin: 0 }}>⚡ Cotizador Rápido</h2>
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
              disabled={!!casoId} // Deshabilitar si viene de un caso
            />
          </div>

          {/* ======================================================= */}
          {/* ===========   AÑADIR CAMPO DE DIRECCIÓN   =========== */}
          {/* ======================================================= */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '0.9em', color: '#666' }}>Dirección (Opcional)</label>
            <input
              type="text"
              value={clienteDireccion}
              onChange={(e) => setClienteDireccion(e.target.value)}
              style={commonInputStyle}
              placeholder="Dirección del cliente"
              disabled={!!casoId} // Deshabilitar si viene de un caso
            />
          </div>
          {/* ======================================================= */}

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
          <h4 style={{marginTop:0}}>⏱️ Tareas de Mano de Obra</h4>
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
          <h4 style={{marginTop:0}}>📦 Agregar Material</h4>
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
                  <button onClick={cancelarSeleccion} style={{color:'red', background:'none', border:'none'}}>Cancelar</button>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input id="input-cantidad" type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cant." style={{...commonInputStyle, flex:1}} />
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
            <div style={{textAlign:'center', margin:'20px 0'}}>
                <button onClick={handlePedirSugerencias} disabled={aiLoading} style={{ background: 'none', border: '2px solid #6f42c1', color: '#6f42c1', padding: '8px 20px', borderRadius: '30px', cursor:'pointer' }}>
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
          <button
            onClick={handleEnviar}
            disabled={enviando}
            style={{ width: '100%', padding: '15px', background: enviando ? '#6c757d' : '#28a745', color: 'white', border: 'none', borderRadius: '8px', fontSize: '18px', fontWeight: 'bold', opacity: enviando ? 0.6 : 1 }}
          >
            {enviando ? 'Enviando...' : '➡️ Generar Cotización'}
          </button>
        </div>
      </div>
    </>
  );
};

export default Cotizador;
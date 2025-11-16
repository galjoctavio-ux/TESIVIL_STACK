import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { obtenerInventarioAdmin, updateRecurso, deleteRecurso, aprobarRecurso, crearRecurso } from '../apiService';
import Modal from 'react-modal'; // Usaremos un modal

// Estilos del Modal (para mantenerlo simple)
const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    width: '400px',
    padding: '20px'
  },
};

Modal.setAppElement('#root'); // Necesario para accesibilidad

const GestionMateriales = () => {
  const [recursos, setRecursos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState(null);

  // --- ESTADOS PARA NUEVO MODAL ---
  const [modalOpen, setModalOpen] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaUnidad, setNuevaUnidad] = useState('pza');
  const [nuevoPrecio, setNuevoPrecio] = useState(0);


  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    const res = await obtenerInventarioAdmin();
    if (res.status === 'success') setRecursos(res.data);
  };

  // --- LÓGICA DEL MODAL ---
  const handleAbrirModal = () => setModalOpen(true);
  const handleCerrarModal = () => setModalOpen(false);

  const handleCrearManual = async () => {
    if (!nuevoNombre || !nuevaUnidad) {
      alert("Nombre y unidad son requeridos.");
      return;
    }
    const res = await crearRecurso(nuevoNombre, nuevaUnidad, nuevoPrecio);
    if (res.status === 'success') {
      cargar(); // Recargamos la tabla
      handleCerrarModal();
      setNuevoNombre('');
      setNuevaUnidad('pza');
      setNuevoPrecio(0);
    } else {
      alert("Error: " + (res.error || 'No se pudo crear'));
    }
  };

  const handleGuardar = async (id) => {
    const nombre = document.getElementById(`nombre-${id}`).value;
    const precio = document.getElementById(`precio-${id}`).value;
    const tiempo = document.getElementById(`tiempo-${id}`).value;

    await updateRecurso(id, {
        nombre: nombre,
        precio: parseFloat(precio),
        tiempo: parseInt(tiempo)
    });
    setEditando(null);
    cargar();
  };

  const handleBorrar = async (id) => {
    if(confirm("¿Seguro? Se ocultará del cotizador.")) {
        await deleteRecurso(id);
        cargar();
    }
  };
  const handleAprobar = async (id) => {
    await aprobarRecurso(id);
    cargar();
  };

  const filtrados = recursos.filter(r => r.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div style={{padding: '20px'}}>
      <Link to="/dashboard" style={{ textDecoration: 'none', color: '#007bff', marginBottom: '20px', display: 'inline-block' }}>
        &larr; Volver al Dashboard
      </Link>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2>🗄️ Inventario Total (Admin)</h2>
        <button onClick={handleAbrirModal} style={{background: '#007bff', color: 'white', padding: '10px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
          + Agregar Material Manualmente
        </button>
      </div>

      <input placeholder="Buscar material..." onChange={e => setBusqueda(e.target.value)} style={{padding: '10px', width: '100%', marginBottom: '20px', border: '1px solid #ddd', borderRadius: '5px'}} />

      {/* ... (resto de la tabla sin cambios) ... */}
      <table style={{width: '100%', borderCollapse: 'collapse'}}>
        <thead>
          <tr style={{background: '#343a40', color: 'white', textAlign: 'left'}}>
            <th style={{padding: '10px'}}>Estatus</th>
            <th>Nombre</th>
            <th>Precio Base</th>
            <th>Tiempo (Min)</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map(r => (
            <tr key={r.id} style={{borderBottom: '1px solid #eee', background: r.estatus === 'PENDIENTE_TECNICO' ? '#fff3cd' : 'white'}}>
              <td style={{padding: '10px'}}>
                {r.estatus === 'PENDIENTE_TECNICO' ?
                  (<span style={{background: '#ffc107', color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8em', fontWeight: 'bold'}}>⚠️ PENDIENTE</span>) :
                  (<span style={{color: 'green', fontSize: '0.8em'}}>✅ OK</span>)
                }
              </td>
              <td>
                {editando === r.id ? <input defaultValue={r.nombre} id={`nombre-${r.id}`} style={{width: '100%'}} /> : r.nombre}
              </td>
              <td>
                {editando === r.id ?
                  <input type="number" step="0.01" defaultValue={r.precio_costo_base} id={`precio-${r.id}`} style={{width: '80px'}} /> :
                  `$${parseFloat(r.precio_costo_base).toFixed(2)}`}
              </td>
              <td>
                {editando === r.id ?
                  <input type="number" step="1" defaultValue={r.tiempo_instalacion_min} id={`tiempo-${r.id}`} style={{width: '60px'}} /> :
                  `${r.tiempo_instalacion_min} min`}
              </td>
              <td>
                {editando === r.id ? (
                  <button onClick={() => handleGuardar(r.id)}>💾 Guardar</button>
                ) : (
                  <div style={{display: 'flex', gap: '10px'}}>
                    {r.estatus === 'PENDIENTE_TECNICO' && (
                      <button onClick={() => handleAprobar(r.id)} style={{background: '#28a745', color: 'white', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer'}} title="Aprobar y Oficializar">
                        ✅
                      </button>
                    )}
                    <button onClick={() => setEditando(r.id)} style={{cursor: 'pointer'}}>✏️</button>
                    <button onClick={() => handleBorrar(r.id)} style={{color:'red', cursor: 'pointer'}}>🗑️</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* --- MODAL DE CREACIÓN --- */}
      <Modal isOpen={modalOpen} onRequestClose={handleCerrarModal} style={customStyles}>
        <h2>Nuevo Material</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
          <input
            placeholder="Nombre del material"
            value={nuevoNombre}
            onChange={e => setNuevoNombre(e.target.value)}
          />
          <input
            placeholder="Unidad (pza, m, kg)"
            value={nuevaUnidad}
            onChange={e => setNuevaUnidad(e.target.value)}
          />
          <input
            type="number"
            placeholder="Precio de costo inicial"
            value={nuevoPrecio}
            onChange={e => setNuevoPrecio(parseFloat(e.target.value))}
          />
          <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
            <button onClick={handleCerrarModal} style={{background: '#6c757d', color: 'white'}}>Cancelar</button>
            <button onClick={handleCrearManual} style={{background: '#007bff', color: 'white'}}>Crear</button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
export default GestionMateriales;

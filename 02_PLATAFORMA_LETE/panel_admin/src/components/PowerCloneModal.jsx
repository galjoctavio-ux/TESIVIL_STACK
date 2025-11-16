import React, { useState, useEffect } from 'react';
import { obtenerDetalleCotizacion, obtenerRecursos } from '../apiService';

const PowerCloneModal = ({ cotizacionId, onClose, onCloned }) => {
  const [loading, setLoading] = useState(true);
  const [cotizacion, setCotizacion] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [manoObra, setManoObra] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [itemSeleccionado, setItemSeleccionado] = useState('');

  useEffect(() => {
    if (cotizacionId) {
      cargarDatos();
    }
  }, [cotizacionId]);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [cotiRes, catRes] = await Promise.all([
        obtenerDetalleCotizacion(cotizacionId),
        obtenerRecursos()
      ]);

      if (cotiRes.status === 'success') {
        setCotizacion(cotiRes.data.header);
        setMateriales(cotiRes.data.materiales.map(m => ({
          id_recurso_ref: m.recurso_id,
          nombre: m.nombre,
          unidad: m.unidad,
          cantidad: parseFloat(m.cantidad),
          precio_base: parseFloat(m.precio_base_capturado)
        })));
        setManoObra(cotiRes.data.mano_obra.map(mo => ({
          descripcion: mo.descripcion,
          horas: parseFloat(mo.horas)
        })));
      }
      if (catRes.status === 'success') {
        setCatalogo(catRes.data);
      }
    } catch (error) {
      alert("Error cargando datos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClonar = () => {
    const payload = {
      id_original: cotizacionId,
      cliente_email: cotizacion.cliente_email,
      cliente_nombre: cotizacion.cliente_nombre,
      items: materiales.map(m => ({ id_recurso: m.id_recurso_ref, cantidad: m.cantidad })),
      mano_de_obra: manoObra
    };
    onCloned(payload);
  };

  // --- MANEJO DE MATERIALES ---
  const changeMaterialCant = (index, nuevaCant) => {
    const nuevos = [...materiales];
    nuevos[index].cantidad = parseFloat(nuevaCant) || 0;
    setMateriales(nuevos);
  };

  const eliminarMaterial = (index) => {
    const nuevos = [...materiales];
    nuevos.splice(index, 1);
    setMateriales(nuevos);
  };

  const agregarMaterial = () => {
    if (!itemSeleccionado) return;
    const recurso = catalogo.find(r => r.id == itemSeleccionado);
    if (!recurso) return;

    setMateriales([...materiales, {
      id_recurso_ref: recurso.id,
      nombre: recurso.nombre,
      unidad: recurso.unidad,
      cantidad: 1,
      precio_base: parseFloat(recurso.precio_costo_base)
    }]);
    setItemSeleccionado('');
  };

  // --- MANEJO DE MANO DE OBRA ---
  const changeMOHoras = (index, nuevasHoras) => {
    const nuevas = [...manoObra];
    nuevas[index].horas = parseFloat(nuevasHoras) || 0;
    setManoObra(nuevas);
  };

  const changeMODesc = (index, texto) => {
    const nuevas = [...manoObra];
    nuevas[index].descripcion = texto;
    setManoObra(nuevas);
  };

  const eliminarMO = (index) => {
    const nuevas = [...manoObra];
    nuevas.splice(index, 1);
    setManoObra(nuevas);
  };

  const agregarMO = () => {
    setManoObra([...manoObra, { descripcion: 'Nueva tarea', horas: 1 }]);
  };

  if (!cotizacionId) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', width: '90%', maxWidth: '800px', borderRadius: '8px', padding: '20px', overflowY: 'auto', maxHeight: '90vh' }}>
        <h2>♻️ Power Clone: Cotización #{cotizacionId}</h2>
        {loading ? <p>Cargando...</p> : (
          <>
            {/* Formulario de edición */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
              <div style={{ flex: 1, minWidth: '300px' }}>
                {/* Campos de cliente */}
                <div style={{ marginBottom: '20px' }}>
                  <label>Nombre Cliente:</label>
                  <input
                    type="text"
                    value={cotizacion.cliente_nombre || ''}
                    onChange={(e) => setCotizacion({ ...cotizacion, cliente_nombre: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label>Email Cliente:</label>
                  <input
                    type="email"
                    value={cotizacion.cliente_email || ''}
                    onChange={(e) => setCotizacion({ ...cotizacion, cliente_email: e.target.value })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  />
                </div>
              </div>
            </div>

            {/* MATERIALES */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: '#0056b3' }}>🧱 Materiales</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Cant.</th>
                    <th style={{ padding: '8px' }}>Unidad</th>
                    <th style={{ padding: '8px' }}>Descripción</th>
                    <th style={{ padding: '8px' }}>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {materiales.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px', width: '80px' }}>
                        <input type="number" value={item.cantidad} onChange={(e) => changeMaterialCant(idx, e.target.value)} style={{ width: '60px', padding: '5px', textAlign: 'center' }} />
                        </td>
                        <td style={{ padding: '8px', color: '#666' }}>{item.unidad}</td>
                        <td style={{ padding: '8px' }}>{item.nombre}</td>
                        <td style={{ padding: '8px' }}><button onClick={() => eliminarMaterial(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>&times;</button></td>
                    </tr>
                    ))}
                </tbody>
                </table>
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', background: '#f1f1f1', padding: '10px', borderRadius: '5px' }}>
                <select value={itemSeleccionado} onChange={e => setItemSeleccionado(e.target.value)} style={{ flex: 1, padding: '8px' }}>
                    <option value="">-- Agregar Material --</option>
                    {catalogo.map(cat => <option key={cat.id} value={cat.id}>{cat.nombre}</option>)}
                </select>
                <button onClick={agregarMaterial} style={{ padding: '8px 15px', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+</button>
                </div>
            </div>

            {/* MANO DE OBRA */}
            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: '#0056b3' }}>👷 Mano de Obra</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Horas</th>
                    <th style={{ padding: '8px' }}>Descripción</th>
                    <th style={{ padding: '8px' }}>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {manoObra.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px', width: '80px' }}>
                        <input type="number" value={item.horas} onChange={(e) => changeMOHoras(idx, e.target.value)} style={{ width: '60px', padding: '5px', textAlign: 'center' }} />
                        </td>
                        <td style={{ padding: '8px' }}>
                        <input type="text" value={item.descripcion} onChange={(e) => changeMODesc(idx, e.target.value)} style={{ width: '100%', padding: '5px' }} />
                        </td>
                        <td style={{ padding: '8px' }}><button onClick={() => eliminarMO(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>&times;</button></td>
                    </tr>
                    ))}
                </tbody>
                </table>
                <button onClick={agregarMO} style={{ marginTop: '10px', padding: '8px 15px', background: '#17a2b8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>+ Tarea</button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleClonar} style={{ flex: 2, padding: '12px', background: '#6f42c1', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Clonar y Crear Versión</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PowerCloneModal;

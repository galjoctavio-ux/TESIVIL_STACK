import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { obtenerDetalleCotizacion, obtenerRecursos } from '../apiService';

const EditarCotizacion = () => {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [cotizacion, setCotizacion] = useState(null);

  const [materiales, setMateriales] = useState([]);
  const [manoObra, setManoObra] = useState([]);

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const cargarDatos = async () => {
    try {
      const [cotiRes] = await Promise.all([
        obtenerDetalleCotizacion(id)
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
    } catch (error) {
      alert("Error cargando datos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calcularFinanzas = () => {
    if (!cotizacion) return {};

    const matCD = parseFloat(cotizacion.total_materiales_cd || 0);
    const moCD = parseFloat(cotizacion.total_mano_obra_cd || 0);
    const costoDirectoTotal = matCD + moCD;

    const precioVenta = parseFloat(cotizacion.subtotal_venta || 0);
    const utilidadBruta = precioVenta - costoDirectoTotal;

    const margen = precioVenta > 0 ? ((utilidadBruta / precioVenta) * 100) : 0;

    return { matCD, moCD, costoDirectoTotal, precioVenta, utilidadBruta, margen };
  };

  const finanzas = calcularFinanzas();

  const formatMoney = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

  if (loading) return <div style={{padding:'40px'}}>Cargando...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', paddingBottom: '100px' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
            <h2 style={{margin:0}}>👁️ Detalles: Cotización #{id}</h2>
            <span style={{color:'#666'}}>{cotizacion?.cliente_nombre}</span>
        </div>
        <Link to="/cotizaciones" style={{ textDecoration: 'none', color: '#666', background:'#f1f1f1', padding:'8px 15px', borderRadius:'5px' }}>&larr; Volver</Link>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>

        <div style={{ flex: 2, minWidth: '300px' }}>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: '#0056b3' }}>🧱 Materiales</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Cant.</th>
                    <th style={{ padding: '8px' }}>Unidad</th>
                    <th style={{ padding: '8px' }}>Descripción</th>
                    </tr>
                </thead>
                <tbody>
                    {materiales.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px', width: '80px' }}>
                        <input type="number" value={item.cantidad} disabled style={{ width: '60px', padding: '5px', textAlign: 'center', background: '#f4f4f4', border: '1px solid #ddd' }} />
                        </td>
                        <td style={{ padding: '8px', color: '#666' }}>{item.unidad}</td>
                        <td style={{ padding: '8px' }}>{item.nombre}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>

            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '20px' }}>
                <h3 style={{ marginTop: 0, color: '#0056b3' }}>👷 Mano de Obra</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#f8f9fa', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>Horas</th>
                    <th style={{ padding: '8px' }}>Descripción</th>
                    </tr>
                </thead>
                <tbody>
                    {manoObra.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px', width: '80px' }}>
                        <input type="number" value={item.horas} disabled style={{ width: '60px', padding: '5px', textAlign: 'center', background: '#f4f4f4', border: '1px solid #ddd' }} />
                        </td>
                        <td style={{ padding: '8px' }}>
                        <input type="text" value={item.descripcion} disabled style={{ width: '100%', padding: '5px', background: '#f4f4f4', border: '1px solid #ddd' }} />
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ background: '#212529', color: 'white', padding: '20px', borderRadius: '8px', position: 'sticky', top: '20px' }}>
                <h3 style={{ marginTop: 0, borderBottom: '1px solid #444', paddingBottom: '10px' }}>🩻 Rayos X (Tripas)</h3>

                <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '0.9em', color: '#ccc' }}>Costo Directo Materiales</div>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{formatMoney(finanzas.matCD)}</div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '0.9em', color: '#ccc' }}>Costo Directo Mano Obra</div>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{formatMoney(finanzas.moCD)}</div>
                </div>

                <div style={{ marginBottom: '15px', borderTop: '1px solid #444', paddingTop: '10px' }}>
                    <div style={{ fontSize: '0.9em', color: '#ffc107' }}>COSTO DIRECTO TOTAL</div>
                    <div style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#ffc107' }}>{formatMoney(finanzas.costoDirectoTotal)}</div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                    <div style={{ fontSize: '0.9em', color: '#ccc' }}>Precio de Venta (Subtotal)</div>
                    <div style={{ fontSize: '1.2em', fontWeight: 'bold' }}>{formatMoney(finanzas.precioVenta)}</div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '5px' }}>
                    <div style={{ fontSize: '0.9em', color: '#00d4ff' }}>Utilidad Bruta Estimada</div>
                    <div style={{ fontSize: '1.5em', fontWeight: 'bold', color: '#00d4ff' }}>{formatMoney(finanzas.utilidadBruta)}</div>
                    <div style={{ fontSize: '0.8em', color: '#ccc' }}>Margen: {finanzas.margen.toFixed(1)}%</div>
                </div>

                <div style={{ marginTop: '20px', fontSize: '0.8em', color: '#888', fontStyle: 'italic' }}>
                    * Estos valores incluyen tus porcentajes de indirectos, herramienta y supervisión configurados en sistema.
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EditarCotizacion;

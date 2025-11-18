// --- IMPORTACIONES MODIFICADAS ---
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // Cambiado useParams por useLocation
import api from '../apiService';
import SignatureCanvas from 'react-signature-canvas';

// (Estilos - sin cambios)
const formContainerStyle = { padding: '16px', background: '#fff', margin: '0', borderRadius: '8px' };
// ... (todos tus demás estilos van aquí) ...
const inputGroupStyle = { marginBottom: '15px', display: 'flex', flexDirection: 'column' };
const labelStyle = { fontWeight: 'bold', marginBottom: '5px' };
const tabContainerStyle = { display: 'flex', gap: '5px', borderBottom: '1px solid #ccc', marginBottom: '16px', flexWrap: 'wrap' };
const tabStyle = { padding: '10px', cursor: 'pointer', border: '1px solid #ccc', borderBottom: 'none', background: '#f0f0f0' };
const activeTabStyle = { ...tabStyle, background: '#fff', borderBottom: '1px solid #fff', marginTop: '-1px' };
const equipoBoxStyle = { border: '1px solid #ccc', padding: '10px', marginTop: '10px', borderRadius: '5px', display: 'flex', flexWrap: 'wrap', gap: '10px' };
const sigCanvasStyle = { border: '1px solid black', width: '100%', minHeight: '150px', borderRadius: '5px' };
const overlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1001,
  flexDirection: 'column',
  color: 'white',
};
const spinnerStyle = {
  border: '8px solid #f3f3f3',
  borderTop: '8px solid #3498db',
  borderRadius: '50%',
  width: '60px',
  height: '60px',
  animation: 'spin 2s linear infinite',
};
const keyframesStyle = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
// ---------------------------------------------------

import { useParams } from 'react-router-dom';

function RevisionForm() {
  const { casoId } = useParams();
  const navigate = useNavigate();
  
  const [caso, setCaso] = useState(null); // Guardará los datos del caso
  const [isLoading, setIsLoading] = useState(true); // Estado de carga
  const [loadError, setLoadError] = useState(null);
  
  // --- Estados existentes ---
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const sigPadRef = useRef(null);

  const [formData, setFormData] = useState({
    caso_id: null, // Se llenará desde la API
    cliente_email: '',
    // ... (el resto de tu estado formData no cambia) ...
    tipo_servicio: 'Monofásico',
    tipo_medidor: 'Digital',
    giro_medidor: 'Regular',
    sello_cfe: true,
    condicion_base_medidor: 'Bueno',
    edad_instalacion: '0-10 años',
    cantidad_circuitos: 1,
    condiciones_cc: 'Bueno',
    observaciones_cc: '',
    tornillos_flojos: false,
    capacidad_vs_calibre: true,
    voltaje_medido: 127.0,
    corriente_red_f1: 0,
    corriente_red_f2: 0,
    corriente_red_f3: 0,
    corriente_red_n: 0,
    corriente_paneles_f1: 0,
    corriente_paneles_f2: 0,
    corriente_paneles_f3: 0,
    cantidad_paneles: 0,
    watts_por_panel: 0,
    paneles_antiguedad_anos: 0,
    se_puede_apagar_todo: false,
    corriente_fuga_f1: 0,
    corriente_fuga_f2: 0,
    corriente_fuga_f3: 0,
    equiposData: [],
    causas_alto_consumo: [],
    recomendaciones_tecnico: '',
  });

  useEffect(() => {
    const fetchCaso = async () => {
      setIsLoading(true);
      try {
        const response = await api.get(`/casos/${casoId}`);
        const casoData = response.data;
        setCaso(casoData);
        setFormData(prev => ({
          ...prev,
          caso_id: casoData.id,
        }));
      } catch (err) {
        setLoadError('No se pudo cargar la información del caso. Es posible que no tengas permiso para verlo.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCaso();
  }, [casoId]);

  // --- (El resto de tus funciones: handleChange, handleAddEquipo, etc. no cambian) ---
  const handleChange = (e) => {
    // ... (sin cambios) ...
    const { name, value, type } = e.target;
    let val;
    if (type === 'checkbox') {
      val = e.target.checked;
    } else if (['sello_cfe', 'tornillos_flojos', 'capacidad_vs_calibre', 'se_puede_apagar_todo'].includes(name)) {
      val = (value === 'true');
    } else if (type === 'number') {
      val = parseFloat(value) || 0;
    } else {
      val = value;
    }
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleAddEquipo = () => {
    // ... (sin cambios) ...
    setFormData(prev => ({ ...prev, equiposData: [ ...prev.equiposData, { id: Date.now(), nombre_equipo: 'Refrigerador', nombre_personalizado: '', amperaje_medido: 1.0, tiempo_uso: 1, unidad_tiempo: 'Horas/Día', estado_equipo: 'Bueno' } ] }));
  };
  const handleEquipoChange = (id, e) => {
    // ... (sin cambios) ...
    const { name, value, type } = e.target;
    const val = (type === 'number') ? (parseFloat(value) || 0) : value;
    setFormData(prev => ({ ...prev, equiposData: prev.equiposData.map(eq => eq.id === id ? { ...eq, [name]: val } : eq) }));
  };
  const handleRemoveEquipo = (id) => {
    // ... (sin cambios) ...
    setFormData(prev => ({ ...prev, equiposData: prev.equiposData.filter(eq => eq.id !== id) }));
  };

  const handleCausasChange = (e) => {
    // ... (sin cambios) ...
    const { value, checked } = e.target;
    setFormData(prev => {
      const causas = prev.causas_alto_consumo;
      if (checked) {
        return { ...prev, causas_alto_consumo: [...causas, value] };
      } else {
        return { ...prev, causas_alto_consumo: causas.filter(c => c !== value) };
      }
    });
  };

  const clearSignature = () => {
    // ... (sin cambios) ...
    sigPadRef.current.clear();
  };

  const handleSubmit = async () => {
    // ... (sin cambios) ...
    setIsSubmitting(true);
    setSubmitError(null);

    if (!formData.cliente_email) {
      alert('Error: El Correo del Cliente en el Paso 1 es obligatorio.');
      setCurrentStep(1);
      setIsSubmitting(false);
      return;
    }

    const firmaData = sigPadRef.current.isEmpty()
      ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg=="
      : sigPadRef.current.toDataURL('image/png');

    const { equiposData, ...revisionData } = formData;
    const payload = { revisionData, equiposData, firmaBase64: firmaData };

    console.log("Enviando payload con firma real...");

    try {
      const response = await api.post('/revisiones', payload);
      setSubmitSuccess(true);
      setTimeout(() => navigate('/casos'), 2500); // Esto te llevará a la lista de casos
    } catch (err) {
      console.error('Error al enviar la revisión:', err);
      setSubmitError('Error al enviar la revisión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };
  // ---------------------------------------------------

  // --- (Lógica de renderizado condicional - sin cambios) ---
  const { tipo_servicio } = formData;
  const esMonofasico = tipo_servicio === 'Monofásico';
  const esBifasico = tipo_servicio === '2F+Neutro' || tipo_servicio === '2F+N con Paneles';
  const esTrifasico = tipo_servicio === 'Trifásico' || tipo_servicio === 'Trifásico con Paneles';
  const tienePaneles = tipo_servicio === '2F+N con Paneles' || tipo_servicio === 'Trifásico con Paneles';

  // --- NUEVO: Renderizado de Carga y Error ---
  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <style>{keyframesStyle}</style>
        <div style={spinnerStyle}></div>
        <p>Cargando datos del caso...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: 'red' }}>
        <h3>Error al Cargar</h3>
        <p>{loadError}</p>
        <p>Por favor, revisa el enlace o contacta al administrador.</p>
      </div>
    );
  }
  // ---------------------------------------------

  // --- RENDERIZADO PRINCIPAL (MODIFICADO) ---
  return (
    <div style={{ padding: '16px' }}>
      <style>{keyframesStyle}</style>

      {isSubmitting && (
        <div style={overlayStyle}>
          <div style={spinnerStyle}></div>
          <p style={{ marginTop: '20px', fontSize: '1.2em' }}>Enviando reporte, por favor espera...</p>
        </div>
      )}

      {/* --- TÍTULO MODIFICADO --- */}
      <h2>Iniciando Revisión para el Caso #{caso ? caso.id : '...'}</h2>
      {caso && (
        <div style={{...formContainerStyle, background: '#f8f9fa', border: '1px solid #e9ecef', marginBottom: '16px'}}>
          <strong>Cliente:</strong> {caso.cliente_nombre}<br/>
          <strong>Dirección:</strong> {caso.cliente_direccion}<br/>
          <strong>Tipo de Caso:</strong> {caso.tipo}
        </div>
      )}

      <div style={tabContainerStyle}>
        {/* ... (tus pestañas no cambian) ... */}
        <div style={currentStep === 1 ? activeTabStyle : tabStyle} onClick={() => setCurrentStep(1)}>Paso 1: Generales</div>
        <div style={currentStep === 2 ? activeTabStyle : tabStyle} onClick={() => setCurrentStep(2)}>Paso 2: Medidor y C.C.</div>
        <div style={currentStep === 3 ? activeTabStyle : tabStyle} onClick={() => setCurrentStep(3)}>Paso 3: Mediciones</div>
        <div style={currentStep === 4 ? activeTabStyle : tabStyle} onClick={() => setCurrentStep(4)}>Paso 4: Fugas</div>
        <div style={currentStep === 5 ? activeTabStyle : tabStyle} onClick={() => setCurrentStep(5)}>Paso 5: Equipos</div>
        <div style={currentStep === 6 ? activeTabStyle : tabStyle} onClick={() => setCurrentStep(6)}>Paso 6: Cierre</div>
      </div>

      <div style={formContainerStyle}>
        
        {/* ... (El resto de tu formulario (Pasos 1-6) no cambia) ... */}
        
        {currentStep === 1 && (
          // ... (tu Paso 1) ...
          <div>
            <h3>Paso 1: Datos Generales</h3>
            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="cliente_email">Correo del Cliente (Obligatorio)</label>
              <input type="email" name="cliente_email" id="cliente_email" value={formData.cliente_email} onChange={handleChange} required />
            </div>
          </div>
        )}
        {currentStep === 2 && (
          // ... (tu Paso 2) ...
          <div>
            <h3>Paso 2: Medidor y Centro de Carga</h3>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Tipo de Servicio</label>
              <select name="tipo_servicio" value={formData.tipo_servicio} onChange={handleChange}>
                <option>Monofásico</option><option>2F+Neutro</option><option>2F+N con Paneles</option><option>Trifásico</option><option>Trifásico con Paneles</option>
              </select>
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Cuenta con Sello CFE</label>
              <select name="sello_cfe" value={formData.sello_cfe.toString()} onChange={handleChange}>
                <option value="true">Sí</option><option value="false">No</option>
              </select>
            </div>
            {formData.sello_cfe === false && (
              <div style={{...inputGroupStyle, background: '#fff8e1', padding: '10px'}}>
                <label style={labelStyle}>Condición Base Medidor (Si NO hay sello)</label>
                <select name="condicion_base_medidor" value={formData.condicion_base_medidor} onChange={handleChange}>
                  <option>Bueno</option><option>Regular</option><option>Malo</option>
                </select>
              </div>
            )}
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Tornillos Flojos</label>
              <select name="tornillos_flojos" value={formData.tornillos_flojos.toString()} onChange={handleChange}>
                <option value="false">No</option><option value="true">Sí</option>
              </select>
            </div>
            {formData.tornillos_flojos === true && (<p style={{ color: 'red', fontWeight: 'bold' }}>¡Atención! Aprieta los tornillos...</p>)}
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Capacidad Interruptor vs Calibre</label>
              <select name="capacidad_vs_calibre" value={formData.capacidad_vs_calibre.toString()} onChange={handleChange}>
                <option value="true">Sí (Correcto)</option><option value="false">No (Incorrecto)</option>
              </select>
            </div>
            {formData.capacidad_vs_calibre === false && (<p style={{ color: 'red', fontWeight: 'bold' }}>¡PELIGRO! Riesgo de Incendio...</p>)}
            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="observaciones_cc">Observaciones C.C.</label>
              <textarea name="observaciones_cc" id="observaciones_cc" value={formData.observaciones_cc} onChange={handleChange} />
            </div>
          </div>
        )}
        {currentStep === 3 && (
          // ... (tu Paso 3) ...
          <div>
            <h3>Paso 3: Mediciones (UI Dinámica)</h3>
            <div style={{...inputGroupStyle, background: '#e3f2fd', padding: '10px'}}>
              <label style={labelStyle} htmlFor="voltaje_medido">Voltaje (Fase-Neutro)</label>
              <input type="number" name="voltaje_medido" id="voltaje_medido" value={formData.voltaje_medido} onChange={handleChange} step="0.1" />
            </div>
            <h4>Corriente de Red (Amperes)</h4>
            {/* FASE 1: Siempre visible */}
            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="corriente_red_f1">Corriente Red F1</label>
              <input type="number" name="corriente_red_f1" id="corriente_red_f1" value={formData.corriente_red_f1} onChange={handleChange} step="0.1" />
            </div>

            {/* FASE 2: Bifásico y Trifásico */}
            {(esBifasico || esTrifasico) && (
              <div style={inputGroupStyle}>
                <label style={labelStyle} htmlFor="corriente_red_f2">Corriente Red F2</label>
                <input type="number" name="corriente_red_f2" id="corriente_red_f2" value={formData.corriente_red_f2} onChange={handleChange} step="0.1" />
              </div>
            )}

            {/* FASE 3: Trifásico */}
            {esTrifasico && (
              <div style={inputGroupStyle}>
                <label style={labelStyle} htmlFor="corriente_red_f3">Corriente Red F3</label>
                <input type="number" name="corriente_red_f3" id="corriente_red_f3" value={formData.corriente_red_f3} onChange={handleChange} step="0.1" />
              </div>
            )}

            {/* NEUTRO: Monofásico y Bifásico */}
            {(esMonofasico || esBifasico) && (
              <div style={inputGroupStyle}>
                <label style={labelStyle} htmlFor="corriente_red_n">Corriente Red Neutro</label>
                <input type="number" name="corriente_red_n" id="corriente_red_n" value={formData.corriente_red_n} onChange={handleChange} step="0.1" />
              </div>
            )}

            {/* SECCIÓN PANELES SOLARES */}
            {tienePaneles && (
              <div style={{background: '#e8f5e9', padding: '10px', marginTop: '15px'}}>
                <h4>Mediciones de Paneles Solares (Corriente)</h4>

                {/* Panel F1: Siempre visible si hay paneles */}
                <div style={inputGroupStyle}>
                  <label style={labelStyle} htmlFor="corriente_paneles_f1">Corriente Paneles F1</label>
                  <input type="number" name="corriente_paneles_f1" id="corriente_paneles_f1" value={formData.corriente_paneles_f1} onChange={handleChange} step="0.1" />
                </div>

                {/* Panel F2: Visible para servicios bifásicos y trifásicos con paneles */}
                {(tipo_servicio === '2F+N con Paneles' || tipo_servicio === 'Trifásico con Paneles') && (
                  <div style={inputGroupStyle}>
                    <label style={labelStyle} htmlFor="corriente_paneles_f2">Corriente Paneles F2</label>
                    <input type="number" name="corriente_paneles_f2" id="corriente_paneles_f2" value={formData.corriente_paneles_f2} onChange={handleChange} step="0.1" />
                  </div>
                )}

                {/* Panel F3: Visible solo para servicios trifásicos con paneles */}
                {tipo_servicio === 'Trifásico con Paneles' && (
                  <div style={inputGroupStyle}>
                    <label style={labelStyle} htmlFor="corriente_paneles_f3">Corriente Paneles F3</label>
                    <input type="number" name="corriente_paneles_f3" id="corriente_paneles_f3" value={formData.corriente_paneles_f3} onChange={handleChange} step="0.1" />
                  </div>
                )}

                <h4>Datos Generales de Paneles</h4>
                <div style={inputGroupStyle}>
                  <label style={labelStyle} htmlFor="cantidad_paneles">Cantidad de Paneles</label>
                  <input type="number" name="cantidad_paneles" id="cantidad_paneles" value={formData.cantidad_paneles} onChange={handleChange} step="1" />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle} htmlFor="watts_por_panel">Watts por Panel</label>
                  <input type="number" name="watts_por_panel" id="watts_por_panel" value={formData.watts_por_panel} onChange={handleChange} step="1" />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle} htmlFor="paneles_antiguedad_anos">Años de Antigüedad de Paneles</label>
                  <input type="number" name="paneles_antiguedad_anos" id="paneles_antiguedad_anos" value={formData.paneles_antiguedad_anos} onChange={handleChange} step="1" />
                </div>
              </div>
            )}
          </div>
        )}
        {currentStep === 4 && (
          // ... (tu Paso 4) ...
          <div>
            <h3>Paso 4: Prueba de Fuga</h3>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>¿Se puede apagar todo?</label>
              <select name="se_puede_apagar_todo" value={formData.se_puede_apagar_todo.toString()} onChange={handleChange}>
                <option value="false">No</option><option value="true">Sí</option>
              </select>
            </div>
            {formData.se_puede_apagar_todo === true && (
              <div style={{...inputGroupStyle, background: '#fff8e1', padding: '10px'}}>
                <h4>Medición de Fuga Directa</h4>
                <p>Con todo apagado, mide la corriente de fuga en cada fase.</p>
                <div style={inputGroupStyle}>
                  <label style={labelStyle} htmlFor="corriente_fuga_f1">Corriente Fuga F1 (Amperes)</label>
                  <input type="number" name="corriente_fuga_f1" id="corriente_fuga_f1" value={formData.corriente_fuga_f1} onChange={handleChange} step="0.01" />
                </div>
                {(esBifasico || esTrifasico) && (
                   <div style={inputGroupStyle}>
                    <label style={labelStyle} htmlFor="corriente_fuga_f2">Corriente Fuga F2 (Amperes)</label>
                    <input type="number" name="corriente_fuga_f2" id="corriente_fuga_f2" value={formData.corriente_fuga_f2} onChange={handleChange} step="0.01" />
                  </div>
                )}
                {esTrifasico && (
                   <div style={inputGroupStyle}>
                    <label style={labelStyle} htmlFor="corriente_fuga_f3">Corriente Fuga F3 (Amperes)</label>
                    <input type="number" name="corriente_fuga_f3" id="corriente_fuga_f3" value={formData.corriente_fuga_f3} onChange={handleChange} step="0.01" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {currentStep === 5 && (
          // ... (tu Paso 5) ...
          <div>
            <h3>Paso 5: Electrodomésticos</h3>
            <button type="button" onClick={handleAddEquipo} style={{marginBottom: '10px'}}>+ Agregar Equipo</button>
            {formData.equiposData.map((equipo) => (
              <div key={equipo.id} style={equipoBoxStyle}>
                <select name="nombre_equipo" value={equipo.nombre_equipo} onChange={(e) => handleEquipoChange(equipo.id, e)}>
                  <option>Refrigerador</option><option>Lavadora</option><option>Aire Acondicionado</option><option>Bomba</option><option>TV</option><option>Ventilador</option><option>Otro</option>
                </select>
                <input type="text" name="nombre_personalizado" placeholder="Ubicación (Ej: Sala)" value={equipo.nombre_personalizado} onChange={(e) => handleEquipoChange(equipo.id, e)} />
                <div><label>Amps:</label><input type="number" name="amperaje_medido" value={equipo.amperaje_medido} onChange={(e) => handleEquipoChange(equipo.id, e)} step="0.1" style={{width: '60px'}} /></div>
                <div><label>T. Uso:</label><input type="number" name="tiempo_uso" value={equipo.tiempo_uso} onChange={(e) => handleEquipoChange(equipo.id, e)} style={{width: '60px'}} /></div>
                <select name="unidad_tiempo" value={equipo.unidad_tiempo} onChange={(e) => handleEquipoChange(equipo.id, e)}>
                  <option>Horas/Día</option><option>Horas/Semana</option>
                </select>
                <select name="estado_equipo" value={equipo.estado_equipo} onChange={(e) => handleEquipoChange(equipo.id, e)}>
                  <option>Bueno</option><option>Regular</option><option>Malo</option>
                </select>
                <button type="button" onClick={() => handleRemoveEquipo(equipo.id)} style={{color: 'red', background: 'transparent', border: 'none', cursor: 'pointer'}}>✖</button>
              </div>
            ))}
          </div>
        )}
        {currentStep === 6 && (
          // ... (tu Paso 6) ...
          <div style={{ display: 'block' }}>
            <h3>Paso 6: Cierre y Firma</h3>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Causas de su Alto Consumo (Marcar las que apliquen)</label>
              <div><input type="checkbox" value="Fugas de corriente en la instalación eléctrica." onChange={handleCausasChange} /> Fugas de corriente.</div>
              <div><input type="checkbox" value="Uso excesivo de electrodomésticos de alto consumo." onChange={handleCausasChange} /> Uso excesivo de electrodomésticos.</div>
              <div><input type="checkbox" value="Equipos en mal estado que consumen más de lo normal." onChange={handleCausasChange} /> Equipos en mal estado.</div>
              <div><input type="checkbox" value="Malas prácticas, como dejar luces y aparatos encendidos innecesariamente." onChange={handleCausasChange} /> Malas prácticas de uso.</div>
              <div><input type="checkbox" value="Fallas en otras instalaciones." onChange={handleCausasChange} /> Fallas en otras instalaciones.</div>
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle} htmlFor="recomendaciones_tecnico">Recomendaciones Clave</label>
              <textarea name="recomendaciones_tecnico" id="recomendaciones_tecnico" value={formData.recomendaciones_tecnico} onChange={handleChange} rows="4" />
            </div>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Firma del Cliente:</label>
              <SignatureCanvas
                ref={sigPadRef}
                penColor='black'
                canvasProps={{style: sigCanvasStyle}}
              />
              <button type="button" onClick={clearSignature} style={{marginTop: '5px', width: '100px', alignSelf: 'flex-start'}}>
                Limpiar
              </button>
            </div>
            {submitError && <p style={{ color: 'red' }}>{submitError}</p>}
            <button 
              onClick={handleSubmit} 
              style={{
                marginTop: '20px',
                backgroundColor: submitSuccess ? '#28a745' : (isSubmitting ? '#ccc' : '#007bff'),
                color: 'white',
                padding: '15px',
                fontSize: '1.2em',
                width: '100%',
                border: 'none',
                borderRadius: '5px',
                cursor: isSubmitting || submitSuccess ? 'default' : 'pointer'
              }}
              disabled={isSubmitting || submitSuccess}
            >
              {isSubmitting ? 'Enviando...' : (submitSuccess ? '¡Reporte Enviado con Éxito!' : 'Generar y Enviar Reporte')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RevisionForm;
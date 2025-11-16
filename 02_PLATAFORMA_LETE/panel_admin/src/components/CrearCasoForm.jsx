import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LoadScript, Autocomplete } from '@react-google-maps/api';
import api from '../apiService';
import './AgendarCasoForm.css'; // Re-usamos el CSS

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ["places"];

// Helper de Bloques (sin cambios)
const generarBloquesVisibles = (horariosOcupados, horaInicio = 8, horaFin = 18) => {
  const bloques = [];
  const aNumero = (horaStr) => {
    const [h, m] = horaStr.split(':').map(Number);
    return h + (m / 60);
  };
  const ocupados = horariosOcupados.map(h => ({
    inicio: aNumero(h.inicio),
    fin: aNumero(h.fin)
  }));
  for (let i = horaInicio; i < horaFin; i++) {
    const bloqueInicio = i;
    const bloqueFin = i + 1;
    let estaOcupado = false;
    for (const ocup of ocupados) {
      if (bloqueInicio < ocup.fin && bloqueFin > ocup.inicio) {
        estaOcupado = true;
        break;
      }
    }
    // MEJORA 2: Guardamos la hora en formato "HH:MM"
    const horaISO = `${String(i).padStart(2, '0')}:00`; 
    bloques.push({
      horaLabel: `${horaISO} - ${String(i + 1).padStart(2, '0')}:00`,
      horaValor: horaISO, // El valor que usaremos para el input
      ocupado: estaOcupado
    });
  }
  return bloques;
};

// --- ESTE ES AHORA EL FORMULARIO "MAESTRO" ---
function CrearCasoForm({ onClose, onCasoCreado }) {
  
  const [formData, setFormData] = useState({
    tecnico_id_ea: '', 
    tecnico_id_supabase: '',
    fecha: '',
    cliente_nombre: '',
    // (cliente_telefono quitado)
    tipo_caso: 'alto_consumo',
    direccion_legible: '',
    link_gmaps: '',
    hora: '',
    duracion_horas: '1',
    notas_adicionales: ''
  });

  const [tecnicos, setTecnicos] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [horariosOcupados, setHorariosOcupados] = useState([]);
  const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  // EFECTO 1: Cargar técnicos
  useEffect(() => {
    const fetchTecnicos = async () => {
      try {
        const response = await api.get('/usuarios/tecnicos'); 
        setTecnicos(response.data);
      } catch (err) {
        setError('Error al cargar la lista de técnicos.');
      }
    };
    fetchTecnicos();
  }, []);

  // EFECTO 2: Cargar Disponibilidad
  useEffect(() => {
    if (formData.tecnico_id_ea && formData.fecha) {
      const fetchDisponibilidad = async () => {
        setLoadingDisponibilidad(true);
        setError('');
        try {
          const response = await api.get('/citas/disponibilidad', {
            params: {
              tecnico_id: formData.tecnico_id_ea,
              fecha: formData.fecha
            }
          });
          setHorariosOcupados(response.data);
        } catch (err) {
          setError('Error al cargar la disponibilidad.');
          setHorariosOcupados([]);
        } finally {
          setLoadingDisponibilidad(false);
        }
      };
      fetchDisponibilidad();
    } else {
      setHorariosOcupados([]);
    }
  }, [formData.tecnico_id_ea, formData.fecha]);

  // Lógica de bloques (corregida)
  const bloquesVisibles = useMemo(() => {
    if (!formData.tecnico_id_ea || !formData.fecha) return [];
    if (loadingDisponibilidad) return [];
    return generarBloquesVisibles(horariosOcupados);
  }, [horariosOcupados, loadingDisponibilidad, formData.tecnico_id_ea, formData.fecha]);

  // Handler Genérico (con lógica de IDs)
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'tecnico_id_ea') {
      const tecnicoSeleccionado = tecnicos.find(t => t.id_ea == value);
      if (tecnicoSeleccionado) {
        setFormData((prev) => ({
          ...prev,
          tecnico_id_ea: tecnicoSeleccionado.id_ea,
          tecnico_id_supabase: tecnicoSeleccionado.id_supabase
        }));
      }
    }
  };

  // Handlers de Google Maps (sin cambios)
  const onAutocompleteLoad = (autocompleteInstance) => {
    autocompleteRef.current = autocompleteInstance;
  };
  const onPlaceChanged = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place && place.formatted_address && place.url) {
        setFormData((prev) => ({
          ...prev,
          direccion_legible: place.formatted_address,
          link_gmaps: place.url
        }));
        setError('');
      }
    }
  };

  // --- MEJORA 2: Handler para Clic en Bloque ---
  const handleBloqueClick = (horaValor) => {
    setFormData((prev) => ({ ...prev, hora: horaValor }));
  };

  // --- MODIFICADO: handleSubmit ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // --- DEBUG: Añadido para ver qué falta ---
    console.log('Datos del formulario al guardar:', formData);
    
    // --- MEJORA 1: Teléfono quitado de la validación ---
    if (!formData.tecnico_id_ea || !formData.tecnico_id_supabase || !formData.fecha || !formData.hora || !formData.link_gmaps || !formData.cliente_nombre) {
      setError('Por favor, complete todos los campos (Técnico, Fecha, Hora, Dirección y Nombre de Cliente).');
      // Imprimimos en consola qué campo falló
      for (const [key, value] of Object.entries(formData)) {
        if (!value && ['tecnico_id_ea', 'tecnico_id_supabase', 'fecha', 'hora', 'link_gmaps', 'cliente_nombre'].includes(key)) {
          console.error(`Error de validación: El campo ${key} está vacío.`);
        }
      }
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/citas', formData);
      onCasoCreado(); 
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Error al agendar la cita.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoadScript
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      libraries={libraries}
    >
      <form className="agendar-caso-form" onSubmit={handleSubmit} noValidate>
        <h3>Crear y Agendar Nuevo Caso</h3>

        {/* --- PASO 1: DISPONIBILIDAD --- */}
        <h4>Paso 1: Ver Disponibilidad</h4>
        <div className="form-paso">
          <div>
            <label htmlFor="tecnico_id_ea">Técnico</label>
            <select id="tecnico_id_ea" name="tecnico_id_ea" value={formData.tecnico_id_ea} onChange={handleChange} required>
              <option value="">Seleccione un técnico</option>
              {tecnicos.map((tecnico) => (
                <option key={tecnico.id_supabase} value={tecnico.id_ea}>
                  {tecnico.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="fecha">Fecha</label>
            <input type="date" id="fecha" name="fecha" value={formData.fecha} onChange={handleChange} required />
          </div>
        </div>

        {/* --- MEJORA 2: onClick añadido --- */}
        {loadingDisponibilidad && <p>Cargando disponibilidad...</p>}
        {bloquesVisibles.length > 0 && (
          <div className="disponibilidad-visual">
            <strong>Clic en un horario libre para seleccionarlo:</strong>
            <ul>
              {bloquesVisibles.map((bloque) => (
                    <li 
                      key={bloque.horaValor} 
                      // --- ESTA ES LA LÍNEA CORREGIDA ---
                      className={`
                        ${bloque.ocupado ? 'ocupado' : 'libre'}
                        ${!bloque.ocupado && bloque.horaValor === formData.hora ? 'seleccionado' : ''}
                      `}
                      onClick={!bloque.ocupado ? () => handleBloqueClick(bloque.horaValor) : undefined}
                    >
                      {bloque.horaLabel}
                    </li>
                  ))}
            </ul>
          </div>
        )}
        
        {/* --- PASO 2: DATOS DEL CASO --- */}
        <h4>Paso 2: Datos del Caso y Cliente</h4>
        <div className="form-paso">
          <div>
            <label htmlFor="cliente_nombre">Nombre del Cliente</label>
            <input type="text" id="cliente_nombre" name="cliente_nombre" value={formData.cliente_nombre} onChange={handleChange} required />
          </div>
          {/* --- MEJORA 1: Campo de Teléfono ELIMINADO --- */}
          <div>
            <label htmlFor="tipo_caso">Tipo de Caso</label>
            <select id="tipo_caso" name="tipo_caso" value={formData.tipo_caso} onChange={handleChange} required>
              <option value="alto_consumo">Alto Consumo</option>
              <option value="levantamiento">Levantamiento</option>
            </select>
          </div>
        </div>
        
        {/* --- PASO 3: DIRECCIÓN --- */}
        <h4>Paso 3: Dirección</h4>
        <div className="form-paso">
          <label htmlFor="direccion">Dirección del Cliente (Buscar en Google)</label>
          <Autocomplete
            onLoad={onAutocompleteLoad}
            onPlaceChanged={onPlaceChanged}
          >
            <input
              type="text"
              id="direccion"
              placeholder="Escribe la dirección y selecciónala..."
              ref={inputRef}
              required
              style={{ width: '100%' }}
            />
          </Autocomplete>
          {formData.link_gmaps && <small style={{ color: 'green' }}>✓ Dirección seleccionada</small>}
        </div>

        {/* --- PASO 4: AGENDAR --- */}
        <h4>Paso 4: Confirmar Cita</h4>
        <div className="form-paso-inline">
          <div>
            <label htmlFor="hora">Hora de Inicio (ej: 14:30)</label>
            {/* MEJORA 2: El 'value' se llena solo */}
            <input type="time" id="hora" name="hora" value={formData.hora} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="duracion_horas">Duración</label>
            <select id="duracion_horas" name="duracion_horas" value={formData.duracion_horas} onChange={handleChange}>
              <option value="1">1 hora</option>
              <option value="2">2 horas</option>
              <option value="3">3 horas</option>
            </select>
          </div>
        </div>
        <div className="form-paso">
          <label htmlFor="notas_adicionales">Notas Adicionales (Técnico)</label>
          <textarea id="notas_adicionales" name="notas_adicionales" value={formData.notas_adicionales} onChange={handleChange} />
        </div>

        {/* --- BOTONES Y ERRORES --- */}
        {error && <p className="error-msg">{error}</p>}
        <div className="form-botones">
          <button type="button" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Crear y Guardar Cita'}
          </button>
        </div>
      </form>
    </LoadScript>
  );
}

export default CrearCasoForm;
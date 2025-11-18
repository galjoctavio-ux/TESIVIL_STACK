import dayjs from 'dayjs';
import axios from 'axios';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 1. Tu configuración existente de Axios (Node.js Backend)
const api = axios.create({
  baseURL: VITE_API_BASE_URL,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      delete api.defaults.headers.common['Authorization'];
      window.location.href = '/lete/app/';
    }
    return Promise.reject(error);
  }
);

export default api;

/**
 * ¡FUNCIÓN FALTANTE!
 * Obtiene el catálogo público de recursos desde el backend PHP
 */
export const obtenerRecursos = async () => {
  try {
    // Usamos fetch para llamar al backend de PHP, igual que en el panel de admin
    const response = await fetch(`/api/recursos`);

    if (!response.ok) {
        throw new Error(`Error de red: ${response.status}`);
    }

    return await response.json(); // Devuelve { status: 'success', data: [...] }

  } catch (error) {
    console.error('Error en obtenerRecursos:', error);
    // Relanzamos el error para que el componente (Cotizador.jsx) pueda atraparlo
    throw error;
  }
};

export const getAgendaPorDia = async (fecha) => {
  const fechaFormateada = dayjs(fecha).format('YYYY-MM-DD');
  return api.get('/agenda/por-dia', { params: { fecha: fechaFormateada } });
};

// =========================================================
// 2. NUEVO: Integración con Microservicio PHP (Cotizador)
// =========================================================

const PHP_API_URL = '/api/cotizar';

/**
 * Envía los datos para solo CALCULAR (Previsualización)
 * @param {Object} data - { horas_tecnico: 8, items: [...] }
 */
export const calcularCotizacion = async (data) => {
  try {
    const response = await fetch(`${PHP_API_URL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Error al calcular cotización');
    return await response.json();
  } catch (error) {
    console.error('Error en calcularCotizacion:', error);
    throw error;
  }
};

/**
 * Envía los datos para GUARDAR y generar UUID
 * @param {Object} data - { tecnico_id, cliente_nombre, horas_tecnico, items... }
 */
export const guardarCotizacion = async (data) => {
  try {
    const response = await fetch(`${PHP_API_URL}/guardar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Error al guardar cotización');
    return await response.json();
  } catch (error) {
    console.error('Error en guardarCotizacion:', error);
    throw error;
  }
};

export const crearRecursoTecnico = async (nombre, unidad, precioTotal) => { // <-- CAMBIADO
  const response = await fetch(`/api/recursos`, { // Asumimos que Nginx rutea /api/recursos (POST)
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Enviamos 'precio_total' en lugar de 'costo'
    body: JSON.stringify({ nombre, unidad, precio_total: precioTotal }) // <-- CAMBIADO
  });
  return await response.json();
};

/**
 * Genera la URL para ver el PDF
 * @param {string} uuid 
 */
export const obtenerUrlPdf = (uuid) => {
  return `${PHP_API_URL}/pdf?uuid=${uuid}`;
};

/**
 * ¡NUEVO!
 * Llama al backend de IA para obtener sugerencias de materiales.
 * @param {string[]} nombresMateriales - Un array de nombres, ej: ["Cable THW 12", "Contacto Duplex"]
 */
export const obtenerSugerenciasIA = async (nombresMateriales) => {
  try {
    const response = await fetch(`/api/ia/sugerir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ materiales: nombresMateriales })
    });
    
    if (!response.ok) {
      // Si la API de IA falla, no rompemos la app, solo lo reportamos.
      console.error("Error en la API de IA", await response.json());
      return { status: 'error', sugerencias: [] };
    }
    
    return await response.json(); // Devuelve { status: 'success', sugerencias: [...] }
  } catch (error) {
    console.error('Error de conexión con la IA:', error);
    return { status: 'error', sugerencias: [] };
  }
};
export const getCotizacionesCountsByTecnico = async (tecnicoId) => {
  try {
    const response = await fetch(`/api/cotizaciones/counts?tecnico_id=${tecnicoId}`);
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error al obtener conteos de cotizaciones:', error);
    throw error;
  }
};

export const cerrarCasoManualmente = async (casoId) => {
  try {
    const response = await api.patch(`/casos/${casoId}/cerrar-manual`);
    return response.data;
  } catch (error) {
    console.error('Error al cerrar el caso manualmente:', error);
    throw error;
  }
};
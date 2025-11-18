import dayjs from 'dayjs';
import axios from 'axios';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 1. Tu configuración existente de Axios (Node.js Backend)
const api = axios.create({
  baseURL: VITE_API_BASE_URL,
});

// 2. NUEVO: Instancia de Axios dedicada para el Backend PHP
const phpApi = axios.create({
  baseURL: '/', // El proxy de Vite se encargará de redirigir /api -> backend_php
});

// Interceptor para manejar errores de forma centralizada para PHP
phpApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // Aquí podrías añadir lógica específica para errores del backend PHP si es necesario
    console.error('Error en la llamada a la API PHP:', error);
    // Relanzamos el error para que el componente que hizo la llamada pueda manejarlo
    return Promise.reject(error);
  }
);

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
 * Obtiene el catálogo público de recursos desde el backend PHP.
 */
export const obtenerRecursos = async () => {
  // El bloque try/catch ya no es necesario aquí.
  // El interceptor de phpApi se encarga de loguear el error y Promise.reject lo relanza.
  const response = await phpApi.get('/api/recursos');
  return response.data; // Axios anida la respuesta JSON directamente en la propiedad `data`
};

export const getAgendaPorDia = async (fecha) => {
  const fechaFormateada = dayjs(fecha).format('YYYY-MM-DD');
  return api.get('/agenda/por-dia', { params: { fecha: fechaFormateada } });
};

// =========================================================
// 3. API Calls Estandarizadas (Microservicio PHP)
// =========================================================

/**
 * Envía los datos para solo CALCULAR (Previsualización).
 * @param {Object} data - { horas_tecnico: 8, items: [...] }
 */
export const calcularCotizacion = async (data) => {
  const response = await phpApi.post('/api/cotizar', data);
  return response.data;
};

/**
 * Envía los datos para GUARDAR y generar UUID.
 * @param {Object} data - { tecnico_id, cliente_nombre, horas_tecnico, items... }
 */
export const guardarCotizacion = async (data) => {
  const response = await phpApi.post('/api/cotizar/guardar', data);
  return response.data;
};

/**
 * Crea un nuevo recurso/material personalizado por un técnico.
 */
export const crearRecursoTecnico = async (nombre, unidad, precioTotal) => {
  const payload = { nombre, unidad, precio_total: precioTotal };
  const response = await phpApi.post('/api/recursos', payload);
  return response.data;
};

/**
 * Genera la URL para ver el PDF.
 * @param {string} uuid 
 */
export const obtenerUrlPdf = (uuid) => {
  // Esto no es una llamada de API, solo construye una URL, por lo que no necesita axios.
  return `/api/cotizar/pdf?uuid=${uuid}`;
};

/**
 * Llama al backend de IA para obtener sugerencias de materiales.
 * @param {string[]} nombresMateriales - Un array de nombres, ej: ["Cable THW 12", "Contacto Duplex"]
 */
export const obtenerSugerenciasIA = async (nombresMateriales) => {
  try {
    const response = await phpApi.post('/api/ia/sugerir', { materiales: nombresMateriales });
    return response.data;
  } catch (error) {
    // REGLA DE NEGOCIO: Si la IA falla, no se debe romper la aplicación.
    // El interceptor ya ha logueado el error, aquí simplemente devolvemos un estado seguro.
    return { status: 'error', sugerencias: [] };
  }
};

/**
 * Obtiene los contadores de cotizaciones por caso para un técnico específico.
 * @param {string} tecnicoId - El ID del técnico.
 */
export const getCotizacionesCountsByTecnico = async (tecnicoId) => {
  const response = await phpApi.get('/api/cotizaciones/counts', {
    params: { tecnico_id: tecnicoId }
  });
  return response.data;
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

export const getCasoById = async (id) => {
  const response = await api.get(`/casos/${id}`);
  return response.data;
};
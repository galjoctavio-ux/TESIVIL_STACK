import axios from 'axios';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- TU CONFIGURACIÓN ACTUAL (NODE.JS) ---
const api = axios.create({
  baseURL: VITE_API_BASE_URL,
  timeout: 15000,
});

// Interceptor para inyectar el token en las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
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
      window.location.href = '/lete/panel/';
    }
    return Promise.reject(error);
  }
);

export default api;

// =========================================================
// --- API para el backend de PHP ---
// =========================================================
const phpApi = axios.create({
  baseURL: '/api', // Nginx redirige esto al puerto 8081
  timeout: 15000,
});

// Interceptor para inyectar el token en las peticiones de PHP
phpApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de respuesta para el 401 en PHP
phpApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/lete/panel/';
    }
    return Promise.reject(error);
  }
);


export const subirXml = async (file) => {
  const formData = new FormData();
  formData.append('xml', file);
  const response = await phpApi.post('/xml/upload', formData);
  return response.data;
};

export const obtenerPendientes = async () => {
  const response = await phpApi.get('/admin/pendientes');
  return response.data;
};

export const obtenerRecursos = async () => {
  const response = await phpApi.get('/recursos');
  return response.data;
};

export const vincularProducto = async (idMapeo, idRecurso) => {
  const response = await phpApi.post('/admin/vincular', { id_mapeo: idMapeo, id_recurso: idRecurso });
  return response.data;
};

export const crearRecurso = async (nombre, unidad) => {
  const response = await phpApi.post('/recursos', { nombre, unidad, tipo: 'MATERIAL' });
  return response.data;
};

export const updateRecurso = async (id, datos) => {
  const response = await phpApi.post('/recursos/editar', { id, ...datos });
  return response.data;
};

export const deleteRecurso = async (id) => {
  const response = await phpApi.post('/recursos/eliminar', { id });
  return response.data;
};

export const obtenerInventarioAdmin = async () => {
  const response = await phpApi.get('/admin/inventario');
  return response.data;
};

export const aprobarRecurso = async (id) => {
  const response = await phpApi.post('/recursos/aprobar', { id });
  return response.data;
};

// --- GESTIÓN DE COTIZACIONES ---

export const obtenerListadoCotizaciones = async () => {
  const response = await phpApi.get('/admin/cotizaciones');
  return response.data;
};

export const aplicarDescuento = async (idCotizacion, porcentaje) => {
  const response = await phpApi.post('/cotizacion/aplicar-descuento', { id: idCotizacion, descuento_pct: porcentaje });
  return response.data;
};

// --- ¡NUEVAS FUNCIONES DE APROBACIÓN (FASE 4)! ---

export const autorizarCotizacion = async (id) => {
  const response = await phpApi.post('/admin/cotizacion/autorizar', { id });
  return response.data;
};

export const rechazarCotizacion = async (id) => {
  const response = await phpApi.post('/admin/cotizacion/rechazar', { id });
  return response.data;
};

export const finalizarProyecto = async (id, gastoMaterial, gastoMo) => {
  const response = await phpApi.post('/admin/cotizacion/finalizar', {
      id,
      gasto_material: gastoMaterial,
      gasto_mo: gastoMo
  });
  return response.data;
};

export const clonarCotizacion = async (id) => {
  const response = await phpApi.post('/admin/cotizacion/clonar', { id });
  return response.data;
};

export const reenviarCorreo = async (id) => {
  const response = await phpApi.post('/admin/cotizacion/reenviar', { id });
  return response.data;
};

// --- CONFIGURACIÓN FINANCIERA (SALA DE MÁQUINAS) ---

export const obtenerConfiguracion = async () => {
  const response = await phpApi.get('/admin/configuracion');
  return response.data;
};

export const actualizarConfiguracion = async (nuevosValores) => {
  const response = await phpApi.post('/admin/configuracion/actualizar', { config: nuevosValores });
  return response.data;
};

// --- EDITOR MAESTRO ---
export const obtenerDetalleCotizacion = async (id) => {
  const response = await phpApi.get(`/admin/cotizacion/detalle?id=${id}`);
  return response.data;
};

export const guardarCambiosCotizacion = async (payload) => {
  const response = await phpApi.post('/admin/cotizacion/guardar-cambios', payload);
  return response.data;
};
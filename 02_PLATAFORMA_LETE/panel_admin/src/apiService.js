import axios from 'axios';

const VITE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// --- TU CONFIGURACIÓN ACTUAL (NODE.JS) ---
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
      window.location.href = '/lete/panel/';
    }
    return Promise.reject(error);
  }
);

export default api;

// =========================================================
// --- NUEVO: API PHP (COTI-LETE / GESTIÓN DE XML) ---
// =========================================================
const PHP_API_URL = '/api'; // Nginx redirige esto al puerto 8081

export const subirXml = async (file) => {
  const formData = new FormData();
  formData.append('xml', file);

  const response = await fetch(`${PHP_API_URL}/xml/upload`, {
    method: 'POST',
    body: formData,
  });
  return await response.json();
};

export const obtenerTecnicos = async () => {
  const response = await api.get('/users/tecnicos');
  return response.data;
};

export const checkAvailability = async (tecnico_id, fecha_inicio, fecha_fin) => {
  const response = await api.post('/agenda/check-availability', {
    tecnico_id,
    fecha_inicio,
    fecha_fin,
  });
  return response.data;
};

export const createCasoFromCotizacion = async (data) => {
  const response = await api.post('/casos/create-from-cotizacion', data);
  return response.data;
};

export const autorizarCotizacion = async (id) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/autorizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const powerCloneCotizacion = async (cotizacionData) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/powerclone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cotizacionData)
  });
  return await response.json();
};

export const obtenerPendientes = async () => {
  const response = await fetch(`${PHP_API_URL}/admin/pendientes`);
  return await response.json();
};

export const obtenerRecursos = async () => {
  const response = await fetch(`${PHP_API_URL}/recursos`);
  return await response.json();
};

export const vincularProducto = async (idMapeo, idRecurso) => {
  const response = await fetch(`${PHP_API_URL}/admin/vincular`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_mapeo: idMapeo, id_recurso: idRecurso })
  });
  return await response.json();
};

export const crearRecurso = async (nombre, unidad) => {
  const response = await fetch(`${PHP_API_URL}/recursos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, unidad, tipo: 'MATERIAL' })
  });
  return await response.json();
};

export const updateRecurso = async (id, datos) => {
  const response = await fetch(`${PHP_API_URL}/recursos/editar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, ...datos }) 
  });
  return await response.json();
};

export const deleteRecurso = async (id) => {
  const response = await fetch(`${PHP_API_URL}/recursos/eliminar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const obtenerInventarioAdmin = async () => {
  const response = await fetch(`${PHP_API_URL}/admin/inventario`);
  return await response.json();
};

export const aprobarRecurso = async (id) => {
  const response = await fetch(`${PHP_API_URL}/recursos/aprobar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  return await response.json();
};

// --- GESTIÓN DE COTIZACIONES ---

export const obtenerListadoCotizaciones = async () => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizaciones`);
  return await response.json();
};

export const aplicarDescuento = async (idCotizacion, porcentaje) => {
  const response = await fetch(`${PHP_API_URL}/cotizacion/aplicar-descuento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: idCotizacion, descuento_pct: porcentaje })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || `Error del servidor: ${response.status}`);
  }
  
  return await response.json();
};

// --- ¡NUEVAS FUNCIONES DE APROBACIÓN (FASE 4)! ---

export const autorizarCotizacion = async (id) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/autorizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const rechazarCotizacion = async (id) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/rechazar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const finalizarProyecto = async (id, gastoMaterial, gastoMo) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/finalizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
        id, 
        gasto_material: gastoMaterial, 
        gasto_mo: gastoMo 
    })
  });
  return await response.json();
};

export const clonarCotizacion = async (id) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/clonar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const reenviarCorreo = async (id) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/reenviar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id })
  });
  return await response.json();
};

// --- CONFIGURACIÓN FINANCIERA (SALA DE MÁQUINAS) ---

export const obtenerConfiguracion = async () => {
  const response = await fetch(`${PHP_API_URL}/admin/configuracion`);
  return await response.json();
};

export const actualizarConfiguracion = async (nuevosValores) => {
  const response = await fetch(`${PHP_API_URL}/admin/configuracion/actualizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: nuevosValores })
  });
  return await response.json();
};

// --- EDITOR MAESTRO ---
export const obtenerDetalleCotizacion = async (id) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/detalle?id=${id}`);
  return await response.json();
};

export const guardarCambiosCotizacion = async (payload) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/guardar-cambios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return await response.json();
};
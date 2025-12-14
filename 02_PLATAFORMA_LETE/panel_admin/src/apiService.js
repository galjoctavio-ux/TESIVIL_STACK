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
const PHP_API_URL = '/api';

// AYUDA: Función para obtener headers con el token actual
const getAuthHeaders = (isJson = true) => {
  const token = localStorage.getItem('authToken');
  const headers = {
    'Authorization': `Bearer ${token}` // <--- AQUÍ ESTÁ LA LLAVE MAESTRA
  };
  if (isJson) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
};

// 1. SUBIDA DE XML (SOPORTE MULTI-ARCHIVO)
export const subirXml = async (files) => {
  const formData = new FormData();

  // Verificamos si es una lista de archivos (FileList) o un array
  if (files instanceof FileList || Array.isArray(files)) {
    for (let i = 0; i < files.length; i++) {
      // IMPORTANTE: Usamos 'xml[]' para que PHP lo reciba como array
      formData.append('xml[]', files[i]);
    }
  } else {
    // Soporte legacy por si acaso envías un solo archivo suelto
    formData.append('xml[]', files);
  }

  const response = await fetch(`${PHP_API_URL}/xml/upload`, {
    method: 'POST',
    headers: getAuthHeaders(false), // false porque el navegador pone el boundary del FormData
    body: formData,
  });
  return await response.json();
};

// Las funciones de Node (axios) se quedan igual porque ya tienen el interceptor
export const obtenerTecnicos = async () => {
  const response = await api.get('/usuarios/tecnicos');
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

// --- AQUÍ EMPIEZAN LAS CORRECCIONES A LAS PETICIONES PHP ---

export const powerCloneCotizacion = async (cotizacionData) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/powerclone`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(cotizacionData)
  });
  return await response.json();
};

export const obtenerPendientes = async () => {
  const response = await fetch(`${PHP_API_URL}/admin/pendientes`, {
    headers: getAuthHeaders()
  });
  return await response.json();
};

export const obtenerRecursos = async () => {
  const response = await fetch(`${PHP_API_URL}/recursos`, {
    headers: getAuthHeaders()
  });
  return await response.json();
};

export const vincularProducto = async (idMapeo, idRecurso) => {
  const response = await fetch(`${PHP_API_URL}/admin/vincular`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id_mapeo: idMapeo, id_recurso: idRecurso })
  });
  return await response.json();
};

export const crearRecurso = async (nombre, unidad) => {
  const response = await fetch(`${PHP_API_URL}/recursos`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ nombre, unidad, tipo: 'MATERIAL' })
  });
  return await response.json();
};

export const updateRecurso = async (id, datos) => {
  const response = await fetch(`${PHP_API_URL}/recursos/editar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id, ...datos })
  });
  return await response.json();
};

export const deleteRecurso = async (id) => {
  const response = await fetch(`${PHP_API_URL}/recursos/eliminar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const obtenerInventarioAdmin = async () => {
  const response = await fetch(`${PHP_API_URL}/admin/inventario`, {
    headers: getAuthHeaders()
  });
  return await response.json();
};

export const aprobarRecurso = async (id) => {
  const response = await fetch(`${PHP_API_URL}/recursos/aprobar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id })
  });
  return await response.json();
};

// --- GESTIÓN DE COTIZACIONES (ESTA ES LA QUE FALLABA EN TU FOTO) ---

export const obtenerListadoCotizaciones = async () => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizaciones`, {
    headers: getAuthHeaders() // Ahora sí enviamos el token
  });

  if (response.status === 401) {
    // Opcional: Manejar redirección si el token expiró, 
    // aunque el AuthContext lo suele manejar al recargar.
    console.error("Sesión expirada en PHP");
  }

  return await response.json();
};

export const aplicarDescuento = async (idCotizacion, porcentaje) => {
  const response = await fetch(`${PHP_API_URL}/cotizacion/aplicar-descuento`, {
    method: 'POST',
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const rechazarCotizacion = async (id) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/rechazar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const finalizarProyecto = async (id, gastoMaterial, gastoMo) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/finalizar`, {
    method: 'POST',
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const reenviarCorreo = async (id) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/reenviar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id })
  });
  return await response.json();
};

// --- CONFIGURACIÓN FINANCIERA ---

export const obtenerConfiguracion = async () => {
  const response = await fetch(`${PHP_API_URL}/admin/configuracion`, {
    headers: getAuthHeaders()
  });
  return await response.json();
};

export const actualizarConfiguracion = async (nuevosValores) => {
  const response = await fetch(`${PHP_API_URL}/admin/configuracion/actualizar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ config: nuevosValores })
  });
  return await response.json();
};

// --- EDITOR MAESTRO ---
export const obtenerDetalleCotizacion = async (id) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/detalle?id=${id}`, {
    headers: getAuthHeaders()
  });
  return await response.json();
};

export const guardarCambiosCotizacion = async (payload) => {
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/guardar-cambios`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  return await response.json();
};

export const agendarCotizacion = async (id) => {
  // CORRECCIÓN: Usamos PHP_API_URL y getAuthHeaders para mantener coherencia
  const response = await fetch(`${PHP_API_URL}/admin/cotizacion/agendar`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ id })
  });
  return await response.json();
};

export const deleteCaso = async (id) => {
  // Asegúrate de que tu api instance tenga el token de Admin
  const response = await api.delete(`/casos/${id}`);
  return response.data;
};


// Función que consulta el DASHBOARD CRM V1 (Dejamos la original por seguridad)
export const getCrmDashboard = async () => {
  const response = await api.get('/clientes/admin-dashboard');
  return response.data;
};

// Función NUEVA que consulta el DASHBOARD CRM V2 (El Cerebro Unificado)
export const getCrmDashboardV2 = async () => {
  const response = await api.get('/clientes/admin-dashboard-v2');
  return response.data.data; // Nota: El nuevo controlador devuelve { data: [...] }, por eso apuntamos a .data.data
};

export const forceAnalyze = async (clientId) => {
  const response = await api.patch(`/clientes/${clientId}/force-analyze`);
  return response.data;
};

export const getChatHistory = async (clientId) => {
  const response = await api.get(`/clientes/${clientId}/chat`);
  return response.data;
};
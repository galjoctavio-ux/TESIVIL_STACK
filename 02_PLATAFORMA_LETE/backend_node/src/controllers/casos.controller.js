import { supabaseAdmin } from '../services/supabaseClient.js';
import eaPool from '../services/eaDatabase.js'; // --- AÑADIDO: Importar la conexión a E!A ---

// POST /casos (Crear nuevo caso)
export const createCaso = async (req, res) => {
  const { cliente_nombre, cliente_direccion, cliente_telefono, comentarios_iniciales } = req.body;

  if (!cliente_nombre || !cliente_direccion) {
    return res.status(400).json({ error: 'Nombre y dirección del cliente son requeridos' });
  }

  try {
    // Como el middleware limpió el cliente, esto usa la SERVICE_KEY
    // y se salta el RLS
    const { data, error } = await supabaseAdmin
      .from('casos')
      .insert({
        cliente_nombre,
        cliente_direccion,
        cliente_telefono,
        comentarios_iniciales,
        status: 'pendiente' // Status inicial
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error al crear caso:', error);
    res.status(500).json({ error: 'Error al crear el caso', details: error.message });
  }
};

// GET /casos (Listar casos por rol)
export const getCasos = async (req, res) => {
  // req.user fue añadido por el middleware requireAuth
  const { id: userId, rol } = req.user;

  try {
    // Construimos la query base
    let query = supabaseAdmin
      .from('casos')
      .select('id, cliente_nombre, cliente_direccion, cliente_telefono, status, fecha_creacion, tipo, tecnico:profiles(nombre)')
      .order('fecha_creacion', { ascending: false });

    // ¡Lógica de Roles!
    if (rol === 'admin') {
      // El admin ve todo (no añade filtros)
      console.log('Listando casos para ADMIN');
    } else if (rol === 'tecnico') {
      // El técnico solo ve sus casos asignados
      console.log(`Listando casos para TECNICO: ${userId}`);
      query = query.eq('tecnico_id', userId);
    } else {
      return res.status(403).json({ error: 'Rol no autorizado para ver casos' });
    }

    // Ejecutamos la query
    const { data, error } = await query;

    if (error) throw error;
    res.status(200).json(data);

  } catch (error) {
    console.error('Error al listar casos:', error);
    res.status(500).json({ error: 'Error al listar los casos', details: error.message });
  }
};

// PUT /casos/:id (Asignar/Actualizar caso)
export const updateCaso = async (req, res) => {
  const { id } = req.params;
  // Extraemos todos los campos potencialmente actualizables
  const { tecnico_id, status, cliente_nombre, cliente_direccion, cliente_telefono } = req.body;

  // Creamos el objeto de actualización dinámicamente
  const updates = {};
  if (tecnico_id) updates.tecnico_id = tecnico_id;
  if (status) updates.status = status;
  if (cliente_nombre) updates.cliente_nombre = cliente_nombre;
  if (cliente_direccion) updates.cliente_direccion = cliente_direccion;
  if (cliente_telefono) updates.cliente_telefono = cliente_telefono;

  // Validamos que al menos un campo se esté enviando
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Se requiere al menos un campo para actualizar.' });
  }

  // Lógica de negocio: Si asignamos un técnico, el status cambia a 'asignado'
  // Esto sobreescribe cualquier status que se haya enviado, asegurando consistencia.
  if (tecnico_id) {
    updates.status = 'asignado';
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('casos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al actualizar caso:', error);
    res.status(500).json({ error: 'Error al actualizar el caso', details: error.message });
D  }
};

// --- NUEVO: Controlador para obtener un caso por ID ---
export const getCasoById = async (req, res) => {
  const { id: casoId } = req.params;
  const { id: userId, rol } = req.user;

  try {
    const { data: caso, error } = await supabaseAdmin
      .from('casos')
      .select(`
        id,
        cliente_nombre,
        cliente_direccion,
        cliente_telefono,
        comentarios_iniciales,
        status,
        fecha_creacion,
        tecnico_id,
        tecnico:profiles ( nombre )
      `)
      .eq('id', casoId)
      .single();

    if (error) throw error;
    if (!caso) return res.status(404).json({ message: 'Caso no encontrado.' });

    // Authorization: Admin can see any case, technician can only see their own.
    if (rol === 'admin' || (rol === 'tecnico' && caso.tecnico_id === userId)) {
      return res.json(caso);
    }

    return res.status(403).json({ message: 'No autorizado para ver este caso.' });

  } catch (error) {
    console.error('Error al obtener caso por ID:', error);
    res.status(500).json({ message: 'Error al obtener el caso.', details: error.message });
  }
};

export const createCasoFromCotizacion = async (req, res) => {
  const {
    cotizacionId,
    tecnico_id, // Este es el ID externo (Google/Firebase)
    fecha_inicio,
    fecha_fin,
    cliente_nombre,
    cliente_direccion
  } = req.body;

  // Validación básica
  if (!cotizacionId || !tecnico_id || !fecha_inicio || !fecha_fin || !cliente_nombre) {
    return res.status(400).json({ error: 'Faltan campos requeridos para agendar.' });
  }

  try {
    // 1. Obtener el ID interno de E!A del técnico
    // (Necesitamos traducir el ID de Google/Auth al ID numérico de E!A)
    const { data: perfilTecnico, error: errorPerfil } = await supabaseAdmin
      .from('profiles')
      .select('ea_user_id')
      .eq('id', tecnico_id)
      .single();

    // Verificamos usando el nombre correcto de la columna
    if (errorPerfil || !perfilTecnico?.ea_user_id) {
       console.error("Error perfil:", errorPerfil, perfilTecnico);
       return res.status(400).json({ error: 'El técnico no está sincronizado con la agenda (Falta ea_user_id).' });
    }
    
    const idProvider = perfilTecnico.ea_user_id; // <--- CAMBIO AQUÍ
    // 2. Crear Caso en Supabase
    const { data: newCaso, error: casoError } = await supabaseAdmin
      .from('casos')
      .insert({
        cliente_nombre,
        cliente_direccion,
        tecnico_id, // Aquí sí va el ID externo
        tipo: 'proyecto',
        status: 'asignado',
        //origen_cotizacion_id: cotizacionId // (Opcional: si tienes esta columna para rastreo)
      })
      .select()
      .single();

    if (casoError) throw new Error('Error al crear el caso en Supabase: ' + casoError.message);

    // 3. Generar Hash para Easy!Appointments (Obligatorio)
    const hash = crypto.randomBytes(16).toString('hex');

    // 4. Insertar Cita en Easy!Appointments
    // Notas: is_unavailable = 0 (Cita real), id_services = NULL (o pon un ID si es estricto)
    const eaQuery = `
      INSERT INTO ea_appointments 
      (book_datetime, start_datetime, end_datetime, notes, hash, is_unavailable, id_users_provider, id_users_customer, id_services)
      VALUES (NOW(), ?, ?, ?, ?, 0, ?, NULL, NULL);
    `;

    const plainNotes = `Proyecto #${newCaso.id}: ${cliente_nombre}. (Desde Cotización)`;

    const [eaResult] = await eaPool.query(eaQuery, [
      fecha_inicio,
      fecha_fin,
      plainNotes,
      hash,
      idProvider
    ]);

    if (eaResult.affectedRows === 0) {
      throw new Error('No se pudo insertar la cita en Easy!Appointments.');
    }

    res.status(201).json({ message: 'Caso y agenda creados con éxito', caso: newCaso });

  } catch (error) {
    console.error('Error en createCasoFromCotizacion:', error);
    res.status(500).json({ error: error.message });
  }
};

export const cerrarCasoManualTecnico = async (req, res) => {
  const { id: casoId } = req.params;
  const { id: tecnicoId } = req.user; // ID del técnico autenticado

  try {
    // 1. Verificamos que el caso existe y pertenece al técnico.
    const { data: caso, error: findError } = await supabaseAdmin
      .from('casos')
      .select('id, tecnico_id, status')
      .eq('id', casoId)
      .single();

    if (findError || !caso) {
      return res.status(404).json({ error: 'Caso no encontrado.' });
    }

    if (caso.tecnico_id !== tecnicoId) {
      return res.status(403).json({ error: 'No tienes permiso para modificar este caso.' });
    }

    if (caso.status === 'completado') {
      return res.status(400).json({ error: 'El caso ya ha sido cerrado anteriormente.' });
    }

    // 2. Si todo es correcto, actualizamos el estado a "completado".
    const { data: updatedCaso, error: updateError } = await supabaseAdmin
      .from('casos')
      .update({ status: 'completado' })
      .eq('id', casoId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    res.status(200).json(updatedCaso);

  } catch (error) {
    console.error('Error al cerrar el caso manualmente:', error);
    res.status(500).json({ error: 'Error interno al cerrar el caso.', details: error.message });
  }
};

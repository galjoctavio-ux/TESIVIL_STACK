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
      .select(`
        id,
        cliente_nombre,
        cliente_direccion,
        status,
        fecha_creacion,
        tecnico:profiles ( nombre )
      `)
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
  const { tecnico_id, status } = req.body; // El admin enviará esto

  if (!tecnico_id && !status) {
    return res.status(400).json({ error: 'Se requiere "tecnico_id" o "status" para actualizar' });
  }

  // Creamos el objeto de actualización dinámicamente
  const updates = {};
  if (tecnico_id) updates.tecnico_id = tecnico_id;
  if (status) updates.status = status;

  // Si asignamos un técnico, cambiamos el status automáticamente
  if (tecnico_id) updates.status = 'asignado';

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

// --- AÑADIDO: Controlador para el "Magic Link" ---
export const getCasoPublico = async (req, res) => {
  const { token } = req.params; // El UUID 'f47ac10b-...'

  if (!token) {
    return res.status(400).json({ message: 'Token no proporcionado.' });
  }

  try {
    // 1. Buscar el token en E!A (MariaDB)
    const sql = `
      SELECT notas_estructuradas 
      FROM ea_appointments
      WHERE JSON_EXTRACT(notas_estructuradas, '$.magic_token') = ?;
    `;
    
    const [rows] = await eaPool.query(sql, [token]);

    if (rows.length === 0) {
      // Si no hay filas, el token es inválido o falso
      return res.status(404).json({ message: 'Enlace no válido o expirado.' });
    }

    // 2. Extraer el caso_id del JSON
    const notas = rows[0].notas_estructuradas; // (viene como string)
    const { caso_id } = JSON.parse(notas);

    if (!caso_id) {
      return res.status(500).json({ message: 'Error interno: No se encontró ID del caso.' });
    }

    // 3. Buscar el caso en tu BD principal (Supabase)
    // Usamos el SELECT de tu getCasos para ser consistentes
    const { data: caso, error: supabaseError } = await supabaseAdmin
      .from('casos') 
      .select(`
        id,
        cliente_nombre,
        cliente_direccion,
        cliente_telefono,
        comentarios_iniciales,
        status,
        fecha_creacion,
        tecnico:profiles ( nombre )
      `) 
      .eq('id', caso_id)
      .single(); // Esperamos solo uno

    if (supabaseError || !caso) {
      return res.status(404).json({ message: 'Caso no encontrado.' });
    }

    // 4. ¡Éxito! Enviar los datos del caso a la PWA
    res.json(caso);

  } catch (error) {
    console.error('Error al validar magic link:', error);
    res.status(500).json({ message: 'Error al procesar el enlace.' });
  }
};

// --- NUEVO: Controlador para crear Caso y Cita desde Cotización ---
export const createCasoFromCotizacion = async (req, res) => {
  const {
    cotizacionId,
    tecnico_id,
    fecha_inicio,
    fecha_fin,
    cliente_nombre,
    cliente_direccion
  } = req.body;

  // Validación básica
  if (!cotizacionId || !tecnico_id || !fecha_inicio || !fecha_fin || !cliente_nombre || !cliente_direccion) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  try {
    // === PASO A: Crear Caso en Supabase ===
    const { data: newCaso, error: casoError } = await supabaseAdmin
      .from('casos')
      .insert({
        cliente_nombre,
        cliente_direccion,
        tecnico_id,
        tipo: 'proyecto', // Asignar el tipo "proyecto"
        status: 'asignado' // Asignar el status inicial
      })
      .select()
      .single();

    if (casoError) {
      console.error('Error al crear el caso en Supabase:', casoError);
      throw new Error('Error al crear el caso en Supabase.');
    }

    // === PASO B: Agendar en Easy!Appointments ===
    const notas_estructuradas = JSON.stringify({
      caso_id: newCaso.id,
      cotizacion_id: cotizacionId
    });

    const eaQuery = `
      INSERT INTO ea_appointments (id_users_provider, start_datetime, end_datetime, notes, notas_estructuradas)
      VALUES (?, ?, ?, ?, ?);
    `;

    // Usamos el nombre del cliente en el campo 'notes' para referencia rápida en EA
    const plainNotes = `Proyecto para: ${cliente_nombre}.`;

    const [eaResult] = await eaPool.query(eaQuery, [
      tecnico_id,
      fecha_inicio,
      fecha_fin,
      plainNotes,
      notas_estructuradas
    ]);

    if (eaResult.affectedRows === 0) {
      // Este es un caso de fallo crítico. El caso se creó en Supabase pero no en EA.
      // En un sistema real, aquí se debería implementar una lógica de compensación
      // (ej: borrar el caso de Supabase o marcarlo como "error_agendamiento").
      // Por ahora, solo informamos el error.
      console.error('Error crítico: El caso se creó en Supabase pero falló el agendamiento en Easy!Appointments.');
      return res.status(500).json({
        error: 'El caso fue creado, pero la cita no pudo ser agendada. Por favor, revise manualmente.',
        caso_creado: newCaso
      });
    }

    // === PASO C: Éxito ===
    res.status(201).json(newCaso);

  } catch (error) {
    console.error('Error en el proceso de creación desde cotización:', error);
    res.status(500).json({ error: 'Error en el servidor al procesar la solicitud.', details: error.message });
  }
};

import { randomBytes } from 'crypto'; // <--- Importamos SOLO lo que necesitamos
import { supabaseAdmin } from '../services/supabaseClient.js';
import eaPool from '../services/eaDatabase.js'; // --- AÑADIDO: Importar la conexión a E!A ---
import { getFinancialConfigInternal } from './config.controller.js'; // <--- NUEVO IMPORT

// --- NUEVO: Helper para obtener configuración financiera ---
async function getFinancialConfig() {
  const { data, error } = await supabaseAdmin.from('configuracion_financiera').select('*');
  if (error || !data) return {};
  // Convierte array a objeto: { 'PAGO_VISITA_BASE': 200, ... }
  return data.reduce((acc, item) => ({ ...acc, [item.clave]: Number(item.valor) }), {});
}

// POST /casos (Crear Caso + Gestión Automática de Cliente CRM)
export const createCaso = async (req, res) => {
  const {
    cliente_nombre,
    cliente_direccion,
    cliente_telefono,
    comentarios_iniciales,
    ubicacion_lat, // Opcionales
    ubicacion_lng,
    google_maps_link
  } = req.body;

  if (!cliente_telefono || !cliente_nombre) {
    return res.status(400).json({ error: 'Nombre y Teléfono son obligatorios para el CRM.' });
  }

  try {
    // 1. LÓGICA CRM: Buscar o Crear Cliente
    // Buscamos si ya existe el cliente por teléfono (limpiando espacios)
    const telefonoLimpio = cliente_telefono.replace(/\D/g, '');

    let { data: cliente } = await supabaseAdmin
      .from('clientes')
      .select('id, nombre_completo')
      .eq('telefono', telefonoLimpio)
      .single();

    if (!cliente) {
      // Si no existe, lo creamos "al vuelo"
      const { data: newClient, error: clientError } = await supabaseAdmin
        .from('clientes')
        .insert({
          telefono: telefonoLimpio,
          nombre_completo: cliente_nombre,
          direccion_principal: cliente_direccion,
          google_maps_link: google_maps_link,
          ubicacion_lat,
          ubicacion_lng
        })
        .select()
        .single();

      if (clientError) throw new Error(`Error creando cliente: ${clientError.message}`);
      cliente = newClient;
    }

    // 2. Crear el Caso vinculado al Cliente
    const { data: caso, error: casoError } = await supabaseAdmin
      .from('casos')
      .insert({
        cliente_id: cliente.id, // VINCULACIÓN IMPORTANTE
        status: 'pendiente',
        tipo_servicio: 'DIAGNOSTICO', // Default
        descripcion_problema: comentarios_iniciales
      })
      .select()
      .single();

    if (casoError) throw casoError;

    res.status(201).json({
      message: 'Caso creado exitosamente',
      caso,
      cliente_vinculado: cliente.nombre_completo
    });

  } catch (error) {
    console.error('Error al crear caso:', error);
    res.status(500).json({ error: 'Error interno', details: error.message });
  }
};

// GET /casos (Listar)
export const getCasos = async (req, res) => {
  const { id: userId, rol } = req.user;

  try {
    let query = supabaseAdmin
      .from('casos')
      .select(`
        id, 
        status, 
        created_at,
        tipo_servicio,
        cliente:clientes ( nombre_completo, telefono, direccion_principal, calificacion ),
        tecnico:profiles ( nombre )
      `)
      .order('created_at', { ascending: false });

    if (rol === 'tecnico') {
      query = query.eq('tecnico_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error('Error al listar casos:', error);
    res.status(500).json({ error: error.message });
  }
};
// --- REEMPLAZA SOLO LA FUNCIÓN cerrarCaso ---
export const cerrarCaso = async (req, res) => {
  const { id: casoId } = req.params;
  const { id: tecnicoId } = req.user;
  const {
    metodoPago, // 'EFECTIVO', 'TRANSFERENCIA', 'TARJETA'
    montoCobrado,
    calificacionCliente,
    requiereCotizacion,
    notasCierre,
    tipoClienteCRM
  } = req.body;

  try {
    // 1. Obtener Tarifas Vigentes de la BD
    const config = await getFinancialConfigInternal();
    // Si no encuentra el valor en BD, usa 200 por seguridad
    const COMISION_BASE = config['PAGO_VISITA_BASE'] || 200;

    // 2. Actualizar Caso (Datos operativos)
    const { error: updateError } = await supabaseAdmin
      .from('casos')
      .update({
        status: 'cerrado',
        fecha_cierre: new Date(),
        metodo_pago_cierre: metodoPago,
        monto_cobrado: montoCobrado,
        monto_pagado_tecnico: COMISION_BASE, // Guardamos cuánto se pagó en ese momento histórico
        requiere_cotizacion: requiereCotizacion,
        notas_cierre: notasCierre,
        calificacion_servicio_cliente: calificacionCliente,
        tecnico_id: tecnicoId
      })
      .eq('id', casoId);

    if (updateError) throw updateError;

    // 3. MOVIMIENTOS DE BILLETERA (Lógica: Técnico como Cajero)
    const transacciones = [];

    // A. LA COMISIÓN (Siempre suma a favor del técnico: +$200)
    transacciones.push({
      tecnico_id: tecnicoId,
      caso_id: casoId,
      tipo: 'VISITA_COMISION',
      monto: COMISION_BASE,
      descripcion: `Comisión Caso #${casoId}`,
      estado: 'APROBADO'
    });

    // B. EL COBRO EN EFECTIVO (Resta porque el técnico se quedó el dinero: -$400)
    if (metodoPago === 'EFECTIVO') {
      transacciones.push({
        tecnico_id: tecnicoId,
        caso_id: casoId,
        tipo: 'COBRO_EFECTIVO',
        monto: -Math.abs(montoCobrado), // Aseguramos que sea negativo
        descripcion: `Retención Efectivo Caso #${casoId}`,
        estado: 'APROBADO'
      });
    }
    // NOTA: Si fue Transferencia, no restamos nada. 
    // Resultado neto Transferencia: +$200 (Ganancia pura en saldo).
    // Resultado neto Efectivo ($400): +$200 - $400 = -$200 (Deuda con empresa).

    // Insertar Transacciones
    const { error: walletError } = await supabaseAdmin
      .from('billetera_transacciones')
      .insert(transacciones);

    if (walletError) throw walletError;

    // 4. Actualizar Semáforo CRM (Opcional, si enviaste el dato)
    if (tipoClienteCRM) {
      // Aquí podrías actualizar la tabla clientes si tienes el cliente_id a mano, 
      // o hacerlo en un paso separado. Por ahora lo dejamos listo para el futuro.
    }

    res.status(200).json({ success: true, message: 'Caso cerrado y finanzas calculadas.' });

  } catch (error) {
    console.error('Error cerrando caso:', error);
    res.status(500).json({ error: error.message });
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
    D
  }
};

// GET /casos/:id
export const getCasoById = async (req, res) => {
  const { id: casoId } = req.params;
  const { id: userId, rol } = req.user;

  try {
    const { data: caso, error } = await supabaseAdmin
      .from('casos')
      .select(`
        id,
        status,
        created_at,
        tipo_servicio,
        cliente:clientes (
          id,
          nombre_completo,
          telefono,
          direccion_principal,
          google_maps_link,
          calificacion,
          notas_internas
        ),
        tecnico:profiles ( nombre )
      `)
      .eq('id', casoId)
      .single();

    if (error) throw error;
    if (!caso) return res.status(404).json({ message: 'Caso no encontrado.' });

    if (rol === 'admin' || (rol === 'tecnico' && caso.tecnico_id === userId)) {
      return res.json(caso);
    }

    return res.status(403).json({ message: 'No autorizado para ver este caso.' });

  } catch (error) {
    console.error('Error al obtener caso por ID:', error);
    res.status(500).json({ message: 'Error al obtener el caso.', details: error.message });
  }
};

// =========================================================================================
// CORRECCIÓN PARA createCasoFromCotizacion
// =========================================================================================
export const createCasoFromCotizacion = async (req, res) => {
  const {
    cotizacionId,
    tecnico_id, // ID externo (Supabase Auth / Firebase)
    fecha_inicio,
    fecha_fin,
    cliente_nombre,
    cliente_direccion,
    cliente_telefono // <--- ASUMIMOS que el front-end enviará el teléfono
  } = req.body;

  // Validación básica
  if (!cotizacionId || !tecnico_id || !fecha_inicio || !fecha_fin || !cliente_nombre || !cliente_telefono) {
    return res.status(400).json({ error: 'Faltan campos requeridos: ID Cotización, Técnico, Fechas, Nombre y Teléfono del Cliente.' });
  }

  try {
    // 0. LÓGICA CRM: Buscar o Crear Cliente
    const telefonoLimpio = cliente_telefono.replace(/\D/g, '');
    let cliente = null;
    let clienteId = null;

    // A. Buscar Cliente
    let { data: existingClient } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('telefono', telefonoLimpio)
      .single();

    if (existingClient) {
      clienteId = existingClient.id;
    } else {
      // B. Si no existe, lo creamos "al vuelo"
      const { data: newClient, error: clientError } = await supabaseAdmin
        .from('clientes')
        .insert({
          telefono: telefonoLimpio,
          nombre_completo: cliente_nombre,
          direccion_principal: cliente_direccion,
          // otros campos opcionales del cliente no se requieren aquí
        })
        .select('id')
        .single();

      if (clientError) throw new Error(`Error creando cliente para cotización: ${clientError.message}`);
      clienteId = newClient.id;
    }

    // 1. Obtener el ID interno de E!A del técnico
    const { data: perfilTecnico, error: errorPerfil } = await supabaseAdmin
      .from('profiles')
      .select('ea_user_id')
      .eq('id', tecnico_id)
      .single();

    if (errorPerfil || !perfilTecnico?.ea_user_id) {
      return res.status(400).json({ error: 'El técnico seleccionado no está sincronizado con la agenda (Falta ea_user_id).' });
    }

    const idProvider = perfilTecnico.ea_user_id; // ID numérico de E!A

    // 2. CORRECCIÓN: VALIDACIÓN DE TRASLAPE (Misma lógica, solo ajusto el número del paso)
    const sqlCheck = `
        SELECT COUNT(*) as total 
        FROM ea_appointments 
        WHERE id_users_provider = ? 
        AND (
            (start_datetime < ? AND end_datetime > ?) -- Lógica estándar de traslape
        )
    `;

    const [rows] = await eaPool.query(sqlCheck, [idProvider, fecha_fin, fecha_inicio]);

    if (rows[0].total > 0) {
      return res.status(409).json({
        error: 'HORARIO NO DISPONIBLE: El técnico ya tiene una cita en ese rango de horas.'
      });
    }

    // 3. Crear Caso en Supabase
    // ¡CORREGIDO! Usamos cliente_id en lugar de cliente_nombre/cliente_direccion
    const { data: newCaso, error: casoError } = await supabaseAdmin
      .from('casos')
      .insert({
        cliente_id: clienteId, // <-- CORRECCIÓN CLAVE
        tecnico_id,
        tipo_servicio: 'PROYECTO', // Cambio a PROYECTO para diferenciar
        status: 'asignado',
        descripcion_problema: `Caso originado de Cotización #${cotizacionId} (Proyecto)`
        // Si tienes una columna origen_cotizacion_id en `casos`, puedes descomentar la siguiente línea
        // origen_cotizacion_id: cotizacionId 
      })
      .select()
      .single();

    if (casoError) throw new Error('Error al crear el caso en Supabase: ' + casoError.message);

    // 4. Generar Hash y insertar Cita en Easy!Appointments
    const hash = randomBytes(16).toString('hex');
    const EA_SERVICE_ID = 1;
    const EA_CUSTOMER_ID = 21; // Mantengo este Customer ID genérico como lo tenías

    const eaQuery = `
      INSERT INTO ea_appointments 
      (book_datetime, start_datetime, end_datetime, notes, hash, is_unavailable, id_users_provider, id_users_customer, id_services)
      VALUES (NOW(), ?, ?, ?, ?, 0, ?, ?, ?); 
    `;

    const plainNotes = `Proyecto #${newCaso.id}: ${cliente_nombre}. (Desde Cotización)`;

    const [eaResult] = await eaPool.query(eaQuery, [
      fecha_inicio,
      fecha_fin,
      plainNotes,
      hash,
      idProvider,
      EA_CUSTOMER_ID,
      EA_SERVICE_ID
    ]);

    if (eaResult.affectedRows === 0) {
      throw new Error('No se pudo insertar la cita en Easy!Appointments.');
    }

    res.status(201).json({
      message: 'Caso y agenda creados con éxito',
      caso: newCaso,
      cliente_id_vinculado: clienteId
    });

  } catch (error) {
    console.error('Error en createCasoFromCotizacion:', error);
    res.status(500).json({ error: error.message });
  }
};
// =========================================================================================
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

// backend_node/src/controllers/casos.controller.js

export const getDetalleTecnico = async (req, res) => {
  const { id: casoId } = req.params;
  const { id: tecnicoId } = req.user;

  try {
    const { data: caso, error } = await supabaseAdmin
      .from('casos')
      .select(`
        id,
        status,
        created_at,
        tipo_servicio,
        descripcion_problema,
        requiere_cotizacion,
        cliente:clientes (
          nombre_completo,
          direccion_principal,
          google_maps_link,
          ubicacion_lat,
          ubicacion_lng,
          saldo_pendiente 
        ),
        revisiones (
          id,
          voltaje_medido,
          sello_cfe,
          tornillos_flojos,
          resultado_deteccion_fugas,
          created_at
        )
      `)
      .eq('id', casoId)
      .eq('tecnico_id', tecnicoId)
      .maybeSingle(); // <--- CAMBIO CLAVE: Usamos maybeSingle() en vez de single()

    if (error) throw error;

    // Si no encontró nada, respondemos 404 en lugar de explotar con 500
    if (!caso) {
      return res.status(404).json({
        message: 'No se encontró el caso o no está asignado a ti.'
      });
    }

    // SANITIZACIÓN (Igual que antes)
    const respuestaSegura = {
      id: caso.id,
      status: caso.status,
      fecha: caso.created_at,
      tipo: caso.tipo_servicio,
      problema: caso.descripcion_problema,
      aviso_cotizacion: caso.requiere_cotizacion,
      cliente: {
        nombre: caso.cliente?.nombre_completo || 'Cliente',
        direccion: caso.cliente?.direccion_principal || 'Sin dirección',
        maps_link: caso.cliente?.google_maps_link,
        coordenadas: {
          lat: caso.cliente?.ubicacion_lat,
          lng: caso.cliente?.ubicacion_lng
        },
        tiene_deuda: (caso.cliente?.saldo_pendiente > 0)
      },
      ultima_revision: caso.revisiones?.length > 0
        ? caso.revisiones.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
        : null
    };

    res.json(respuestaSegura);

  } catch (error) {
    console.error('Error en getDetalleTecnico:', error);
    res.status(500).json({ message: 'Error interno obteniendo expediente.' });
  }
};

// DELETE /casos/:id (Solo Admin y si no está cerrado)
export const deleteCaso = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Verificar estado del caso
    const { data: caso, error: findError } = await supabaseAdmin
      .from('casos')
      .select('status, id')
      .eq('id', id)
      .single();

    if (findError || !caso) {
      return res.status(404).json({ error: 'Caso no encontrado.' });
    }

    // REGLA DE NEGOCIO: No borrar si ya se cobró/cerró
    if (caso.status === 'cerrado' || caso.status === 'completado') {
      return res.status(403).json({
        error: 'No se puede eliminar un caso CERRADO. Esto afectaría los reportes financieros.'
      });
    }

    // 2. Borrar dependencias (Revisiones técnicas)
    // Supabase no siempre tiene "Cascade Delete" activado por defecto, así que lo hacemos manual.
    const { error: revError } = await supabaseAdmin
      .from('revisiones')
      .delete()
      .eq('caso_id', id);

    if (revError) {
      throw new Error('Error al eliminar revisiones asociadas: ' + revError.message);
    }

    // 3. Borrar el Caso principal
    const { error: deleteError } = await supabaseAdmin
      .from('casos')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw deleteError;
    }

    res.status(200).json({ message: 'Caso y datos asociados eliminados correctamente.' });

  } catch (error) {
    console.error('Error eliminando caso:', error);
    res.status(500).json({ error: error.message });
  }
};

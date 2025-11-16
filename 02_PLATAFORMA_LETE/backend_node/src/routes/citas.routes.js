import express from 'express';
import { supabaseAdmin } from '../services/supabaseClient.js';
import eaPool from '../services/eaDatabase.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { randomUUID } from 'crypto';

const router = express.Router();

// GET /citas/disponibilidad (Sin cambios, ya funciona)
router.get('/disponibilidad', requireAuth, async (req, res) => {
  // ... (tu código de getDisponibilidad) ...
  const { tecnico_id, fecha } = req.query; 

  if (!tecnico_id || !fecha) {
    return res.status(400).json({ message: 'El ID del técnico y la fecha son requeridos.' });
  }
  try {
    const sqlDate = new Date(fecha).toISOString().split('T')[0];
    const sql = `
      SELECT 
        TIME(start_datetime) AS hora_inicio, 
        TIME(end_datetime) AS hora_fin
      FROM ea_appointments
      WHERE id_users_provider = ?
        AND DATE(start_datetime) = ?;
    `;
    const [rows] = await eaPool.query(sql, [tecnico_id, sqlDate]);
    const horariosOcupados = rows.map(cita => ({
      inicio: cita.hora_inicio.substring(0, 5),
      fin: cita.hora_fin.substring(0, 5),
    }));
    res.json(horariosOcupados);
  } catch (error) {
    console.error('Error al consultar disponibilidad E!A:', error);
    res.status(500).json({ message: 'Error al consultar disponibilidad.' });
  }
});


// --- RUTA POST /citas (MEJORA 1 APLICADA) ---
router.post('/', requireAuth, async (req, res) => {
  const {
    // Datos del Caso (de Supabase)
    cliente_nombre,
    tipo_caso, 
    tecnico_id_supabase, // ID de Supabase para asignar el caso
    // Datos de la Cita (de E!A)
    tecnico_id_ea,      // ID de E!A para agendar
    fecha,            
    hora,             
    duracion_horas,
    // Datos de GMap y Notas
    direccion_legible, 
    link_gmaps,       
    notas_adicionales 
    // (cliente_telefono quitado)
  } = req.body;

  if (!tecnico_id_ea || !fecha || !hora || !link_gmaps || !cliente_nombre || !tecnico_id_supabase) {
    return res.status(400).json({ message: 'Faltan datos clave para agendar.' });
  }

  try {
    // --- TAREA 1: Crear el 'Caso' en Supabase ---
    const { data: nuevoCaso, error: casoError } = await supabaseAdmin
      .from('casos') 
      .insert({
        cliente_nombre: cliente_nombre,
        cliente_direccion: direccion_legible, // Guardamos la dirección legible
        tipo: tipo_caso,
        status: 'asignado', // Nace 'agendado'
        tecnico_id: tecnico_id_supabase // Asignado de inmediato
        // (cliente_telefono quitado)
      })
      .select()
      .single();

    if (casoError) throw new Error(`Error Supabase: ${casoError.message}`);

    const caso_id = nuevoCaso.id;

    // --- TAREA 2: Preparar datos E!A ---
    const start_datetime = `${fecha}T${hora}:00`;
    const startObj = new Date(start_datetime);
    const endObj = new Date(startObj.getTime() + (duracion_horas * 60 * 60 * 1000));
    const end_datetime_utc = endObj.toISOString().slice(0, 19).replace('T', ' ');
    const start_datetime_utc = startObj.toISOString().slice(0, 19).replace('T', ' ');

    const notas_estructuradas = JSON.stringify({
      caso_id: caso_id
    });
    const hash = randomUUID();

    // --- TAREA 3: Insertar la 'Cita' en E!A (¡CORREGIDO!) ---
    
    // 1. AÑADIMOS 'id_users_customer' A LA CONSULTA Y UN '?' EXTRA
    const sql = `
      INSERT INTO ea_appointments 
      (id_users_provider, id_services, id_users_customer, book_datetime, start_datetime, end_datetime, location, direccion_link, notes, notas_estructuradas, hash)
      VALUES
      (?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?);
    `;
    
    const ID_CLIENTE_COMODIN = 21; // Esto está bien

    // 2. AHORA EL ARRAY 'values' (CON 10 ELEMENTOS) COINCIDE CON LOS 10 '?'
    const values = [
      tecnico_id_ea,       // 1. id_users_provider
      1,                   // 2. id_services
      ID_CLIENTE_COMODIN,  // 3. id_users_customer (¡Ahora sí!)
      start_datetime_utc,  // 4. start_datetime
      end_datetime_utc,    // 5. end_datetime
      direccion_legible,   // 6. location
      link_gmaps,          // 7. direccion_link
      notas_adicionales,   // 8. notes
      notas_estructuradas, // 9. notas_estructuradas
      hash                 // 10. hash
    ];
    
    // El resto de tu código para ejecutar el query
    // (Asegúrate de tener el try/catch que te puse antes)
    try {
        await eaPool.query(sql, values);
        console.log('TAREA 3: Cita insertada en E!A con éxito.');
    } catch (eaError) {
        console.error('¡FALLO EN TAREA 3 (E!A)!:', eaError.message);
        // Rollback del caso de Supabase
        if (nuevoCaso && nuevoCaso.id) {
           await supabaseAdmin.from('casos').delete().eq('id', nuevoCaso.id);
           console.log(`ROLLBACK: Caso ${nuevoCaso.id} eliminado de Supabase.`);
        }
        throw new Error(`Error E!A: ${eaError.message}`);
    }
    

    res.status(201).json({ 
      message: 'Cita y Caso creados exitosamente.', 
      nuevoCaso: nuevoCaso 
    });

  } catch (error) {
    console.error('Error al crear cita (flujo fusionado):', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
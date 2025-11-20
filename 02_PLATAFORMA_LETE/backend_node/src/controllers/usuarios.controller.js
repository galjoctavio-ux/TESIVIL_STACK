// --- MODIFICADO: Importar eaPool y bcrypt ---
import { supabaseAdmin, supabaseKey } from '../services/supabaseClient.js';
import eaPool from '../services/eaDatabase.js'; // <-- Ya lo tenías
import bcrypt from 'bcryptjs';               // <-- ¡NUEVO!

// --- getTecnicos (OPTIMIZADO Y CORREGIDO) ---
export const getTecnicos = async (req, res) => {
  try {
    console.log('Obteniendo lista de técnicos desde perfiles...');
    
    // 1. Consultamos directo a Supabase (¡Mucho más rápido!)
    // Pedimos explícitamente el ID (UUID) y el ID de E!A
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, nombre, ea_user_id') // <--- OJO: Usamos el nombre real de tu columna
      .eq('rol', 'tecnico');

    if (error) throw error;

    // 2. Mapeamos para que el Frontend reciba exactamente lo que espera
    const tecnicos = profiles.map(profile => ({
      id: profile.id,            // <--- ¡ESTO ARREGLA EL ERROR 400! (Envía el UUID)
      nombre: profile.nombre,    // Nombre para mostrar en el Select
      ea_id: profile.ea_user_id, // Enviamos también el ID de E!A por si acaso
      sincronizado: !!profile.ea_user_id // Flag útil para saber si está listo para agendar
    }));

    console.log(`Técnicos encontrados: ${tecnicos.length}`);
    res.status(200).json(tecnicos);

  } catch (error) {
    console.error('Error al obtener técnicos:', error);
    res.status(500).json({
      error: 'Error al obtener técnicos',
      details: error.message,
    });
  }
};

// --- deleteTecnico (Sin cambios) ---
export const deleteTecnico = async (req, res) => {
  // ... (Tu función deleteTecnico existente va aquí, no cambia)
  const { id } = req.params;
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (userError) {
      if (userError.status === 404) {
        return res.status(404).json({ error: 'Técnico no encontrado en Auth' });
      }
      throw userError;
    }
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', id);
    if (profileError) {
      console.warn('Usuario de Auth eliminado pero el perfil no. Se requiere limpieza manual:', id);
      throw profileError;
    }
    res.status(200).json({ message: 'Técnico eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar técnico', details: error.message });
  }
};

// --- getEaIdFromSupabaseId (Sin cambios) ---
export const getEaIdFromSupabaseId = async (req, res) => {
  // ... (Tu función getEaIdFromSupabaseId existente va aquí, no cambia)
  const { supabase_id } = req.params;
  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(supabase_id);
    if (authError) throw authError;
    const email = user.email;
    const sql = "SELECT id FROM ea_users WHERE email = ? LIMIT 1";
    const [rows] = await eaPool.query(sql, [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Técnico no encontrado en Easy!Appointments. Asegúrate de crearlo en E!A con el mismo email.' });
    }
    res.json({ ea_id: rows[0].id });
  } catch (error) {
    console.error('Error al buscar ID de E!A:', error);
    res.status(500).json({ message: 'Error al sincronizar IDs de técnico', details: error.message });
  }
};


// --- ¡FUNCIÓN createTecnico (VERSIÓN DE SINCRONIZACIÓN TOTAL)! ---
// (Asegúrate de tener "import bcrypt from 'bcryptjs';" al inicio del archivo)

export const createTecnico = async (req, res) => {
  // 1. OBTENEMOS LOS DATOS
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y password son requeridos' });
  }

  let createdAuthUserId = null; // Para rollback de Supabase
  let createdEaUserId = null;   // Para rollback de E!A

  try {
    // --- TAREA 1: Crear el usuario en Supabase Auth ---
    console.log('TAREA 1: Creando nuevo técnico en Supabase Auth...');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (authError) throw new Error(`Error Supabase Auth: ${authError.message}`);
    createdAuthUserId = authData.user.id;
    console.log('TAREA 1: Usuario de Auth creado:', createdAuthUserId);


    // --- TAREA 2 (NUEVO ORDEN): Crear el usuario en E!A (Tabla "ea_users") ---
    // Movemos esta tarea aquí para obtener el ID antes de crear el perfil.
    console.log('TAREA 2: Creando perfil en Easy!Appointments (ea_users)...');
    
    const [firstName, ...lastNameParts] = nombre.split(' ');
    const lastName = lastNameParts.join(' ') || 'Técnico';
    const ID_ROL_PROVEEDOR = 2; // (Rol de Proveedor)

    const sqlInsertUser = `
      INSERT INTO ea_users 
      (first_name, last_name, email, language, timezone, id_roles) 
      VALUES (?, ?, ?, 'es', 'America/Mexico_City', ?);
    `;
    
    const valuesUser = [
      firstName,
      lastName,
      email,
      ID_ROL_PROVEEDOR
    ];

    const [userResult] = await eaPool.query(sqlInsertUser, valuesUser);
    createdEaUserId = userResult.insertId; // Guardamos el ID para las siguientes tareas
    
    console.log(`TAREA 2: Perfil de E!A creado con ID: ${createdEaUserId}.`);


    // --- TAREA 3 (NUEVO ORDEN): Crear el perfil en 'profiles' (Supabase DB) ---
    // Ahora que TENEMOS el 'createdEaUserId', podemos insertarlo.
    console.log('TAREA 3: Creando perfil en Supabase y vinculando ID de E!A...');
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: createdAuthUserId,    // <-- El ID de Supabase Auth
        nombre: nombre,
        rol: 'tecnico',
        ea_user_id: createdEaUserId // <-- ¡LA LÍNEA MÁGICA!
      })
      .select()
      .single();
    
    if (profileError) throw new Error(`Error Supabase Profile: ${profileError.message}`);
    console.log('TAREA 3: Perfil de Supabase creado y vinculado.');


    // --- TAREA 4: Insertar Credenciales y Horario (Tabla "ea_user_settings") ---
    console.log('TAREA 4: Insertando credenciales y horario (ea_user_settings)...');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const defaultWorkingPlan = {
      "monday": {"start":"09:00", "end":"17:00", "breaks":[]},
      "tuesday": {"start":"09:00", "end":"17:00", "breaks":[]},
      "wednesday": {"start":"09:00", "end":"17:00", "breaks":[]},
      "thursday": {"start":"09:00", "end":"17:00", "breaks":[]},
      "friday": {"start":"09:00", "end":"17:00", "breaks":[]},
      "saturday": null,
      "sunday": null
    };

    const sqlInsertSettings = `
      INSERT INTO ea_user_settings 
      (id_users, username, password, working_plan) 
      VALUES (?, ?, ?, ?);
    `;
    
    const valuesSettings = [
      createdEaUserId,
      email,
      hashedPassword,
      JSON.stringify(defaultWorkingPlan)
    ];

    await eaPool.query(sqlInsertSettings, valuesSettings);
    console.log('TAREA 4: Credenciales y horario creados.');


    // --- TAREA 5: Vincular Proveedor al Servicio (Tabla "ea_services_providers") ---
    console.log('TAREA 5: Vinculando proveedor a servicio...');
    
    const ID_SERVICIO_DEFAULT = 1; // (Verifica que tu servicio principal sea el ID 1)
    
    await eaPool.query(
      'INSERT INTO ea_services_providers (id_services, id_users) VALUES (?, ?)',
      [ID_SERVICIO_DEFAULT, createdEaUserId]
    );
    console.log(`TAREA 5: Proveedor ${createdEaUserId} vinculado al servicio ${ID_SERVICIO_DEFAULT}.`);


    // --- ¡ÉXITO TOTAL! ---
    res.status(201).json({
      message: 'Técnico creado y sincronizado 100% en Supabase y E!A.',
      tecnico: {
        id: profileData.id,
        nombre: profileData.nombre,
        rol: profileData.rol,
        email: authData.user.email,
        id_ea: createdEaUserId // <-- Ahora se devuelve vinculado
      }
    });

  } catch (error) {
    console.error('Error completo al crear técnico (flujo sincronizado):', error);

    // --- TAREA DE ROLLBACK (Si algo falla) ---
    // Esta lógica de rollback sigue funcionando perfectamente.
    if (createdEaUserId) {
      console.log(`ROLLBACK: Eliminando de ea_user_settings (ID: ${createdEaUserId})...`);
      await eaPool.query('DELETE FROM ea_user_settings WHERE id_users = ?', [createdEaUserId]);
      // (Faltaba el rollback del servicio, lo añado por seguridad)
      await eaPool.query('DELETE FROM ea_services_providers WHERE id_users = ?', [createdEaUserId]);
      console.log(`ROLLBACK: Eliminando de ea_users (ID: ${createdEaUserId})...`);
      await eaPool.query('DELETE FROM ea_users WHERE id = ?', [createdEaUserId]);
    }

    if (createdAuthUserId) {
      console.log(`ROLLBACK: Eliminando de Supabase Auth (ID: ${createdAuthUserId})...`);
      await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId);
      console.log('ROLLBACK: Usuario de Auth eliminado.');
    }
    
    if (error.code === 'ER_DUP_ENTRY' || (error.message && error.message.includes('1062'))) {
        return res.status(409).json({ error: 'El email o nombre de usuario ya existe en Easy!Appointments.' });
    }

    res.status(500).json({ 
      error: 'Error al crear técnico sincronizado', 
      details: error.message 
    });
  }
};
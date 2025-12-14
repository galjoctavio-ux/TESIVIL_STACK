// src/services/eaDatabase.js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.EA_DB_HOST || '127.0.0.1',
    user: process.env.EA_DB_USER,
    password: process.env.EA_DB_PASSWORD,
    database: process.env.EA_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Función de prueba de conexión
pool.getConnection()
    .then(connection => {
        console.log('✅ Conectado exitosamente a la BD de Easy!Appointments (MariaDB)');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Error al conectar con la BD de Easy!Appointments:', err.code || err.message);
    });

// --- NUEVAS FUNCIONES PARA EL DASHBOARD CRM ---

/**
 * Busca si un teléfono existe en ea_users.
 * Normaliza el teléfono tomando los últimos 10 dígitos para mejorar el match.
 */
export const checkMariaDbStatus = async (telefono) => {
    if (!telefono) return { exists: false, id: null };

    // Limpieza básica: quitar +52, espacios, guiones
    const cleanPhone = telefono.replace(/\D/g, '');
    const searchPhone = cleanPhone.slice(-10); // Usamos los últimos 10 para buscar

    if (searchPhone.length < 7) return { exists: false, id: null }; // Evitar falsos positivos con números cortos

    const query = `
        SELECT id, first_name, last_name 
        FROM ea_users 
        WHERE mobile_number LIKE ? OR phone_number LIKE ?
        LIMIT 1
    `;
    const searchPattern = `%${searchPhone}`;

    try {
        const [rows] = await pool.execute(query, [searchPattern, searchPattern]);

        if (rows.length > 0) {
            return { exists: true, id: rows[0].id };
        }
        return { exists: false, id: null };
    } catch (error) {
        console.error("Error buscando en MariaDB:", error);
        return { exists: false, error: true };
    }
};

/**
 * Verifica si el usuario tiene citas pasadas (completadas).
 */
export const checkPastAppointments = async (eaUserId) => {
    if (!eaUserId) return false;

    // Buscamos citas donde la fecha de inicio sea menor a AHORA
    const query = `
        SELECT count(*) as total
        FROM ea_appointments 
        WHERE id_users_customer = ? 
        AND start_datetime < NOW()
    `;

    try {
        const [rows] = await pool.execute(query, [eaUserId]);
        return rows[0].total > 0;
    } catch (error) {
        console.error("Error verificando citas en MariaDB:", error);
        return false;
    }
};

export default pool;
import pool from '../services/eaDatabase.js';

/**
 * Calcula fechas y crea bloqueos masivos en Easy!Appointments
 */
export const createRecurringUnavailable = async (req, res) => {
    const {
        id_users_provider, // ID del técnico (viene del frontend o del token)
        start_time,        // Ej: "14:00"
        end_time,          // Ej: "18:00"
        days_of_week,      // Array de números [1, 3, 5] (Lun, Mie, Vie)
        date_start,        // "2023-11-23"
        date_end,          // "2024-02-23" (Límite de hasta cuándo repetir)
        reason             // "Clases", "Tiempo Personal", etc.
    } = req.body;

    if (!days_of_week || days_of_week.length === 0) {
        return res.status(400).json({ message: "Debes seleccionar al menos un día." });
    }

    // Validación de seguridad para no explotar la BD
    const start = new Date(date_start);
    const end = new Date(date_end);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 365) {
        return res.status(400).json({ message: "Por seguridad, el máximo permitido es 1 año." });
    }

    const inserts = [];
    let current = new Date(start);

    // 1. Iteramos día por día desde inicio hasta fin
    while (current <= end) {
        const dayIndex = current.getDay(); // 0 = Domingo, 1 = Lunes...

        // 2. Si el día actual está en la lista de días seleccionados por el usuario
        if (days_of_week.includes(dayIndex)) {

            // Formatear fechas para MySQL (YYYY-MM-DD HH:mm:ss)
            const dateStr = current.toISOString().split('T')[0];
            const startDateTime = `${dateStr} ${start_time}:00`;
            const endDateTime = `${dateStr} ${end_time}:00`;

            // Preparamos los valores para el Bulk Insert
            // is_unavailable = 1 es la CLAVE
            inserts.push([
                startDateTime,
                endDateTime,
                1,                 // is_unavailable
                id_users_provider, // Técnico
                reason || 'Tiempo personal', // notes
                new Date()         // book_datetime (ahora)
            ]);
        }

        // Avanzar al siguiente día
        current.setDate(current.getDate() + 1);
    }

    if (inserts.length === 0) {
        return res.json({ message: "No se generaron bloqueos en el rango seleccionado." });
    }

    try {
        // 3. Inserción Masiva (Bulk Insert) para eficiencia
        const query = `
      INSERT INTO ea_appointments 
      (start_datetime, end_datetime, is_unavailable, id_users_provider, notes, book_datetime)
      VALUES ?
    `;

        const [result] = await pool.query(query, [inserts]);

        res.json({
            success: true,
            message: `Se han bloqueado ${result.affectedRows} espacios en tu agenda correctamente.`,
            blocks_created: result.affectedRows
        });

    } catch (error) {
        console.error("Error creando bloqueos:", error);
        res.status(500).json({ message: "Error interno al guardar disponibilidad." });
    }
};
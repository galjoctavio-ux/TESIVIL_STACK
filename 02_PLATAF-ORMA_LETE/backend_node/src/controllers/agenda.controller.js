// src/controllers/agenda.controller.js
import pool from '../services/eaDatabase.js';

/**
 * Verifica si un técnico tiene conflictos de agenda en un rango de fechas.
 */
export const checkAvailability = async (req, res) => {
  const { tecnico_id, fecha_inicio, fecha_fin } = req.body;

  // 1. Validación de Entrada
  if (!tecnico_id || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({
      hasConflict: true, // Por seguridad, asumimos conflicto si faltan datos
      details: 'Faltan parámetros requeridos (tecnico_id, fecha_inicio, fecha_fin).',
    });
  }

  try {
    const connection = await pool.getConnection();

    // 2. Lógica de la consulta (se implementará en el siguiente paso)
    res.status(501).json({ message: 'Lógica de consulta no implementada aún.' });

    connection.release();

  } catch (error) {
    console.error('Error al verificar la disponibilidad:', error);
    res.status(500).json({
        hasConflict: true, // Asumimos conflicto en caso de error
        details: 'Error interno del servidor al consultar la agenda.',
        error: error.message
    });
  }
};

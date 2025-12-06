import { crearRegistroRevision, generarArtefactosYNotificar } from '../services/revision.service.js';

export const submitRevision = async (req, res) => {
  try {
    // req.user viene del middleware de autenticación (el técnico)
    const tecnico = req.user;

    // El body contiene revisionData, equiposData y firmaBase64
    const revisionPayload = req.body;

    // ----------------------------------------------------------------
    // 1. FASE RÁPIDA (Síncrona)
    // ----------------------------------------------------------------
    // Aquí SÍ usamos 'await'. Validamos datos, calculamos consumos y 
    // guardamos en Supabase. Si esto falla, el técnico recibe el error.
    // Tiempo estimado: 200ms - 800ms
    const contextoRevision = await crearRegistroRevision(revisionPayload, tecnico);

    // ----------------------------------------------------------------
    // 2. FASE LENTA (Asíncrona - Background)
    // ----------------------------------------------------------------
    // Aquí NO usamos 'await' para detener la respuesta HTTP.
    // Ejecutamos la promesa y manejamos su error internamente para no
    // afectar el flujo principal ni tumbar el servidor (UnhandledPromiseRejection).
    // Esto genera PDF, sube archivos, consulta IA y envía correos/push.
    generarArtefactosYNotificar(contextoRevision, tecnico)
      .catch(err => {
        console.error(`[Background Error] Error no capturado en revisión #${contextoRevision.revisionId}:`, err);
        // Nota: Aquí ya no podemos hacer res.json() porque la respuesta ya se envió abajo.
        // El error ya se registra en la BD dentro del servicio.
      });

    // ----------------------------------------------------------------
    // 3. RESPUESTA INMEDIATA
    // ----------------------------------------------------------------
    // Le decimos al Frontend "Todo bien, ya guardé los datos. Estoy trabajando en el PDF".
    res.status(201).json({
      success: true,
      message: 'Revisión guardada correctamente. El reporte se está generando en segundo plano.',
      revision_id: contextoRevision.revisionId,
      status: 'processing' // Indicador para el frontend
    });

  } catch (error) {
    console.error('Error en el controlador de revisión:', error.message);

    // Si falla la Fase 1 (Guardado), aquí sí devolvemos error 500 al cliente
    res.status(500).json({
      error: 'Error fatal al guardar la revisión',
      details: error.message
    });
  }
};
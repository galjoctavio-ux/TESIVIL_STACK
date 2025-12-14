// Archivo: routes/notifications.routes.js
import { Router } from 'express';
// Asegúrate que la ruta al controlador sea correcta según tu estructura
import { sendNotificationToEmail, subscribeUser } from '../controllers/notifications.controller.js';

const router = Router();

// 1. Endpoint para que el Frontend (PWA) active las notificaciones
router.post('/subscribe', subscribeUser);

// 2. Endpoint "Puente" para que PHP le avise a Node (Internal API)
router.post('/send-by-email', async (req, res) => {
    const { email, payload } = req.body;

    console.log('📨 [NODE] Petición recibida desde PHP');
    console.log('   -> Email destino:', email);
    console.log('   -> Payload:', payload);

    if (!email || !payload) {
        console.error('❌ [NODE] Faltan datos en la petición');
        return res.status(400).json({ message: 'Faltan datos' });
    }

    try {
        await sendNotificationToEmail(email, payload);
        console.log('✅ [NODE] Proceso de envío finalizado (Revisa si hubo warnings en el controlador)');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('🔥 [NODE] Error crítico al procesar notificación:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

export default router;
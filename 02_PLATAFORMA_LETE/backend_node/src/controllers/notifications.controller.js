import webpush from 'web-push';
import pool from '../services/eaDatabase.js';

// Configurar web-push con las llaves del .env
webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:test@test.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

// 1. Guardar la suscripción del usuario
export const subscribeUser = async (req, res) => {
    const { subscription } = req.body;
    const userEmail = req.user.email; // Viene del auth middleware

    try {
        // Buscar ID numérico del usuario
        const [users] = await pool.query('SELECT id FROM ea_users WHERE email = ?', [userEmail]);
        if (users.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

        const userId = users[0].id;

        // Guardar en BD (Evitamos duplicados borrando el anterior si existe para ese endpoint)
        // Ojo: Un usuario puede tener varios dispositivos, así que validamos por endpoint
        const checkQuery = 'SELECT id FROM ea_push_subscriptions WHERE endpoint = ?';
        const [existing] = await pool.query(checkQuery, [subscription.endpoint]);

        if (existing.length === 0) {
            const insertQuery = `
        INSERT INTO ea_push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES (?, ?, ?, ?)
      `;
            await pool.query(insertQuery, [
                userId,
                subscription.endpoint,
                subscription.keys.p256dh,
                subscription.keys.auth
            ]);
        }

        res.status(201).json({ message: 'Notificaciones activadas correctamente.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al suscribir usuario.' });
    }
};

// 2. Función auxiliar para ENVIAR notificación (para usarla desde otros controladores)
export const sendNotificationToUser = async (userId, payload) => {
    try {
        // Buscar todas las suscripciones de ese usuario (celular, tablet, laptop)
        const [subs] = await pool.query('SELECT * FROM ea_push_subscriptions WHERE user_id = ?', [userId]);

        const notifications = subs.map(sub => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: { auth: sub.auth, p256dh: sub.p256dh }
            };
            // Enviar y capturar error si la suscripción ya no existe (usuario borró caché)
            return webpush.sendNotification(pushConfig, JSON.stringify(payload))
                .catch(err => {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        // Borrar suscripción inválida
                        pool.query('DELETE FROM ea_push_subscriptions WHERE id = ?', [sub.id]);
                    }
                });
        });

        await Promise.all(notifications);
    } catch (error) {
        console.error("Error enviando push:", error);
    }
};

// 3. FUNCIÓN DE PRUEBA: "HOLA MUNDO"
export const sendTestNotification = async (req, res) => {
    const userEmail = req.user.email; // Viene del token

    try {
        // 1. Buscamos el ID del usuario
        const [users] = await pool.query('SELECT id FROM ea_users WHERE email = ?', [userEmail]);
        if (users.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });
        const userId = users[0].id;

        // 2. Buscamos sus dispositivos registrados
        const [subs] = await pool.query('SELECT * FROM ea_push_subscriptions WHERE user_id = ?', [userId]);

        if (subs.length === 0) {
            return res.status(400).json({ message: 'No tienes dispositivos registrados. Activa las notificaciones primero.' });
        }

        // 3. Preparamos el mensaje "Hola Mundo"
        const payload = JSON.stringify({
            title: '¡Hola Mundo!',
            body: 'Si lees esto, el sistema de notificaciones funciona al 100%.',
            url: '/agenda' // Al hacer click te lleva a la agenda
        });

        // 4. Enviamos a TODOS sus dispositivos
        const notifications = subs.map(sub => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: { auth: sub.auth, p256dh: sub.p256dh }
            };
            return webpush.sendNotification(pushConfig, payload);
        });

        await Promise.all(notifications);

        res.json({ message: `Se enviaron notificaciones a ${subs.length} dispositivo(s).` });

    } catch (error) {
        console.error('Error en prueba:', error);
        res.status(500).json({ message: 'Error al enviar prueba.' });
    }
};

export const sendAdminNotification = async (req, res) => {
    const { targetUserId, message } = req.body; // Recibimos el ID del técnico destino

    if (!targetUserId) {
        return res.status(400).json({ message: 'Falta el ID del técnico (targetUserId)' });
    }

    try {
        // 1. Buscar suscripciones de ese técnico específico
        const [subs] = await pool.query('SELECT * FROM ea_push_subscriptions WHERE user_id = ?', [targetUserId]);

        if (subs.length === 0) {
            return res.status(404).json({ message: 'Este técnico no tiene dispositivos registrados para notificaciones.' });
        }

        // 2. Preparar mensaje
        const payload = JSON.stringify({
            title: '🔔 Prueba desde Admin',
            body: message || 'El administrador está probando tu conexión.',
            url: '/agenda'
        });

        // 3. Enviar
        const notifications = subs.map(sub => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: { auth: sub.auth, p256dh: sub.p256dh }
            };
            return webpush.sendNotification(pushConfig, payload)
                .catch(err => {
                    console.error("Error enviando a sub:", sub.id, err.statusCode);
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        pool.query('DELETE FROM ea_push_subscriptions WHERE id = ?', [sub.id]);
                    }
                });
        });

        await Promise.all(notifications);
        res.json({ success: true, message: `Notificación enviada a ${subs.length} dispositivo(s) del técnico ${targetUserId}.` });

    } catch (error) {
        console.error('Error Admin Push:', error);
        res.status(500).json({ message: 'Error interno al enviar notificación.' });
    }
};

// --- AGREGA ESTA NUEVA FUNCIÓN ---
export const sendNotificationToEmail = async (email, payload) => {
    try {
        console.log(`🔎 [PUSH] Buscando usuario por email: ${email}`);

        // 1. Traducir Email -> ID
        const [users] = await pool.query('SELECT id FROM ea_users WHERE email = ?', [email]);

        if (users.length === 0) {
            console.warn(`⚠️ [PUSH] Usuario NO encontrado en tabla ea_users. Email: ${email}`);
            return;
        }

        const userId = users[0].id;
        console.log(`👤 [PUSH] Usuario encontrado. ID: ${userId}`);

        // 2. Buscar suscripciones
        const [subs] = await pool.query('SELECT * FROM ea_push_subscriptions WHERE user_id = ?', [userId]);
        console.log(`📱 [PUSH] Dispositivos encontrados: ${subs.length}`);

        if (subs.length === 0) {
            console.warn(`⚠️ [PUSH] El usuario ${userId} existe, pero NO tiene dispositivos registrados.`);
            return;
        }

        // ... (resto del código de envío) ...

    } catch (error) {
        console.error(`🔥 [PUSH] Error en sendNotificationToEmail:`, error.message);
    }
};
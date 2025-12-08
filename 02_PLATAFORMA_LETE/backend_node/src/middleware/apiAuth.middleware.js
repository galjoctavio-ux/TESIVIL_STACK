// src/middleware/apiAuth.middleware.js
import dotenv from 'dotenv';

dotenv.config();

export const requireApiKey = (req, res, next) => {
    // Buscamos la clave en el encabezado 'x-app-key'
    const apiKey = req.headers['x-app-key'];
    const internalKey = process.env.INTERNAL_API_KEY;

    if (!internalKey) {
        console.error('CRÍTICO: INTERNAL_API_KEY no está definida en el .env');
        return res.status(500).json({ error: 'Error de configuración del servidor.' });
    }

    // Comparamos (usamos una comparación simple de strings)
    if (apiKey === internalKey) {
        next(); // ¡Pase usted!
    } else {
        console.warn(`Intento de acceso no autorizado con Key: ${apiKey}`);
        return res.status(403).json({ error: 'Acceso denegado. API Key inválida.' });
    }
};
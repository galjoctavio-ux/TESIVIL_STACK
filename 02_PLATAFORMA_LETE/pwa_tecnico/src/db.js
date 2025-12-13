import Dexie from 'dexie';

// Definimos la base de datos local
export const db = new Dexie('TesivilOfflineDB');

db.version(1).stores({
    // Tabla para guardar el borrador mientras el técnico lo llena
    borradores: '++id, caso_id, last_updated',

    // Tabla para la cola de salida (lo que ya se finalizó pero no ha subido)
    cola_sincronizacion: '++id, caso_id, status, retry_count, timestamp'
});

/**
 * Guarda o actualiza el estado actual del wizard.
 * Se llama cada vez que el técnico avanza un paso.
 */
export const guardarBorrador = async (casoId, formData) => {
    // Convertimos las imagenes (si existen) a un formato ligero si es necesario
    // Por ahora guardamos el objeto tal cual
    await db.borradores.put({
        caso_id: casoId,
        data: formData,
        last_updated: new Date()
    }, casoId); // Usamos casoId como llave para sobrescribir
};

/**
 * Recupera el borrador si el técnico cerró la app y volvió.
 */
export const obtenerBorrador = async (casoId) => {
    return await db.borradores.get({ caso_id: casoId });
};

/**
 * Mueve un borrador a la cola de salida para ser enviado.
 */
export const encolarParaEnvio = async (casoId, formData) => {
    return db.transaction('rw', db.borradores, db.cola_sincronizacion, async () => {
        // 1. Agregamos a la cola de envíos
        await db.cola_sincronizacion.add({
            caso_id: casoId,
            payload: formData, // Aquí va todo el JSON listo para el backend
            status: 'pending', // pending, uploading, error, success
            retry_count: 0,
            timestamp: new Date()
        });

        // 2. Borramos el borrador porque ya se "firmó"
        await db.borradores.where({ caso_id: casoId }).delete();
    });
};
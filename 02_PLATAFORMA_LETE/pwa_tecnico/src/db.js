import Dexie from 'dexie';

// Actualizamos la versión a 2 para soportar los nuevos cambios
export const db = new Dexie('TesivilOfflineDB');

db.version(2).stores({
    borradores: '++id, &key, last_updated',
    cola_sincronizacion: '++id, tipo, status, retry_count, timestamp'
});

// Versión 3: Cambiamos 'key' a primary key para soportar upsert correctamente
db.version(3).stores({
    // 'key' ahora es el primary key para que put() haga upsert automático
    borradores: 'key, last_updated',
    cola_sincronizacion: '++id, tipo, status, retry_count, timestamp'
});

/**
 * Guarda un borrador genérico.
 * key: Un string único, ej: "cotizacion_draft" o "revision_55"
 */
export const guardarBorrador = async (key, data) => {
    await db.borradores.put({
        key: key,
        data: data,
        last_updated: new Date()
    });
};

/**
 * Recupera un borrador.
 */
export const obtenerBorrador = async (key) => {
    return await db.borradores.where('key').equals(key).first();
};

/**
 * Elimina un borrador (cuando ya se finalizó).
 */
export const eliminarBorrador = async (key) => {
    return await db.borradores.where('key').equals(key).delete();
};

/**
 * Encola un elemento para envío.
 * tipo: 'revision' | 'cotizacion'
 */
export const encolarParaEnvio = async (tipo, payload) => {
    return db.transaction('rw', db.cola_sincronizacion, async () => {
        await db.cola_sincronizacion.add({
            tipo: tipo,
            payload: payload,
            status: 'pending',
            retry_count: 0,
            timestamp: new Date()
        });
    });
};
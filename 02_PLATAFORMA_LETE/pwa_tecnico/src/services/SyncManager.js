import { db } from '../db';
import api from '../apiService';

class SyncManager {
    constructor() {
        this.isSyncing = false;
        // Escuchar eventos de red
        window.addEventListener('online', () => this.procesarCola());
    }

    /**
     * Revisa si hay algo pendiente en la base de datos local y lo sube.
     */
    async procesarCola() {
        if (this.isSyncing || !navigator.onLine) return;

        const pendientes = await db.cola_sincronizacion
            .where('status')
            .equals('pending')
            .toArray();

        if (pendientes.length === 0) return;

        this.isSyncing = true;
        console.log(`[SyncManager] Intentando subir ${pendientes.length} reportes...`);

        for (const tarea of pendientes) {
            try {
                // Marcamos como "subiendo"
                await db.cola_sincronizacion.update(tarea.id, { status: 'uploading' });

                // --- EL ENVÍO REAL AL BACKEND ---
                // Usamos tu endpoint existente.
                const { equiposData, firmaBase64, ...revisionData } = tarea.payload;

                // Reconstruimos el payload tal cual lo espera tu backend
                const payloadFinal = {
                    revisionData,
                    equiposData: equiposData || [],
                    firmaBase64
                };

                await api.post('/revisiones', payloadFinal);

                // Si llegamos aquí, fue éxito.
                console.log(`[SyncManager] Reporte ${tarea.caso_id} subido con éxito.`);

                // Eliminamos de la cola o marcamos como success
                await db.cola_sincronizacion.update(tarea.id, { status: 'success' });
                // Opcional: Eliminarlo físicamente para ahorrar espacio
                await db.cola_sincronizacion.delete(tarea.id);

                // TODO: Aquí podrías lanzar una Notificación Push Local avisando al técnico

            } catch (error) {
                console.error(`[SyncManager] Error subiendo reporte ${tarea.caso_id}:`, error);

                // Si falló, incrementamos reintentos y lo dejamos en pending para la próxima
                await db.cola_sincronizacion.update(tarea.id, {
                    status: 'pending',
                    retry_count: tarea.retry_count + 1,
                    last_error: error.message
                });
            }
        }

        this.isSyncing = false;

        // Si quedaron pendientes (porque fallaron), reintentar en 1 minuto
        const aunPendientes = await db.cola_sincronizacion.where('status').equals('pending').count();
        if (aunPendientes > 0) {
            setTimeout(() => this.procesarCola(), 60000);
        }
    }
}

export const syncManager = new SyncManager();
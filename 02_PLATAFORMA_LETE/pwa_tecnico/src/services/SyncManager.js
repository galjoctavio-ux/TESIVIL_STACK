import { db } from '../db';
import api, { guardarCotizacion } from '../apiService'; // Importamos guardarCotizacion

class SyncManager {
    constructor() {
        this.isSyncing = false;
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                console.log('[SyncManager] Conexión detectada. Procesando cola...');
                this.procesarCola();
            });
        }
    }

    async procesarCola() {
        if (this.isSyncing || !navigator.onLine) return;

        const pendientes = await db.cola_sincronizacion
            .where('status')
            .anyOf('pending', 'error')
            .toArray();

        if (pendientes.length === 0) return;

        this.isSyncing = true;
        console.log(`[SyncManager] Procesando ${pendientes.length} elementos...`);

        for (const tarea of pendientes) {
            try {
                await db.cola_sincronizacion.update(tarea.id, { status: 'uploading' });

                // --- ENRUTAMIENTO INTELIGENTE ---
                if (tarea.tipo === 'cotizacion') {
                    // Lógica para Cotizaciones
                    console.log("Subiendo Cotización...");
                    await guardarCotizacion(tarea.payload); // Usamos tu función existente

                } else if (tarea.tipo === 'revision' || !tarea.tipo) {
                    // Lógica para Revisiones (Compatibilidad con lo anterior)
                    console.log("Subiendo Revisión...");
                    const { equiposData, firmaBase64, ...revisionData } = tarea.payload;
                    const payloadFinal = {
                        revisionData,
                        equiposData: equiposData || [],
                        firmaBase64
                    };
                    await api.post('/revisiones', payloadFinal);
                }

                console.log(`[SyncManager] Elemento ${tarea.id} (${tarea.tipo}) subido con éxito.`);
                await db.cola_sincronizacion.delete(tarea.id); // Limpieza

            } catch (error) {
                console.error(`[SyncManager] Error subiendo ${tarea.tipo}:`, error);
                await db.cola_sincronizacion.update(tarea.id, {
                    status: 'error',
                    retry_count: (tarea.retry_count || 0) + 1,
                    last_error: error.message || 'Error desconocido'
                });
            }
        }

        this.isSyncing = false;

        // Reintentar errores
        const errores = await db.cola_sincronizacion.where('status').equals('error').count();
        if (errores > 0) setTimeout(() => this.procesarCola(), 60000); // 1 min
    }
}

export const syncManager = new SyncManager();
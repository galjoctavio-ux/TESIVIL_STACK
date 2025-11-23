import React, { useState } from 'react';
import DaySelector from './ui/DaySelector';
import apiService from '../apiService';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs'; // Asegúrate de tener dayjs importado para facilitar cálculos

const AvailabilityModal = ({ onClose }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    // ESTADO NUEVO: Modo de operación ('single' o 'recurring')
    const [mode, setMode] = useState('single');

    const [formData, setFormData] = useState({
        days: [],           // Para modo recurrente
        specificDate: '',   // Para modo un solo día
        startTime: '09:00',
        endTime: '18:00',
        untilDate: '',      // Para modo recurrente (fecha fin)
        reason: 'Tiempo Personal'
    });

    const handleSubmit = async () => {
        // 1. Validaciones según el modo
        if (mode === 'single' && !formData.specificDate) return alert('Selecciona la fecha a bloquear.');
        if (mode === 'recurring') {
            if (formData.days.length === 0) return alert('Selecciona qué días de la semana quieres bloquear.');
            if (!formData.untilDate) return alert('Selecciona hasta cuándo repetir este bloqueo.');
        }

        setLoading(true);

        try {
            let payload = {};

            if (mode === 'single') {
                // --- LÓGICA PARA UN SOLO DÍA ---
                // El backend espera un array de días [0-6]. Calculamos qué día cae la fecha seleccionada.
                // dayjs(fecha).day() devuelve 0 (Dom) a 6 (Sab).
                const dayIndex = dayjs(formData.specificDate).day();

                payload = {
                    id_users_provider: user.id, // (Tu backend ignorará esto y buscará por email, pero lo mandamos por consistencia)
                    start_time: formData.startTime,
                    end_time: formData.endTime,
                    days_of_week: [dayIndex], // Enviamos solo el índice de ese día
                    date_start: formData.specificDate, // Inicio y Fin son iguales
                    date_end: formData.specificDate,
                    reason: formData.reason
                };

            } else {
                // --- LÓGICA RECURRENTE (La que ya tenías) ---
                payload = {
                    id_users_provider: user.id,
                    start_time: formData.startTime,
                    end_time: formData.endTime,
                    days_of_week: formData.days,
                    date_start: new Date().toISOString().split('T')[0], // Desde hoy
                    date_end: formData.untilDate,
                    reason: formData.reason
                };
            }

            // Enviamos al MISMO endpoint, reutilizamos toda la lógica del backend
            const response = await apiService.post('/agenda/bloquear-recurrente', payload);

            if (response.data.success) {
                alert(response.data.message);
                onClose();
                window.location.reload();
            } else {
                // A veces el backend puede devolver success:false si algo falla lógicamente
                alert(response.data.message || 'No se pudo guardar el bloqueo.');
            }

        } catch (error) {
            console.error(error);
            alert('Error de conexión al guardar disponibilidad.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* HEADER AZUL */}
                <div className="bg-blue-600 p-4 flex justify-between items-center shrink-0">
                    <h2 className="text-white font-bold text-lg">Registrar Tiempo Libre</h2>
                    <button onClick={onClose} className="text-white text-2xl font-bold px-2">&times;</button>
                </div>

                {/* TABS (SWITCH) */}
                <div className="flex border-b border-gray-200">
                    <button
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${mode === 'single' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500'}`}
                        onClick={() => setMode('single')}
                    >
                        Un solo día
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${mode === 'recurring' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500'}`}
                        onClick={() => setMode('recurring')}
                    >
                        Repetitivo
                    </button>
                </div>

                {/* CONTENIDO SCROLLABLE */}
                <div className="p-6 space-y-6 overflow-y-auto">

                    {/* MODO: UN SOLO DÍA */}
                    {mode === 'single' && (
                        <div className="animate-fade-in">
                            <label className="block text-sm text-gray-600 mb-1 font-semibold">Selecciona la fecha</label>
                            <input
                                type="date"
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                value={formData.specificDate}
                                onChange={e => setFormData({ ...formData, specificDate: e.target.value })}
                            />
                        </div>
                    )}

                    {/* MODO: RECURRENTE */}
                    {mode === 'recurring' && (
                        <div className="animate-fade-in">
                            <label className="block text-sm text-gray-600 mb-2 font-semibold">¿Qué días se repite?</label>
                            <DaySelector
                                selectedDays={formData.days}
                                onChange={(d) => setFormData({ ...formData, days: d })}
                            />
                        </div>
                    )}

                    {/* HORARIO (COMPARTIDO PARA AMBOS MODOS) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-500 block mb-1">Desde las</label>
                            <input
                                type="time"
                                value={formData.startTime}
                                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded bg-gray-50 focus:bg-white transition-colors"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-500 block mb-1">Hasta las</label>
                            <input
                                type="time"
                                value={formData.endTime}
                                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                className="w-full p-2 border border-gray-300 rounded bg-gray-50 focus:bg-white transition-colors"
                            />
                        </div>
                    </div>

                    {/* VIGENCIA (SOLO PARA RECURRENTE) */}
                    {mode === 'recurring' && (
                        <div className="pt-2 border-t border-gray-100">
                            <label className="block text-sm text-gray-600 mb-1 font-semibold">Repetir hasta:</label>
                            <input
                                type="date"
                                className="w-full p-3 border border-gray-300 rounded-lg bg-gray-50"
                                onChange={e => setFormData({ ...formData, untilDate: e.target.value })}
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                Se bloquearán todos los días seleccionados hasta llegar a esta fecha.
                            </p>
                        </div>
                    )}

                    {/* CAMPO DE RAZÓN (OPCIONAL) */}
                    <div>
                        <label className="block text-sm text-gray-500 mb-1">Motivo (Opcional)</label>
                        <input
                            type="text"
                            placeholder="Ej. Cita médica, Trámite..."
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                        />
                    </div>

                </div>

                {/* FOOTER CON BOTÓN */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`w-full py-3 rounded-xl text-white font-bold shadow-md transition-transform active:scale-95 ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {loading ? 'Procesando...' : (mode === 'single' ? 'Bloquear Fecha' : 'Crear Regla Recurrente')}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AvailabilityModal;
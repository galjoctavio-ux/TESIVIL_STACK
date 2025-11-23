import React, { useState } from 'react';
import DaySelector from './ui/DaySelector';
import apiService from '../apiService'; // Asegúrate que la ruta sea correcta
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2'; // Usaremos alertas bonitas si las tienes, sino usa alert normal

const AvailabilityModal = ({ onClose }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        days: [],
        startTime: '09:00',
        endTime: '18:00',
        untilDate: '', // Fecha límite
        reason: 'Tiempo Personal'
    });

    const handleSubmit = async () => {
        // Validaciones básicas
        if (formData.days.length === 0) return alert('Selecciona al menos un día');
        if (!formData.untilDate) return alert('Debes seleccionar hasta qué fecha repetir esto');

        setLoading(true);
        try {
            const payload = {
                id_users_provider: user.id, // ID de E!A
                start_time: formData.startTime,
                end_time: formData.endTime,
                days_of_week: formData.days,
                date_start: new Date().toISOString().split('T')[0], // Empieza hoy
                date_end: formData.untilDate,
                reason: formData.reason
            };

            const response = await apiService.post('/agenda/bloquear-recurrente', payload);

            if (response.data.success) {
                // Éxito
                alert(`¡Listo! Se bloquearon ${response.data.blocks_created} espacios.`);
                onClose(); // Cerrar modal
                window.location.reload(); // Recargar para ver los cambios en la agenda
            }
        } catch (error) {
            console.error(error);
            alert('Error al guardar disponibilidad.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">

                {/* Header del Modal */}
                <div className="bg-blue-600 p-4 flex justify-between items-center">
                    <h2 className="text-white font-bold text-lg">Registrar Tiempo Libre</h2>
                    <button onClick={onClose} className="text-white text-2xl font-bold">&times;</button>
                </div>

                <div className="p-6 space-y-4">

                    {/* 1. Selector de Días */}
                    <div>
                        <label className="block text-sm text-gray-600 mb-2 font-semibold">¿Qué días no puedes?</label>
                        <DaySelector
                            selectedDays={formData.days}
                            onChange={(d) => setFormData({ ...formData, days: d })}
                        />
                    </div>

                    {/* 2. Horario */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm text-gray-500">Desde</label>
                            <input
                                type="time"
                                value={formData.startTime}
                                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                className="w-full border-b-2 border-gray-300 focus:border-blue-500 p-2 outline-none bg-gray-50 rounded"
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-500">Hasta</label>
                            <input
                                type="time"
                                value={formData.endTime}
                                onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                className="w-full border-b-2 border-gray-300 focus:border-blue-500 p-2 outline-none bg-gray-50 rounded"
                            />
                        </div>
                    </div>

                    {/* 3. Vigencia */}
                    <div>
                        <label className="block text-sm text-gray-600 mb-1 font-semibold">Repetir hasta:</label>
                        <input
                            type="date"
                            className="w-full p-3 border rounded-lg bg-gray-50"
                            onChange={e => setFormData({ ...formData, untilDate: e.target.value })}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Se bloquearán estos horarios en tu agenda hasta la fecha seleccionada.
                        </p>
                    </div>

                    {/* Botón Acción */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`w-full py-3 rounded-xl text-white font-bold shadow-md ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {loading ? 'Procesando...' : 'Confirmar Bloqueo'}
                    </button>

                </div>
            </div>
        </div>
    );
};

export default AvailabilityModal;
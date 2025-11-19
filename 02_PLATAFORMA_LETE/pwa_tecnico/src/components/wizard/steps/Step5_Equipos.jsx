import React from 'react';
import { Trash2, Plus } from 'lucide-react';
import InputCard from '../ui/InputCard';
import SelectCard from '../ui/SelectCard';

const Step5_Equipos = ({ formData, updateFormData }) => {

  const equipos = formData.equiposData || [];

  const handleAddEquipo = () => {
    const newEquipo = {
      id: Date.now(), // Simple unique ID for the session
      nombre_equipo: 'Refrigerador',
      nombre_personalizado: '',
      amperaje_medido: '',
      tiempo_uso: '',
      unidad_tiempo: 'Horas/Día',
      estado_equipo: 'Bueno'
    };
    updateFormData({ equiposData: [...equipos, newEquipo] });
  };

  const handleRemoveEquipo = (id) => {
    updateFormData({
      equiposData: equipos.filter(eq => eq.id !== id)
    });
  };

  const handleEquipoChange = (id, field, value) => {
    const updatedEquipos = equipos.map(eq =>
      eq.id === id ? { ...eq, [field]: value } : eq
    );
    updateFormData({ equiposData: updatedEquipos });
  };

  const equipoOptions = [
    'Refrigerador', 'Aire Acondicionado', 'Bomba de Agua', 'Lavadora',
    'Microondas', 'Iluminación', 'TV', 'Computadora', 'Otro'
  ];
  const estadoOptions = ['Bueno', 'Regular', 'Malo'];

  return (
    <div className="animate-slide-in">
      <div className="space-y-4">
        {equipos.map(equipo => (
          <div key={equipo.id} className="bg-white shadow-md rounded-xl p-4 relative animate-fade-in">
            <button
              onClick={() => handleRemoveEquipo(equipo.id)}
              className="absolute top-3 right-3 text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-full transition-colors"
              aria-label="Eliminar equipo"
            >
              <Trash2 className="h-4 w-4" />
            </button>

            <div className="space-y-4">
              <SelectCard
                label="Nombre Equipo"
                name="nombre_equipo"
                value={equipo.nombre_equipo}
                onChange={(e) => handleEquipoChange(equipo.id, 'nombre_equipo', e.target.value)}
                options={equipoOptions}
              />

              <InputCard
                label={equipo.nombre_equipo === 'Otro' ? "Nombre Personalizado" : "Ubicación / Detalle"}
                name="nombre_personalizado"
                value={equipo.nombre_personalizado}
                onChange={(e) => handleEquipoChange(equipo.id, e.target.name, e.target.value)}
                placeholder="Ej. Sala, Cocina, Recámara principal"
              />

              <div className="grid grid-cols-2 gap-4">
                <InputCard
                  label="Amperaje"
                  name="amperaje_medido"
                  value={equipo.amperaje_medido}
                  onChange={(e) => handleEquipoChange(equipo.id, e.target.name, e.target.value)}
                  unit="A"
                  type="number"
                />

                {/* Custom layout for Time + Frequency */}
                <div className="bg-white shadow-md rounded-xl p-4">
                  <label htmlFor={`tiempo_uso_${equipo.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                    Tiempo de Uso
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      id={`tiempo_uso_${equipo.id}`}
                      name="tiempo_uso"
                      value={equipo.tiempo_uso}
                      onChange={(e) => handleEquipoChange(equipo.id, e.target.name, e.target.value)}
                      type="number"
                      className="w-full p-3 bg-gray-50 border-gray-200 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <select
                      name="unidad_tiempo"
                      value={equipo.unidad_tiempo}
                      onChange={(e) => handleEquipoChange(equipo.id, e.target.name, e.target.value)}
                      className="p-3 bg-gray-50 border-gray-200 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option>Horas/Día</option>
                      <option>Horas/Semana</option>
                    </select>
                  </div>
                </div>

              </div>

              <SelectCard
                label="Estado"
                name="estado_equipo"
                value={equipo.estado_equipo}
                onChange={(e) => handleEquipoChange(equipo.id, 'estado_equipo', e.target.value)}
                options={estadoOptions}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          onClick={handleAddEquipo}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Agregar Equipo
        </button>
      </div>
    </div>
  );
};

export default Step5_Equipos;

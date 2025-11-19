import React from 'react';

// Assuming InputCard exists for consistency
import InputCard from '../ui/InputCard';

// A simple Icon component for the delete button
const XIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);


const Step5_Equipos = ({ formData, setFormData }) => {

  // --- Logic migrated from legacy code and adapted to props ---
  const handleAddEquipo = () => {
    const nuevoEquipo = {
      id: Date.now(),
      nombre_equipo: 'Refrigerador',
      nombre_personalizado: '',
      amperaje_medido: 1.0,
      tiempo_uso: 1,
      unidad_tiempo: 'Horas/Día',
      estado_equipo: 'Bueno'
    };
    setFormData(prev => ({ ...prev, equiposData: [...prev.equiposData, nuevoEquipo] }));
  };

  const handleRemoveEquipo = (id) => {
    setFormData(prev => ({
      ...prev,
      equiposData: prev.equiposData.filter(eq => eq.id !== id)
    }));
  };

  const handleEquipoChange = (id, field, value) => {
    // Ensure numeric fields are handled correctly
    const parsedValue = (field === 'amperaje_medido' || field === 'tiempo_uso')
      ? parseFloat(value) || 0
      : value;

    setFormData(prev => ({
       ...prev,
       equiposData: prev.equiposData.map(eq =>
         eq.id === id ? { ...eq, [field]: parsedValue } : eq
       )
     }));
  };
  // --- End of migrated logic ---

  const equiposOptions = [
    'Refrigerador', 'Aire Acondicionado', 'Bomba de Agua', 'Lavadora', 'Microondas', 'Iluminación', 'Otro'
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-center">Equipos y Cargas</h2>

      <div className="space-y-4">
        {formData.equiposData && formData.equiposData.map(equipo => (
          <div key={equipo.id} className="bg-white shadow-md rounded-xl p-4 mb-4 relative">
            {/* --- Botón de Eliminar --- */}
            <button
              onClick={() => handleRemoveEquipo(equipo.id)}
              className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 bg-red-100 rounded-full"
              aria-label="Eliminar equipo"
            >
              <XIcon className="h-4 w-4" />
            </button>

            {/* --- Contenido de la Tarjeta --- */}
            <div className="space-y-3">
              {/* --- Título (Dropdown) --- */}
              <div>
                <label className="block text-sm font-medium text-gray-500">Tipo de Equipo</label>
                <select
                  value={equipo.nombre_equipo}
                  onChange={(e) => handleEquipoChange(equipo.id, 'nombre_equipo', e.target.value)}
                  className="w-full p-2 bg-gray-50 border rounded-lg mt-1"
                >
                  {equiposOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* --- Ubicación --- */}
              <InputCard
                label="Ubicación (Nombre Personalizado)"
                value={equipo.nombre_personalizado || ''}
                onChange={(e) => handleEquipoChange(equipo.id, 'nombre_personalizado', e.target.value)}
                placeholder="Ej: Cocina, Sala"
                compact
              />

              {/* --- Grid de 2 Columnas --- */}
              <div className="grid grid-cols-2 gap-4">
                <InputCard
                  label="Amperaje"
                  value={equipo.amperaje_medido}
                  onChange={(e) => handleEquipoChange(equipo.id, 'amperaje_medido', e.target.value)}
                  unit="A"
                  type="number"
                  compact
                />
                <InputCard
                  label="Tiempo de Uso"
                  value={equipo.tiempo_uso}
                  onChange={(e) => handleEquipoChange(equipo.id, 'tiempo_uso', e.target.value)}
                  type="number"
                  compact
                />
              </div>

              {/* --- Fila Adicional para Selects --- */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500">Unidad</label>
                  <select
                    value={equipo.unidad_tiempo}
                    onChange={(e) => handleEquipoChange(equipo.id, 'unidad_tiempo', e.target.value)}
                    className="w-full p-2 bg-gray-50 border rounded-lg mt-1 text-sm"
                  >
                    <option>Horas/Día</option>
                    <option>Horas/Semana</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500">Estado</label>
                  <select
                    value={equipo.estado_equipo}
                    onChange={(e) => handleEquipoChange(equipo.id, 'estado_equipo', e.target.value)}
                    className="w-full p-2 bg-gray-50 border rounded-lg mt-1 text-sm"
                  >
                    <option>Bueno</option>
                    <option>Regular</option>
                    <option>Malo</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* --- Botón Flotante o Grande --- */}
      <div className="mt-6">
        <button
          onClick={handleAddEquipo}
          className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg"
        >
          + Agregar Equipo
        </button>
      </div>
    </div>
  );
};

export default Step5_Equipos;

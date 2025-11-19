import React from 'react';
// Assuming InputCard exists as per instructions
import InputCard from '../ui/InputCard';

const Step3_Mediciones = ({ formData, setFormData }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // --- Logic migrated from legacy code ---
  const { tipo_servicio } = formData;
  const esBifasico = tipo_servicio === '2F+Neutro' || tipo_servicio === '2F+N con Paneles';
  const esTrifasico = tipo_servicio === 'Trifásico' || tipo_servicio === 'Trifásico con Paneles';
  const tienePaneles = tipo_servicio === '2F+N con Paneles' || tipo_servicio === 'Trifásico con Paneles';
  // Note: esMonofasico is implicitly when the others are false.
  // --- End of migrated logic ---

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-center">Mediciones Eléctricas</h2>

      <div className="space-y-4">
        {/* --- Fase 1: Always visible --- */}
        <InputCard
          label="Voltaje Fase 1 vs Neutro"
          name="voltaje_f1_n"
          value={formData.voltaje_f1_n || ''}
          onChange={handleChange}
          unit="V"
          placeholder="e.g., 127"
        />
        <InputCard
          label="Amperaje Fase 1"
          name="amperaje_f1"
          value={formData.amperaje_f1 || ''}
          onChange={handleChange}
          unit="A"
          placeholder="e.g., 15.2"
        />

        {/* --- Fase 2: Conditional --- */}
        {(esBifasico || esTrifasico) && (
          <>
            <InputCard
              label="Voltaje Fase 2 vs Neutro"
              name="voltaje_f2_n"
              value={formData.voltaje_f2_n || ''}
              onChange={handleChange}
              unit="V"
              placeholder="e.g., 126"
            />
             <InputCard
              label="Amperaje Fase 2"
              name="amperaje_f2"
              value={formData.amperaje_f2 || ''}
              onChange={handleChange}
              unit="A"
              placeholder="e.g., 14.8"
            />
            <InputCard
              label="Voltaje Fase 1 vs Fase 2"
              name="voltaje_f1_f2"
              value={formData.voltaje_f1_f2 || ''}
              onChange={handleChange}
              unit="V"
              placeholder="e.g., 220"
            />
          </>
        )}

        {/* --- Fase 3: Conditional --- */}
        {esTrifasico && (
          <>
            <InputCard
              label="Voltaje Fase 3 vs Neutro"
              name="voltaje_f3_n"
              value={formData.voltaje_f3_n || ''}
              onChange={handleChange}
              unit="V"
              placeholder="e.g., 128"
            />
            <InputCard
              label="Amperaje Fase 3"
              name="amperaje_f3"
              value={formData.amperaje_f3 || ''}
              onChange={handleChange}
              unit="A"
              placeholder="e.g., 15.5"
            />
            <InputCard
              label="Voltaje Fase 2 vs Fase 3"
              name="voltaje_f2_f3"
              value={formData.voltaje_f2_f3 || ''}
              onChange={handleChange}
              unit="V"
              placeholder="e.g., 221"
            />
             <InputCard
              label="Voltaje Fase 1 vs Fase 3"
              name="voltaje_f1_f3"
              value={formData.voltaje_f1_f3 || ''}
              onChange={handleChange}
              unit="V"
              placeholder="e.g., 219"
            />
          </>
        )}

        {/* --- Neutro --- */}
        <InputCard
          label="Amperaje del Neutro"
          name="amperaje_neutro"
          value={formData.amperaje_neutro || ''}
          onChange={handleChange}
          unit="A"
          placeholder="e.g., 0.5"
        />
      </div>

      {/* --- Paneles Solares Section: Conditional --- */}
      {tienePaneles && (
        <div className="mt-8 pt-6 border-t border-gray-200">
           <div className="p-4 bg-green-50 rounded-xl">
             <h3 className="text-lg font-bold mb-4 text-green-800">Mediciones de Paneles Solares</h3>
             <div className="space-y-4">
               <InputCard
                label="Amperaje de Inyección"
                name="amperaje_inyeccion_paneles"
                value={formData.amperaje_inyeccion_paneles || ''}
                onChange={handleChange}
                unit="A"
                placeholder="e.g., 8.5"
               />
               <InputCard
                label="Voltaje de Inyección"
                name="voltaje_inyeccion_paneles"
                value={formData.voltaje_inyeccion_paneles || ''}
                onChange={handleChange}
                unit="V"
                placeholder="e.g., 240"
               />
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Step3_Mediciones;

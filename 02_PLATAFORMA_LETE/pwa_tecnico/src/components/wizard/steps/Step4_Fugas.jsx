import React from 'react';
import BigToggle from '../ui/BigToggle';
import InputCard from '../ui/InputCard';

const Step4_Fugas = ({ formData, updateFormData }) => {

  const handleInputChange = (e) => {
    updateFormData({ [e.target.name]: e.target.value });
  };

  const { tipo_servicio } = formData;
  const showF2 = tipo_servicio?.includes('2F') || tipo_servicio?.includes('Trifásico');
  const showF3 = tipo_servicio?.includes('Trifásico');

  return (
    <div className="space-y-6 animate-slide-in">
      <BigToggle
        label="¿Se puede apagar todo?"
        enabled={!!formData.se_puede_apagar_todo}
        onChange={(val) => updateFormData({ se_puede_apagar_todo: val })}
      />

      {formData.se_puede_apagar_todo && (
        <div className="space-y-4 animate-fade-in">
            <div className="bg-blue-50 text-blue-800 p-3 rounded-lg" role="alert">
                <p className="font-semibold">Instrucción:</p>
                <p>Con todo apagado y desconectado, mide la corriente en los cables de entrada para detectar fugas a tierra.</p>
            </div>

            <div className="space-y-4 border border-gray-200 p-4 rounded-xl bg-gray-50">
              <h3 className="font-bold text-gray-700">🔬 Medición de Fugas</h3>
              <InputCard
                  label="Fuga a Tierra (F1)"
                  name="corriente_fuga_f1"
                  value={formData.corriente_fuga_f1 || ''}
                  onChange={handleInputChange}
                  unit="A"
                  type="number"
                  placeholder="e.g., 0.5"
              />
              {showF2 && (
                  <InputCard
                      label="Fuga a Tierra (F2)"
                      name="corriente_fuga_f2"
                      value={formData.corriente_fuga_f2 || ''}
                      onChange={handleInputChange}
                      unit="A"
                      type="number"
                      placeholder="e.g., 0.5"
                  />
              )}
              {showF3 && (
                  <InputCard
                      label="Fuga a Tierra (F3)"
                      name="corriente_fuga_f3"
                      value={formData.corriente_fuga_f3 || ''}
                      onChange={handleInputChange}
                      unit="A"
                      type="number"
                      placeholder="e.g., 0.5"
                  />
              )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Step4_Fugas;

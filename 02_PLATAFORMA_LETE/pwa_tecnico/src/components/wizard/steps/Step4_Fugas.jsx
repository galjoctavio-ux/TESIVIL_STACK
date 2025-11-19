import React from 'react';
import BigToggle from '../ui/BigToggle';
import InputCard from '../ui/InputCard';

const Step4_Fugas = ({ formData, updateFormData }) => {
  const { se_puede_apagar_todo, tipo_servicio } = formData;

  const handleChange = (value) => {
    updateFormData({ se_puede_apagar_todo: value });
  };

  const handleInputChange = (e) => {
    updateFormData({ [e.target.name]: e.target.value });
  };

  const esBifasico = tipo_servicio === '2F+Neutro' || tipo_servicio === '2F+N con Paneles';
  const esTrifasico = tipo_servicio === 'Trifásico' || tipo_servicio === 'Trifásico con Paneles';

  return (
    <div className="space-y-6">
      <BigToggle
        label="¿Se puede apagar todo?"
        value={se_puede_apagar_todo}
        onChange={handleChange}
      />

      {se_puede_apagar_todo && (
        <div className="space-y-4">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mt-4" role="alert">
                <p className="font-bold">Instrucción:</p>
                <p>Desconecta y apaga todo y mide la corriente en los cables de entrada.</p>
            </div>
            <InputCard
                label="Fuga a Tierra (F1)"
                name="fuga_f1"
                value={formData.fuga_f1 || ''}
                onChange={handleInputChange}
                unit="A"
                placeholder="e.g., 0.5"
            />
            {(esBifasico || esTrifasico) && (
                <InputCard
                    label="Fuga a Tierra (F2)"
                    name="fuga_f2"
                    value={formData.fuga_f2 || ''}
                    onChange={handleInputChange}
                    unit="A"
                    placeholder="e.g., 0.5"
                />
            )}
            {esTrifasico && (
                <InputCard
                    label="Fuga a Tierra (F3)"
                    name="fuga_f3"
                    value={formData.fuga_f3 || ''}
                    onChange={handleInputChange}
                    unit="A"
                    placeholder="e.g., 0.5"
                />
            )}
        </div>
      )}
    </div>
  );
};

export default Step4_Fugas;

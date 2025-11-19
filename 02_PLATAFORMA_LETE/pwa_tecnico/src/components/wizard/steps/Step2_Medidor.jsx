import React from 'react';
// As per instructions, we assume these reusable components exist.
// We will imagine their paths, a real implementation would require knowing the exact paths.
import BigToggle from '../ui/BigToggle';

const Step2_Medidor = ({ formData, setFormData }) => {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleToggle = (name) => {
    setFormData(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  // From legacy code: This logic is based on a derived value,
  // but for the component we just check the boolean prop.
  const { capacidad_vs_calibre } = formData;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-center">Medidor y Acometida</h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="tipo_servicio" className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Servicio
          </label>
          <select
            id="tipo_servicio"
            name="tipo_servicio"
            value={formData.tipo_servicio || ''}
            onChange={handleChange}
            className="w-full p-3 bg-white border rounded-xl shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Seleccione...</option>
            <option value="Monofásico">Monofásico</option>
            <option value="2F+Neutro">2F+Neutro (Bifásico)</option>
            <option value="2F+N con Paneles">2F+N con Paneles</option>
            <option value="Trifásico">Trifásico</option>
            <option value="Trifásico con Paneles">Trifásico con Paneles</option>
          </select>
        </div>

        {/* Boolean toggles */}
        <BigToggle
          label="¿Sello CFE en buen estado?"
          enabled={formData.sello_cfe || false}
          onChange={() => handleToggle('sello_cfe')}
        />
        <BigToggle
          label="¿Tornillos de terminales flojos?"
          enabled={formData.tornillos_flojos || false}
          onChange={() => handleToggle('tornillos_flojos')}
        />
        <BigToggle
          label="¿Conexiones sulfatadas?"
          enabled={formData.conexiones_sulfatadas || false}
          onChange={() => handleToggle('conexiones_sulfatadas')}
        />
         <BigToggle
          label="¿Base de medidor sobrecalentada?"
          enabled={formData.base_sobrecalentada || false}
          onChange={() => handleToggle('base_sobrecalentada')}
        />

        {/* Conditional Alert */}
        {capacidad_vs_calibre === false && (
          <div className="bg-red-100 text-red-700 p-4 rounded-lg mt-4" role="alert">
            <p className="font-bold">¡Alerta de Capacidad!</p>
            <p>El calibre del conductor de la acometida no parece ser el adecuado para la capacidad del interruptor principal. Se requiere revisión.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step2_Medidor;

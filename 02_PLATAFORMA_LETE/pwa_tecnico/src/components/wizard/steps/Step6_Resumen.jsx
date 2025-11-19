import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

const CAUSAS_ALTO_CONSUMO = [
  "Fuga en Sanitario",
  "Fuga en Tubería",
  "Fuga en Tinaco/Cisterna",
  "Equipos Obsoletos",
  "Malos Hábitos",
  "Otro",
];

const Step6_Resumen = ({ formData, updateFormData }) => {
  const sigCanvas = useRef(null);

  const handleCausasChange = (e) => {
    const { value, checked } = e.target;
    const currentCausas = formData.causas_alto_consumo || [];
    let newCausas;
    if (checked) {
      newCausas = [...currentCausas, value];
    } else {
      newCausas = currentCausas.filter((causa) => causa !== value);
    }
    updateFormData({ causas_alto_consumo: newCausas });
  };

  const handleRecomendacionesChange = (e) => {
    updateFormData({ recomendaciones: e.target.value });
  };

  const clearSignature = () => {
    if (sigCanvas.current) {
      sigCanvas.current.clear();
      updateFormData({ firmaBase64: null });
    }
  };

  const handleSignatureEnd = () => {
    if (sigCanvas.current) {
      const signature = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      updateFormData({ firmaBase64: signature });
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <label className="text-lg font-bold text-gray-800">Causas de Alto Consumo</label>
        <div className="mt-3 space-y-3">
          {CAUSAS_ALTO_CONSUMO.map((causa) => (
            <label key={causa} className="flex items-center p-4 bg-white rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                value={causa}
                checked={(formData.causas_alto_consumo || []).includes(causa)}
                onChange={handleCausasChange}
                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-4 text-md text-gray-700">{causa}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="recomendaciones" className="text-lg font-bold text-gray-800">Recomendaciones Finales</label>
        <textarea
          id="recomendaciones"
          rows="5"
          className="mt-3 w-full p-3 bg-white rounded-lg shadow-sm border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          placeholder="Describe las acciones recomendadas para el cliente..."
          value={formData.recomendaciones || ''}
          onChange={handleRecomendacionesChange}
        />
      </div>

      <div>
        <label className="text-lg font-bold text-gray-800">Firma del Cliente</label>
        <div className="mt-3 relative w-full h-48 bg-white border-2 border-dashed border-gray-300 rounded-lg">
          <SignatureCanvas
            ref={sigCanvas}
            penColor='black'
            canvasProps={{ className: 'w-full h-full' }}
            onEnd={handleSignatureEnd}
          />
        </div>
        <div className="text-right mt-2">
            <button
            type="button"
            onClick={clearSignature}
            className="text-sm font-semibold text-blue-600 hover:text-blue-800"
            >
            Borrar Firma
            </button>
        </div>
      </div>
    </div>
  );
};

export default Step6_Resumen;

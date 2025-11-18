import React, { useState } from 'react';
import { Plus, Trash2, MapPin, AlertTriangle, X } from 'lucide-react';
import PhotoUpload from '../ui/PhotoUpload';

const FugaCard = ({ fuga, onRemove }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 my-2 flex items-start justify-between">
    <div>
      <div className="flex items-center mb-2">
        <MapPin size={16} className="text-gray-500 mr-2" />
        <p className="font-bold text-lg">{fuga.ubicacion}</p>
      </div>
      <div className="flex items-center">
        <AlertTriangle size={16} className={`mr-2 ${fuga.severidad === 'Crítica' ? 'text-red-500' : fuga.severidad === 'Moderada' ? 'text-yellow-500' : 'text-green-500'}`} />
        <p>{fuga.severidad}</p>
      </div>
    </div>
    <div className="flex flex-col items-end">
        {fuga.foto && <img src={fuga.foto} alt="Fuga" className="w-16 h-16 object-cover rounded-md mb-2" />}
        <button onClick={onRemove} className="text-red-500 hover:text-red-700">
            <Trash2 size={20} />
        </button>
    </div>
  </div>
);

const AddFugaForm = ({ onSave, onCancel }) => {
    const [ubicacion, setUbicacion] = useState('');
    const [severidad, setSeveridad] = useState('Leve');
    const [foto, setFoto] = useState(null);

    const handleSave = () => {
        if (ubicacion) {
            onSave({ ubicacion, severidad, foto });
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 my-4">
            <h3 className="text-xl font-bold mb-4">Reportar Nueva Fuga</h3>

            <label className="block text-md font-medium text-gray-700 mb-2">Ubicación</label>
            <select value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="w-full bg-gray-50 rounded-lg p-3 border border-gray-300 mb-4">
                <option value="">Seleccionar...</option>
                <option value="Baño Principal">Baño Principal</option>
                <option value="Cocina">Cocina</option>
                <option value="Jardín">Jardín</option>
                <option value="Otro">Otro</option>
            </select>

            <label className="block text-md font-medium text-gray-700 mb-2">Severidad</label>
            <div className="flex justify-between mb-4">
                <button onClick={() => setSeveridad('Leve')} className={`px-4 py-2 rounded-lg font-semibold ${severidad === 'Leve' ? 'bg-green-500 text-white' : 'bg-gray-200'}`}>Leve</button>
                <button onClick={() => setSeveridad('Moderada')} className={`px-4 py-2 rounded-lg font-semibold ${severidad === 'Moderada' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}>Moderada</button>
                <button onClick={() => setSeveridad('Crítica')} className={`px-4 py-2 rounded-lg font-semibold ${severidad === 'Crítica' ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>Crítica</button>
            </div>

            <label className="block text-md font-medium text-gray-700 mb-2">Evidencia Fotográfica</label>
            <PhotoUpload onFileChange={setFoto} />

            <div className="flex justify-end mt-6">
                <button onClick={onCancel} className="px-4 py-2 text-gray-600 mr-2">Cancelar</button>
                <button onClick={handleSave} className="px-6 py-3 text-white bg-blue-600 rounded-lg font-semibold">Guardar Fuga</button>
            </div>
        </div>
    );
};


const Step3_Fugas = ({ formData, setFormData }) => {
  const [isAdding, setIsAdding] = useState(false);
  const fugas = formData.fugas || [];

  const handleSaveFuga = (newFuga) => {
    setFormData({
      ...formData,
      fugas: [...fugas, newFuga],
    });
    setIsAdding(false);
  };

  const handleRemoveFuga = (indexToRemove) => {
    setFormData({
        ...formData,
        fugas: fugas.filter((_, index) => index !== indexToRemove)
    });
  }

  return (
    <div>
      {fugas.length > 0 && !isAdding && (
         <div className="mb-4">
            {fugas.map((fuga, index) => (
                <FugaCard key={index} fuga={fuga} onRemove={() => handleRemoveFuga(index)} />
            ))}
        </div>
      )}

      {isAdding ? (
        <AddFugaForm onSave={handleSaveFuga} onCancel={() => setIsAdding(false)} />
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center p-4 my-4 bg-white rounded-lg shadow-sm border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-500 hover:text-blue-500 transition-colors"
        >
          <Plus size={24} className="mr-2" />
          Reportar Nueva Fuga
        </button>
      )}
    </div>
  );
};

export default Step3_Fugas;

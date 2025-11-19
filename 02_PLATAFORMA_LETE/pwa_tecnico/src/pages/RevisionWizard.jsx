import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../apiService';

// Importar los pasos reales
import Step1_Generales from '../components/wizard/steps/Step1_Generales';
import Step2_Medidor from '../components/wizard/steps/Step2_Medidor';
import Step3_Mediciones from '../components/wizard/steps/Step3_Mediciones';
import Step4_Fugas from '../components/wizard/steps/Step4_Fugas';
import Step5_Equipos from '../components/wizard/steps/Step5_Equipos';
import Step6_Resumen from '../components/wizard/steps/Step6_Resumen';

const steps = [
  { id: 'generales', title: 'Datos Generales', component: Step1_Generales },
  { id: 'medidor', title: 'Revisión Medidor', component: Step2_Medidor },
  { id: 'mediciones', title: 'Mediciones', component: Step3_Mediciones },
  { id: 'fugas', title: 'Revisión de Fugas', component: Step4_Fugas },
  { id: 'equipos', title: 'Equipos de Consumo', component: Step5_Equipos },
  { id: 'resumen', title: 'Resumen y Firma', component: Step6_Resumen },
];

const ProgressBar = ({ current, total }) => {
  const progress = (current / total) * 100;
  return (
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div
        className="bg-blue-600 h-1.5 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

const RevisionWizard = () => {
  const navigate = useNavigate();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Step 1
    cliente_email: '',
    cliente_nombre: 'Cliente de Ejemplo',
    cliente_direccion: 'Dirección de Ejemplo',
    // Step 2
    tipo_servicio: 'Monofásico',
    sello_cfe: true,
    tornillos_flojos: false,
    conexiones_sulfatadas: false,
    base_sobrecalentada: false,
    capacidad_vs_calibre: true,
    // Step 3
    voltaje_f1_n: '',
    amperaje_f1: '',
    voltaje_f2_n: '',
    amperaje_f2: '',
    voltaje_f1_f2: '',
    voltaje_f3_n: '',
    amperaje_f3: '',
    voltaje_f2_f3: '',
    voltaje_f1_f3: '',
    amperaje_neutro: '',
    amperaje_inyeccion_paneles: '',
    voltaje_inyeccion_paneles: '',
    // Step 4
    se_puede_apagar_todo: null,
    fuga_f1: '',
    fuga_f2: '',
    fuga_f3: '',
    // Step 5
    equiposData: [],
    // Step 6
    causas_alto_consumo: [],
    recomendaciones: '',
    firmaBase64: null,
  });

  const goToNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(i => i + 1);
    }
  };

  const goToPrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(i => i - 1);
    }
  };

  const updateFormData = (newData) => {
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const handleSubmit = async () => {
    if (!formData.cliente_email) {
      alert("El correo del cliente es obligatorio.");
      setCurrentStepIndex(0);
      return;
    }

    setIsSubmitting(true);
    const { equiposData, firmaBase64, ...revisionData } = formData;
    const payload = {
      revisionData,
      equiposData: equiposData || [],
      firmaBase64,
    };

    try {
      await api.post('/revisiones', payload);
      alert('Revisión enviada con éxito');
      navigate('/casos');
    } catch (error) {
      console.error('Error al enviar la revisión:', error);
      alert('Hubo un error al enviar la revisión. Por favor, inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const CurrentStepComponent = steps[currentStepIndex].component;
  const currentStepTitle = steps[currentStepIndex].title;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="sticky top-0 z-10 w-full bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="w-1/4">
              {currentStepIndex > 0 && (
                <button onClick={goToPrevious} className="text-gray-500 hover:text-gray-800">
                  <ChevronLeft size={24} />
                </button>
              )}
            </div>
            <div className="w-1/2 text-center">
              <h1 className="text-lg font-bold text-gray-800 truncate">{currentStepTitle}</h1>
            </div>
            <div className="w-1/4" />
          </div>
          <div className="mt-3">
            <ProgressBar current={currentStepIndex + 1} total={steps.length} />
          </div>
        </div>
      </header>

      <main className="flex-grow overflow-y-auto pb-32">
        <div className="max-w-md mx-auto p-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
            >
              <CurrentStepComponent formData={formData} setFormData={setFormData} updateFormData={updateFormData} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <footer className="sticky bottom-0 z-10 w-full bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto p-4">
          <button
            onClick={isLastStep ? handleSubmit : goToNext}
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transform transition-transform duration-200 active:scale-95 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Enviando...' : (isLastStep ? 'Finalizar Revisión' : 'Siguiente')}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default RevisionWizard;

import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import InputCard from '../components/wizard/ui/InputCard';
import BigToggle from '../components/wizard/ui/BigToggle';
import PhotoUpload from '../components/wizard/ui/PhotoUpload';
import { AnimatePresence, motion } from 'framer-motion';

// Mock de los pasos para demostración
const steps = [
  { id: 'welcome', title: 'Bienvenida', component: WelcomeStep },
  { id: 'leak-check', title: 'Revisión de Fugas', component: LeakCheckStep },
  { id: 'photos', title: 'Evidencia Fotográfica', component: PhotosStep },
  { id: 'summary', title: 'Resumen y Firma', component: SummaryStep },
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
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState({
    hasLeaks: null,
    leakDescription: '',
    leakPhoto: null,
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

  const CurrentStepComponent = steps[currentStepIndex].component;
  const currentStepTitle = steps[currentStepIndex].title;
  const isLastStep = currentStepIndex === steps.length - 1;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header Fijo */}
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

      {/* Cuerpo del Wizard con scroll */}
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
              <CurrentStepComponent formData={formData} updateFormData={updateFormData} />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer Fijo */}
      <footer className="sticky bottom-0 z-10 w-full bg-white border-t border-gray-200">
        <div className="max-w-md mx-auto p-4">
          <button
            onClick={goToNext}
            className="w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 transform transition-transform duration-200 active:scale-95"
          >
            {isLastStep ? 'Finalizar Revisión' : 'Siguiente'}
          </button>
        </div>
      </footer>
    </div>
  );
};


// --- Componentes de Pasos (Ejemplos) ---

function WelcomeStep() {
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold mb-2">Iniciemos la Revisión</h2>
      <p className="text-gray-600">Sigue los pasos para completar el diagnóstico.</p>
    </div>
  )
}

function LeakCheckStep({ formData, updateFormData }) {
  return (
    <div className="space-y-6">
      <BigToggle
        label="¿Detectaste fugas de agua?"
        value={formData.hasLeaks}
        onChange={(value) => updateFormData({ hasLeaks: value })}
      />
      {formData.hasLeaks && (
        <InputCard
          label="Describe la fuga encontrada"
          id="leak-description"
          placeholder="Ej: Fuga en la tubería del lavabo"
          value={formData.leakDescription}
          onChange={(e) => updateFormData({ leakDescription: e.target.value })}
        />
      )}
    </div>
  );
}

function PhotosStep({ formData, updateFormData }) {
  return (
     <div className="space-y-6">
       <PhotoUpload
        label="Foto de la Fuga"
        photo={formData.leakPhoto}
        onUpload={(photoData) => updateFormData({ leakPhoto: photoData })}
        onClear={() => updateFormData({ leakPhoto: null })}
      />
      {/* Añadir más cargas de fotos si es necesario */}
    </div>
  )
}

function SummaryStep({ formData }) {
  return (
    <div className="space-y-4">
       <h2 className="text-xl font-bold border-b pb-2">Resumen</h2>
       <p><strong>Fugas:</strong> {formData.hasLeaks ? 'Sí' : 'No'}</p>
       {formData.hasLeaks && <p><strong>Descripción:</strong> {formData.leakDescription}</p>}
       {formData.leakPhoto && (
         <div>
           <strong>Evidencia:</strong>
           <img src={formData.leakPhoto} alt="Evidencia de fuga" className="mt-2 rounded-xl shadow-md"/>
         </div>
       )}
       <p className="text-center pt-4 text-gray-500">Aquí iría la firma del cliente.</p>
    </div>
  )
}


export default RevisionWizard;
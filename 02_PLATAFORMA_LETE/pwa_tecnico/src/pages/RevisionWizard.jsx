import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import Step1_Generales from '../components/wizard/steps/Step1_Generales';
import Step2_Medidor from '../components/wizard/steps/Step2_Medidor';
import Step3_Fugas from '../components/wizard/steps/Step3_Fugas';
import Step4_Equipos from '../components/wizard/steps/Step4_Equipos';
import Step5_Diagnostico from '../components/wizard/steps/Step5_Diagnostico';
import Step6_Resumen from '../components/wizard/steps/Step6_Resumen';

const steps = [
  { id: 1, title: 'Generales', component: Step1_Generales },
  { id: 2, title: 'Medidor', component: Step2_Medidor },
  { id: 3, title: 'Fugas', component: Step3_Fugas },
  { id: 4, title: 'Equipos', component: Step4_Equipos },
  { id: 5, title: 'Diagnóstico', component: Step5_Diagnostico },
  { id: 6, title: 'Resumen', component: Step6_Resumen },
];

const RevisionWizard = () => {
  const { casoId } = useParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({});
  const [direction, setDirection] = useState(1); // 1 for forward, -1 for backward

  const handleNext = () => {
    if (currentStep < steps.length) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
    }
  };

  const progressPercentage = ((currentStep -1) / (steps.length - 1)) * 100;

  const slideVariants = {
    hidden: (direction) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    visible: {
      x: '0%',
      opacity: 1,
      transition: { type: 'spring', stiffness: 260, damping: 30 },
    },
    exit: (direction) => ({
      x: direction > 0 ? '-100%' : '100%',
      opacity: 0,
      transition: { type: 'spring', stiffness: 260, damping: 30 },
    }),
  };

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="p-4 bg-white border-b border-gray-200">
        <div className="max-w-md mx-auto">
          <p className="text-sm text-gray-500">Caso #{casoId}</p>
          <h1 className="text-xl font-bold text-gray-800">{steps[currentStep - 1].title}</h1>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <motion.div
                className="bg-blue-600 h-2.5 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-xs text-right mt-1 text-gray-500">{`Paso ${currentStep} de ${steps.length}`}</p>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="flex-grow p-4 overflow-y-auto mb-24">
        <div className="max-w-md mx-auto">
           <AnimatePresence initial={false} custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                variants={slideVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                {React.createElement(steps[currentStep - 1].component, { formData, setFormData })}
              </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white shadow-lg z-10" style={{boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1), 0 -2px 4px -2px rgba(0, 0, 0, 0.1)'}}>
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="px-6 py-3 text-gray-600 bg-transparent border border-gray-300 rounded-lg font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ChevronLeft size={24} className="mr-2"/>
            Atrás
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-3 text-white bg-blue-600 rounded-lg font-semibold text-lg flex-grow ml-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {currentStep === steps.length ? 'Finalizar' : 'Siguiente'}
            <ChevronRight size={24} className="ml-2"/>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default RevisionWizard;

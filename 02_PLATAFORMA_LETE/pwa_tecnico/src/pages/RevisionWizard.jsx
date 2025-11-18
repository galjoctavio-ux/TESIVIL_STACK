import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Import step components
import Step1Generales from '../components/wizard/Step1Generales';
import Step2Medidor from '../components/wizard/Step2Medidor';
import Step3Mediciones from '../components/wizard/Step3Mediciones';
import Step4Fugas from '../components/wizard/Step4Fugas';
import Step5Equipos from '../components/wizard/Step5Equipos';
import Step6Cierre from '../components/wizard/Step6Cierre';

// Import UI components
import Button from '../components/wizard/ui/Button';

const TOTAL_STEPS = 6;

const RevisionWizard = () => {
  const { casoId } = useParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Initialize with all expected fields
    cliente_email: '',
    sello_cfe: true,
    // ... other fields will be added as we build the steps
    fugas: [],
    equipos: [],
  });

  const nextStep = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFormDataChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Generales formData={formData} handleChange={handleFormDataChange} />;
      case 2:
        return <Step2Medidor formData={formData} handleChange={handleFormDataChange} />;
      case 3:
        return <Step3Mediciones formData={formData} handleChange={handleFormDataChange} />;
      case 4:
        return <Step4Fugas formData={formData} setFormData={setFormData} />;
      case 5:
        return <Step5Equipos formData={formData} setFormData={setFormData} />;
      case 6:
        return <Step6Cierre formData={formData} handleChange={handleFormDataChange} />;
      default:
        return <Step1Generales formData={formData} handleChange={handleFormDataChange} />;
    }
  };

  const progressPercentage = ((currentStep - 1) / (TOTAL_STEPS -1)) * 100;

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.headerTitle}>Revisión Caso #{casoId}</h1>
        <div style={styles.progressBarContainer}>
          <motion.div
            style={styles.progressBar}
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ ease: "easeInOut", duration: 0.5 }}
          />
        </div>
      </header>

      {/* Body */}
      <main style={styles.body}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={{ flex: 1 }}>
          {currentStep > 1 && (
            <Button variant="outline" onClick={prevStep} type="button">
                <ChevronLeft size={20} style={{ marginRight: '8px' }} />
                Atrás
            </Button>
          )}
        </div>
        <div style={{ flex: 2 }}>
            <Button onClick={nextStep} fullWidth type="button">
                {currentStep === TOTAL_STEPS ? 'Finalizar' : 'Siguiente'}
                <ChevronRight size={20} style={{ marginLeft: '8px' }} />
            </Button>
        </div>
      </footer>
    </div>
  );
};

const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: '#F3F4F6',
      },
      header: {
        padding: '16px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
      },
      headerTitle: {
        margin: 0,
        fontSize: '1.25rem',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: '12px'
      },
      progressBarContainer: {
        height: '8px',
        backgroundColor: '#E5E7EB',
        borderRadius: '4px',
        overflow: 'hidden',
      },
      progressBar: {
        height: '100%',
        backgroundColor: '#4F46E5',
        borderRadius: '4px',
      },
      body: {
        flex: 1,
        padding: '16px',
        overflowY: 'auto',
        paddingBottom: '100px', // Space for the fixed footer
      },
      footer: {
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        padding: '16px',
        backgroundColor: 'white',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
        borderTop: '1px solid #E5E7EB',
      },
};

export default RevisionWizard;
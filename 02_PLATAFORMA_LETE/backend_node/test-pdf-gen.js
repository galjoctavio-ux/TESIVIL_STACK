import { generarPDF } from './src/services/pdf.service.js';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const mockData = {
    header: {
        id: 123,
        fecha_revision: new Date().toISOString(),
        cliente_nombre: 'Juan Perez',
        cliente_direccion: 'Calle Falsa 123',
        cliente_email: 'juan@example.com',
        tecnico_nombre: 'Tecnico Test'
    },
    mediciones: {
        tipo_servicio: 'Monofásico',
        sello_cfe: true,
        tornillos_flojos: false,
        capacidad_vs_calibre: true,
        edad_instalacion: '5 años',
        observaciones_cc: 'Todo en orden',
        voltaje_medido: 127,
        corriente_red_f1: 10,
        corriente_fuga_f1: 0.1,
        cantidad_paneles: 0
    },
    equipos: [
        { nombre_equipo: 'Refrigerador', ubicacion: 'Cocina', amperaje: 2.5, estado_equipo: 'Bueno' },
        { nombre_equipo: 'Microondas', ubicacion: 'Cocina', amperaje: 10, estado_equipo: 'Regular' }
    ],
    causas_alto_consumo: ['Uso excesivo de microondas'],
    recomendaciones_tecnico: 'Revisar aislamiento',
    firma_base64: null
};

const run = async () => {
    try {
        console.log('Testing PDF Generation...');
        const pdfBuffer = await generarPDF(mockData);
        fs.writeFileSync('test-reporte.pdf', pdfBuffer);
        console.log('PDF saved to test-reporte.pdf');
    } catch (error) {
        console.error('Error:', error);
    }
};

run();

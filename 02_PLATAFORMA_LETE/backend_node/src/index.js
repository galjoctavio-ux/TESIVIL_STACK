import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// --- Importación de Rutas ---
import authRoutes from './routes/auth.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import casosRoutes from './routes/casos.routes.js';
import revisionesRoutes from './routes/revisiones.routes.js';
import citasRoutes from './routes/citas.routes.js';
import agendaRoutes from './routes/agenda.routes.js';

// --- NUEVAS RUTAS (CRM y Finanzas) ---
import clientesRoutes from './routes/clientes.routes.js';
import finanzasRoutes from './routes/finanzas.routes.js';
import configRoutes from './routes/config.routes.js';
// 👇 1. AGREGA ESTA LÍNEA AQUÍ
import integracionRoutes from './routes/integracion.routes.js';

import './services/eaDatabase.js';

// Cargar variables de entorno
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// --- Middlewares Esenciales ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Router Principal ---
const apiRouter = express.Router();

// Ruta de prueba de salud
apiRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API de TESIVIL está viva y conectada.',
    timestamp: new Date().toISOString()
  });
});

// --- Registro de Rutas dentro de apiRouter ---
apiRouter.use('/auth', authRoutes);
apiRouter.use('/usuarios', usuariosRoutes);
apiRouter.use('/casos', casosRoutes);
apiRouter.use('/revisiones', revisionesRoutes);
apiRouter.use('/citas', citasRoutes);
apiRouter.use('/agenda', agendaRoutes);

// --- NUEVOS ENDPOINTS REGISTRADOS ---
apiRouter.use('/clientes', clientesRoutes);
apiRouter.use('/finanzas', finanzasRoutes);
apiRouter.use('/config', configRoutes); // <--- 1. AGREGAR AQUÍ (Mover de abajo hacia acá)
// 👇 2. AGREGA ESTA LÍNEA AQUÍ
apiRouter.use('/integracion', integracionRoutes);
// ¡IMPORTANTE! Montamos nuestro router en el prefijo
app.use('/lete/api', apiRouter);

// --- Manejador de errores básico ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal en el servidor');
});

// --- Iniciar Servidor ---
app.listen(port, () => {
  console.log(`Backend API Server corriendo en http://localhost:${port}`);
  console.log(`Ruta pública (via NGINX): /lete/api`);
});

export { apiRouter };
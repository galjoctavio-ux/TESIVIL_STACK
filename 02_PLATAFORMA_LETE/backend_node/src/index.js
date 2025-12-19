import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// ... (Tus imports siguen igual) ...
import authRoutes from './routes/auth.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import casosRoutes from './routes/casos.routes.js';
import revisionesRoutes from './routes/revisiones.routes.js';
import citasRoutes from './routes/citas.routes.js';
import agendaRoutes from './routes/agenda.routes.js';
import clientesRoutes from './routes/clientes.routes.js';
import finanzasRoutes from './routes/finanzas.routes.js';
import configRoutes from './routes/config.routes.js';
import integracionRoutes from './routes/integracion.routes.js';
import agendaGlobalRoutes from './routes/agendaGlobal.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import './services/eaDatabase.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// ==========================================
// 1. BLOQUE CRÍTICO: PARSERS PRIMERO
// ==========================================
// Deben ir ANTES de cualquier ruta o log para que 'req.body' exista.
app.use(cors());

// Aumentamos a 50mb para que no falle al subir firmas o arrays de fotos grandes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ==========================================
// 2. AHORA SÍ: EL LOGGER (MODO CHISMOSO)
// ==========================================
app.use((req, res, next) => {
  console.log(`📡 [TRAFICO ENTRANTE] ${req.method} ${req.url}`);

  if (req.method === 'POST') {
    // Ahora sí mostrará las llaves porque express.json() ya hizo su trabajo arriba
    const keys = Object.keys(req.body || {});
    console.log('📦 Body keys:', keys.length > 0 ? keys : '⚠️ VACÍO O NO PARSEADO');
  }
  next();
});

// ==========================================
// 3. RUTAS
// ==========================================
const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'API de TESIVIL está viva y conectada.',
    timestamp: new Date().toISOString()
  });
});

apiRouter.use('/auth', authRoutes);
apiRouter.use('/usuarios', usuariosRoutes);
apiRouter.use('/casos', casosRoutes);
apiRouter.use('/revisiones', revisionesRoutes);
apiRouter.use('/citas', citasRoutes);
apiRouter.use('/agenda', agendaRoutes);
apiRouter.use('/clientes', clientesRoutes);
apiRouter.use('/finanzas', finanzasRoutes);
apiRouter.use('/config', configRoutes);
apiRouter.use('/integracion', integracionRoutes);
apiRouter.use('/notifications', notificationsRoutes);

// Montaje de rutas
app.use('/lete/api', apiRouter);
app.use('/api/global-agenda', agendaGlobalRoutes);

// Manejo de Errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Algo salió mal en el servidor');
});

app.listen(port, () => {
  console.log(`Backend API Server corriendo en http://localhost:${port}`);
  console.log(`Ruta pública (via NGINX): /lete/api`);
});

export { apiRouter };
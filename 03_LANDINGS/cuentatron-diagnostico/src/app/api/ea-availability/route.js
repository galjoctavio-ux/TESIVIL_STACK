import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// Configuración de la regla de negocio
const BUFFER_TRASLADO_MINUTOS = 60; // 1 hora de traslado antes y después
const DURACION_SERVICIO_MINUTOS = 30; // Duración estimada del servicio
const HORARIO_INICIO = 9; // 9:00 AM
const HORARIO_FIN = 18; // 6:00 PM

export async function POST(request) {
// 1. Validar credenciales de DB
const { EA_DB_HOST, EA_DB_USER, EA_DB_PASSWORD, EA_DB_NAME, EASY_APPOINTMENTS_SERVICE_ID } = process.env;

if (!EA_DB_HOST || !EA_DB_USER || !EA_DB_NAME) {
return NextResponse.json({ error: 'Faltan credenciales de base de datos en .env' }, { status: 500 });
}

let connection;

try {
// 2. Conectar a la Base de Datos
connection = await mysql.createConnection({
host: EA_DB_HOST,
user: EA_DB_USER,
password: EA_DB_PASSWORD,
database: EA_DB_NAME
});

// 3. Obtener el Pool de Proveedores (Técnicos)
// Buscamos técnicos que estén vinculados al servicio solicitado
// Nota: Asumimos la estructura estándar de tablas de E!A: ea_users, ea_services_providers
const [providers] = await connection.execute(
`SELECT id_users FROM ea_services_providers WHERE id_services = ?`,
[EASY_APPOINTMENTS_SERVICE_ID]
);

const providerIds = providers.map(p => p.id_users);

if (providerIds.length === 0) {
return NextResponse.json({ error: 'No hay técnicos asignados a este servicio.' }, { status: 404 });
}

// 4. Definir rango de fechas (próximos 14 días)
const slotsDisponibles = {};
const hoy = new Date();

// Iteramos por los próximos 14 días
for (let i = 1; i <= 14; i++) {
const fechaBase = new Date(hoy);
fechaBase.setDate(hoy.getDate() + i);

// Formato YYYY-MM-DD para la clave del JSON y consultas SQL
const fechaStr = fechaBase.toISOString().split('T')[0];
const slotsDelDia = [];

// Consultamos TODAS las citas de ese día para TODOS los proveedores del pool
// Buscamos cualquier cita que empiece o termine en este día
const [citas] = await connection.execute(
`SELECT start_datetime, end_datetime, id_users_provider
FROM ea_appointments
WHERE id_users_provider IN (?)
AND DATE(start_datetime) = ?`,
[providerIds, fechaStr]
);

// 5. Generar Slots Candidatos (de 9am a 6pm)
for (let hora = HORARIO_INICIO; hora < HORARIO_FIN; hora++) {
// Creamos la fecha exacta del slot candidato
const slotCandidatoInicio = new Date(fechaBase);
slotCandidatoInicio.setHours(hora, 0, 0, 0); // Ej: 10:00:00

const slotCandidatoFin = new Date(slotCandidatoInicio);
slotCandidatoFin.setMinutes(slotCandidatoFin.getMinutes() + DURACION_SERVICIO_MINUTOS); // Ej: 10:30:00

// 6. VERIFICACIÓN DE DISPONIBILIDAD (EL "SANDWICH")
// Para que el slot sea válido, AL MENOS UN técnico debe estar libre
// considerando el Buffer de Traslado.

let algunTecnicoLibre = false;

for (const providerId of providerIds) {
// Filtramos las citas de ESTE técnico específico
const citasTecnico = citas.filter(c => c.id_users_provider === providerId);

let tecnicoTieneConflicto = false;

for (const cita of citasTecnico) {
const citaInicio = new Date(cita.start_datetime);
const citaFin = new Date(cita.end_datetime);

// Definimos la "Zona Prohibida" alrededor de la cita existente
// Incluye el tiempo de la cita MÁS el buffer antes y después
const zonaProhibidaInicio = new Date(citaInicio);
zonaProhibidaInicio.setMinutes(zonaProhibidaInicio.getMinutes() - BUFFER_TRASLADO_MINUTOS);

const zonaProhibidaFin = new Date(citaFin);
zonaProhibidaFin.setMinutes(zonaProhibidaFin.getMinutes() + BUFFER_TRASLADO_MINUTOS);

// Comprobamos si nuestro Slot Candidato choca con la Zona Prohibida
// Lógica de colisión de rangos: (StartA < EndB) y (EndA > StartB)
if (slotCandidatoInicio < zonaProhibidaFin && slotCandidatoFin > zonaProhibidaInicio) {
tecnicoTieneConflicto = true;
break; // Este técnico ya no sirve para esta hora
}
}

if (!tecnicoTieneConflicto) {
algunTecnicoLibre = true;
break; // ¡Encontramos un técnico libre! No hace falta checar los demás.
}
}

// Si encontramos al menos un técnico libre, agregamos el slot
if (algunTecnicoLibre) {
// Formato de salida compatible con el frontend existente: "YYYY-MM-DD HH:mm:ss"
const horaStr = String(hora).padStart(2, '0');
slotsDelDia.push(`${fechaStr} ${horaStr}:00:00`);
}
}

if (slotsDelDia.length > 0) {
slotsDisponibles[fechaStr] = slotsDelDia;
}
}

// Aplanamos el objeto a un array simple como espera el frontend actual si es necesario,
// o devolvemos el objeto si el front lo maneja.
// El frontend actual parece esperar un array plano ["2023-10-10 09:00:00", ...]
// basado en: const grouped = slots.reduce(...)
const listaPlana = Object.values(slotsDisponibles).flat();

return NextResponse.json(listaPlana);

} catch (error) {
console.error('Error calculando disponibilidad avanzada:', error);
return NextResponse.json({ error: 'Error interno', details: error.message }, { status: 500 });
} finally {
if (connection) await connection.end();
}
}

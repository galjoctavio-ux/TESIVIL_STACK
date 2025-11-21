import { supabaseAdmin, supabaseKey } from './supabaseClient.js';
import { Buffer } from 'buffer';
import axios from 'axios';
import { 
  calcularConsumoEquipos,
  detectarFugas,
  verificarSolar,
  generarDiagnosticosAutomaticos 
} from './calculos.service.js';
import { enviarReportePorEmail } from './email.service.js';

export const processRevision = async (payload, tecnico) => {
  const { revisionData, equiposData, firmaBase64 } = payload;

  if (!revisionData || !equiposData) {
    throw new Error('Faltan "revisionData" o "equiposData"');
  }

  // ---------------------------------------------------------
  // 1. SANITIZACIÓN Y PREPARACIÓN DE DATOS
  // ---------------------------------------------------------
  
  // Creamos una copia para trabajar
  const datosDeTrabajo = { ...revisionData };

  // CORRECCIÓN 1: Asegurar tipos numéricos para evitar "toFixed is not a function"
  // Convertimos a float, si falla o es null, asignamos 0.
  datosDeTrabajo.fuga_total = parseFloat(datosDeTrabajo.fuga_total) || 0;
  datosDeTrabajo.voltaje_medido = parseFloat(datosDeTrabajo.voltaje_medido) || 0;
  
  // Si viene voltaje_fn (que causa error en DB) y voltaje_medido es 0, lo aprovechamos
  if (datosDeTrabajo.voltaje_fn) {
    const vFn = parseFloat(datosDeTrabajo.voltaje_fn) || 0;
    if (datosDeTrabajo.voltaje_medido === 0) {
      datosDeTrabajo.voltaje_medido = vFn;
    }
  }

  // Asegurar IDs numéricos
  if (datosDeTrabajo.caso_id) {
      datosDeTrabajo.caso_id = Number(datosDeTrabajo.caso_id);
  }

  // Sanitizar equipos para cálculos
  const equiposSanitizados = equiposData.map(eq => ({
      ...eq,
      horas_uso: parseFloat(eq.horas_uso) || 0,
      potencia: parseFloat(eq.potencia) || 0,
      cantidad: parseFloat(eq.cantidad) || 1
  }));

  console.log(`Procesando revisión para el caso ${datosDeTrabajo.caso_id} por el técnico ${tecnico.email}`);

  let casoData; 
  let pdfUrl = null; 

  try {
    // ---------------------------------------------------------
    // 2. CÁLCULOS (Usando datosDeTrabajo que tiene fuga_total y todo lo necesario)
    // ---------------------------------------------------------
    const voltajeCalculo = datosDeTrabajo.voltaje_medido > 0 ? datosDeTrabajo.voltaje_medido : 127; // Default seguridad

    const equiposCalculados = calcularConsumoEquipos(equiposSanitizados, voltajeCalculo);
    const diagnosticoFuga = detectarFugas(datosDeTrabajo);
    const diagnosticoSolar = verificarSolar(datosDeTrabajo);
    
    const diagnosticos = generarDiagnosticosAutomaticos(
      datosDeTrabajo,
      equiposCalculados, 
      diagnosticoFuga, 
      diagnosticoSolar
    );
    console.log('Diagnósticos generados:', diagnosticos);

    // ---------------------------------------------------------
    // 3. GUARDADO EN BASE DE DATOS
    // ---------------------------------------------------------
    
    // CORRECCIÓN 2: Limpieza estricta para Supabase
    // Creamos un objeto LIMPIO solo con las columnas que sabemos que existen o queremos guardar.
    // Copiamos todo primero...
    const datosParaInsertar = { ...datosDeTrabajo };

    // ... y ELIMINAMOS las columnas que NO existen en la tabla 'revisiones' y causan error.
    delete datosParaInsertar.voltaje_fn;   // No existe en DB
    delete datosParaInsertar.fuga_total;   // No existe en DB
    delete datosParaInsertar.amperaje_medido; // No existe en DB (se usan corriente_red_fx)

    // Agregamos campos calculados/sistémicos
    datosParaInsertar.tecnico_id = tecnico.id;
    datosParaInsertar.diagnosticos_automaticos = diagnosticos;

    const { data: revisionResult, error: revisionError } = await supabaseAdmin
      .from('revisiones')
      .insert(datosParaInsertar)
      .select()
      .single();

    if (revisionError) throw revisionError;

    const newRevisionId = revisionResult.id;

    // --- Guardar Equipos ---
    let equiposProcesados = 0;
    if (equiposCalculados.length > 0) {
        const equiposParaInsertar = equiposCalculados.map(equipo => ({
          ...equipo,
          revision_id: newRevisionId
        }));
        const { error: equiposError } = await supabaseAdmin
          .from('equipos_revisados')
          .insert(equiposParaInsertar);
        if (equiposError) throw equiposError;
        equiposProcesados = equiposParaInsertar.length;
        console.log(`Guardados ${equiposProcesados} equipos para la revisión ${newRevisionId}`);
    }

    // --- Actualizar Status del Caso ---
    const { data: casoUpdated, error: casoError } = await supabaseAdmin
      .from('casos')
      .update({ status: 'completado' })
      .eq('id', datosDeTrabajo.caso_id)
      .select('cliente_nombre, cliente_direccion') 
      .single();

    if (casoError) console.warn(`Error al actualizar caso ${datosDeTrabajo.caso_id}:`, casoError.message);
    casoData = casoUpdated;

    // ---------------------------------------------------------
    // 4. PROCESAMIENTO DE FIRMA Y ARCHIVOS
    // ---------------------------------------------------------
    let firmaUrl = null;
    if (firmaBase64) {
        console.log('Procesando firma...');
        const matches = firmaBase64.match(/^data:(.+);base64,(.+)$/);
        if (!matches || matches.length !== 3) throw new Error('Formato de firmaBase64 inválido');

        const contentType = matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const filePath = `firmas/revision-${newRevisionId}.png`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('reportes')
          .upload(filePath, data, { contentType });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabaseAdmin.storage.from('reportes').getPublicUrl(filePath);
        firmaUrl = urlData.publicUrl;
        console.log('Firma subida a:', firmaUrl);

        await supabaseAdmin
          .from('revisiones')
          .update({ firma_url: firmaUrl })
          .eq('id', newRevisionId);
    }

    // ---------------------------------------------------------
    // 5. GENERACIÓN PDF (PHP) Y EMAIL
    // ---------------------------------------------------------
    console.log(`Delegando la generación del PDF para la revisión ${newRevisionId} a PHP.`);

    const phpPdfEndpoint = process.env.PHP_PDF_ENDPOINT || 'http://localhost/lete/api/revisiones/generar_pdf_final';

    try {
        const response = await axios.post(phpPdfEndpoint, {
            revision_id: newRevisionId
        });

        if (response.data && response.data.pdf_url) {
            pdfUrl = response.data.pdf_url;
            console.log('PDF generado por PHP en:', pdfUrl);

            await supabaseAdmin
                .from('revisiones')
                .update({ pdf_url: pdfUrl })
                .eq('id', newRevisionId);
        } else {
            console.warn('El servicio de PHP no devolvió una URL de PDF.', response.data);
        }
    } catch (axiosError) {
        console.error('Error al llamar al servicio de PHP para generar el PDF:', axiosError.message);
        if (axiosError.response) {
            console.error('Data:', axiosError.response.data);
            console.error('Status:', axiosError.response.status);
        }
    }

    if (pdfUrl && revisionResult.cliente_email && casoData?.cliente_nombre) {
      await enviarReportePorEmail(
        revisionResult.cliente_email,
        casoData.cliente_nombre,
        pdfUrl,
        revisionResult.causas_alto_consumo 
      );
    } else {
      console.warn('Faltan datos (pdfUrl, email o nombre) para enviar el correo.');
    }

    console.log(`Revisión ${newRevisionId} guardada. Caso ${datosDeTrabajo.caso_id} completado.`);

    return {
      message: `Revisión guardada. ${equiposProcesados} equipos. ${diagnosticos.length} diagnósticos.`,
      revision_id: newRevisionId,
      diagnosticos_generados: diagnosticos,
      firma_url: firmaUrl,
      pdf_url: pdfUrl
    };

  } catch (error) {
      console.error('Error fatal durante el procesamiento de la revisión:', error.message);
      throw error;
  }
};
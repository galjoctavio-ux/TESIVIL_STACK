import { supabaseAdmin, supabaseKey } from './supabaseClient.js';
import { Buffer } from 'buffer';
import axios from 'axios';
import { 
  calcularConsumoEquipos,
  detectarFugas,
  verificarSolar,
  generarDiagnosticosAutomaticos 
} from './calculos.service.js';
// ¡NUEVO! Importamos nuestro servicio de email
import { enviarReportePorEmail } from './email.service.js';

export const processRevision = async (payload, tecnico) => {
  const { revisionData, equiposData, firmaBase64 } = payload;

  if (!revisionData || !equiposData) {
    throw new Error('Faltan "revisionData" o "equiposData"');
  }

  const revisionDataCorregida = { ...revisionData };


  console.log(`Procesando revisión para el caso ${revisionDataCorregida.caso_id} por el técnico ${tecnico.email}`);

  let casoData; // (¡NUEVO!) La necesitamos en 2 sitios, la declaramos aquí
  let pdfUrl = null; // (¡NUEVO!) Declarada aquí

  try {
    // --- PASO 1: Ejecutar TODOS los cálculos ---
    const voltajeMedido = revisionDataCorregida.voltaje_medido;
    const equiposCalculados = calcularConsumoEquipos(equiposData, voltajeMedido);
    const diagnosticoFuga = detectarFugas(revisionDataCorregida);
    const diagnosticoSolar = verificarSolar(revisionDataCorregida);
    const diagnosticos = generarDiagnosticosAutomaticos(
      revisionDataCorregida,
      equiposCalculados, 
      diagnosticoFuga, 
      diagnosticoSolar
    );
    console.log('Diagnósticos generados:', diagnosticos);

    // --- PASO 2: Guardar la Revisión Principal ---
    const { data: revisionResult, error: revisionError } = await supabaseAdmin
      .from('revisiones')
      .insert({ 
          ...revisionDataCorregida,
          tecnico_id: tecnico.id, // ¡AÑADIDO! Asociamos la revisión con el técnico.
          diagnosticos_automaticos: diagnosticos
      })
      .select()
      .single();

    if (revisionError) throw revisionError;

    const newRevisionId = revisionResult.id;

    // --- PASO 3: Guardar Equipos ---
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

    // --- PASO 4: Actualizar el Status del Caso ---
    const { data: casoUpdated, error: casoError } = await supabaseAdmin
      .from('casos')
      .update({ status: 'completado' })
      .eq('id', revisionDataCorregida.caso_id)
      .select('cliente_nombre, cliente_direccion') // Obtenemos nombre y dirección
      .single();

    if (casoError) console.warn(`Error al actualizar caso ${revisionDataCorregida.caso_id}:`, casoError.message);
    casoData = casoUpdated; // Guardamos los datos del caso

    // --- PASO 5: Procesar Firma ---
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

    // --- PASO 6: Delegar Generación de PDF a PHP ---
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

    // --- PASO 7: Enviar Email (¡NUEVO!) ---
    if (pdfUrl && revisionResult.cliente_email && casoData?.cliente_nombre) {
      await enviarReportePorEmail(
        revisionResult.cliente_email,
        casoData.cliente_nombre,
        pdfUrl,
        revisionResult.causas_alto_consumo // ¡NUEVO! Pasamos las causas
      );
    } else {
      console.warn('Faltan datos (pdfUrl, email o nombre) para enviar el correo.');
    }

    console.log(`Revisión ${newRevisionId} guardada. Caso ${revisionDataCorregida.caso_id} completado.`);

    return {
      message: `Revisión guardada. ${equiposProcesados} equipos. ${diagnosticos.length} diagnósticos.`,
      revision_id: newRevisionId,
      diagnosticos_generados: diagnosticos,
      firma_url: firmaUrl,
      pdf_url: pdfUrl
    };

  } catch (error) {
      console.error('Error fatal durante el procesamiento de la revisión:', error.message);
      // Devolvemos el error
      throw error;
  }
};

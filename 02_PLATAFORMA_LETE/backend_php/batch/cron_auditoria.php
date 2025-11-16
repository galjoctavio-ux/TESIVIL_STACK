<?php
// Script para ejecución en consola (CLI)
// Uso: php batch/cron_auditoria.php

require_once __DIR__ . '/../config/bootstrap.php'; // Carga las variables de entorno
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Services/GeminiService.php';

// Configuración
if (!isset($_ENV['GEMINI_API_KEY'])) {
    die("Error: La variable de entorno GEMINI_API_KEY no está configurada.\n");
}
$apiKey = $_ENV['GEMINI_API_KEY'];
$itemsPorLote = 30; // Bajamos un poco el lote para que se concentre mejor
$tiempoEspera = 15; // 15 seg es suficiente para pruebas rápidas

echo "--- 🕵️ AUDITORÍA MODO PARANOICO (V3.0) ---\n";
echo "Fecha: " . date('Y-m-d H:i:s') . "\n";

try {
    $db = (new Database())->getConnection();

    // 1. Obtener inventario
    $stmt = $db->query("SELECT id, nombre, unidad FROM recursos WHERE activo = 1");
    $todosLosRecursos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // --- TRAMPAS OBLIGATORIAS ---
    // Estas trampas DEBEN ser detectadas
    $todosLosRecursos[] = ['id' => 99001, 'nombre' => 'Cable de Cobre Calibre 12', 'unidad' => 'Litros'];
    $todosLosRecursos[] = ['id' => 99002, 'nombre' => 'Manguera Corrugada 1/2', 'unidad' => 'pza'];
    $todosLosRecursos[] = ['id' => 99003, 'nombre' => 'Punta de Poste Desconocida', 'unidad' => 'caja'];

    $totalItems = count($todosLosRecursos);
    echo "Total items a revisar: $totalItems\n";

    // 2. Dividir en Lotes
    $lotes = array_chunk($todosLosRecursos, $itemsPorLote);
    $totalLotes = count($lotes);

    echo "Se procesará en $totalLotes lotes.\n";
    echo "---------------------------------------------------\n";

    foreach ($lotes as $index => $loteActual) {
        $numLote = $index + 1;
        echo "\n📦 Lote $numLote... ";

        // Construir lista
        $listaTexto = "";
        foreach ($loteActual as $r) {
            $listaTexto .= "- ID:{$r['id']} | PRODUCTO: '{$r['nombre']}' | UNIDAD: '{$r['unidad']}'\n";
        }

        // 3. Consultar a Gemini (PROMPT AGRESIVO)
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' . $apiKey;

        $prompt = "Eres un Auditor de Calidad estricto. Estoy probando tu capacidad de detección.
        HE INSERTADO ERRORES INTENCIONALES EN ESTA LISTA. TU TRABAJO ES ENCONTRARLOS.

        Analiza la lógica física de cada item:

        REGLAS DE ERROR (Si ves esto, REPÓRTALO):
        1. UNIDAD ABSURDA:
           - Cables, Alambres, Mangueras -> SOLO pueden ser 'm', 'metros', 'rollos'. SI DICE 'pza', 'litros' o 'caja' ES ERROR GRAVE.
           - Solidos (Metales, Plasticos) -> NO pueden ser 'Litros'.
        2. NOMBRE SIN SENTIDO:
           - Palabras vagas como 'Punta', 'Tramo', 'Cosa' sin más contexto.

        LISTA A AUDITAR:
        $listaTexto

        RESPUESTA JSON OBLIGATORIA:
        [
           {\"tipo\": \"ERROR_UNIDAD\", \"nombres\": \"Cable X\", \"razon\": \"Unidad Litros es imposible para un cable\", \"ids\": [99]}
        ]
        Si el lote es PERFECTO (muy improbable), devuelve [].";

        $data = [
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => [
                'temperature' => 0.4, // Un poco más creativo para detectar patrones
                'responseMimeType' => 'application/json'
            ]
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        curl_close($ch);

        $jsonResponse = json_decode($response, true);
        $textoIA = $jsonResponse['candidates'][0]['content']['parts'][0]['text'] ?? '[]';

        // Limpieza
        $textoIA = str_replace(['```json', '```'], '', $textoIA);
        $hallazgos = json_decode($textoIA, true);

        if (is_array($hallazgos) && count($hallazgos) > 0) {
            echo "🚨 " . count($hallazgos) . " DETECTADOS:\n";
            foreach($hallazgos as $h) {
                echo "   - [{$h['tipo']}] {$h['nombres']} ({$h['razon']})\n";

                // Guardar en BD (Descomentar cuando estés satisfecho)
                /*
                $idsStr = is_array($h['ids']) ? implode(',', $h['ids']) : $h['ids'];
                $tipoBD = 'AMBIGUO';
                if (strpos($h['tipo'], 'UNIDAD') !== false) $tipoBD = 'AMBIGUO'; // O crear tipo ERROR_UNIDAD en BD

                $stmtInsert = $db->prepare("INSERT INTO auditoria_inventario (tipo_problema, ids_implicados, nombres_implicados, razon_ia, estado) VALUES (?, ?, ?, ?, 'PENDIENTE')");
                $stmtInsert->execute([$tipoBD, $idsStr, $h['nombres'], $h['razon']]);
                */
            }
        } else {
            echo "✅ Limpio.";
            // Si sabemos que este lote tiene la trampa, imprimimos alerta
            if(strpos($listaTexto, 'Litros') !== false) {
                echo " (⚠️ FALLO DE DETECCIÓN EN TRAMPA)";
            }
        }

        if ($numLote < $totalLotes) {
            sleep($tiempoEspera);
        }
    }

    echo "\n--- FIN ---\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>

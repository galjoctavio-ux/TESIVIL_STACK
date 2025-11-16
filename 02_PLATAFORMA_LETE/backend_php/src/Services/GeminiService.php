<?php
declare(strict_types=1);

// Incluir el bootstrap para cargar las variables de entorno
require_once __DIR__ . '/../../config/bootstrap.php';

class GeminiService {
    private string $apiKey;
    private string $apiUrl;

    public function __construct() {
        // Leer la API Key desde las variables de entorno
        $this->apiKey = $_ENV['GEMINI_API_KEY'];
        $this->apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . $this->apiKey;
    }

    /**
     * FUNCIÓN 1: Sugiere materiales faltantes (Ya la tenías)
     */
    public function sugerirMaterialesFaltantes(array $nombresMateriales): array {
        if (empty($nombresMateriales)) return [];

        $listaTexto = "- " . implode("\n- ", $nombresMateriales);
        $prompt = "Eres un ingeniero electricista supervisor en México. Un técnico está armando una cotización con estos materiales:\n" . $listaTexto . "\n\n¿Qué 3 a 5 materiales accesorios (consumibles, fijación, etc.) le podrían faltar? Responde SOLO con la lista separada por comas.";

        try {
            $textoRespuesta = $this->llamarGemini($prompt);
            return array_map('trim', explode(',', $textoRespuesta));
        } catch (Exception $e) {
            error_log("Error en sugerencias Gemini: " . $e->getMessage());
            return []; // Si falla, no rompemos el flujo, solo no mostramos sugerencias
        }
    }

    /**
     * FUNCIÓN 2: Auditoría de Costos (¡NUEVA!)
     * Pide a la IA un estimado de precio de mercado para comparar.
     */
    public function estimarCostoProyecto(array $items, float $horasTrabajo): float {
        // 1. Preparamos el resumen para la IA
        $listaMateriales = "";
        foreach ($items as $item) {
            // Manejamos el caso de que venga como array o como objeto
            $nombre = is_array($item) ? ($item['nombre'] ?? 'Material') : $item['nombre'];
            $cantidad = is_array($item) ? ($item['cantidad'] ?? 1) : $item['cantidad'];
            $listaMateriales .= "- $cantidad x $nombre\n";
        }

        $prompt = "Actúa como un contratista eléctrico experto en México.
Voy a darte los detalles de un trabajo para que me des un VALOR APROXIMADO DE MERCADO (Materiales + Mano de Obra + Utilidad) en Pesos Mexicanos (MXN).

DETALLES DEL TRABAJO:
Tiempo estimado de labor: $horasTrabajo horas de un técnico y un ayudante.
Materiales principales a utilizar:
$listaMateriales

INSTRUCCIONES:
Analiza la complejidad implícita. Calcula un precio justo total para el cliente final.
TU RESPUESTA DEBE SER ÚNICAMENTE EL NÚMERO SIN SIMBOLOS NI TEXTO.
Ejemplo: 4500.50
No expliques nada, solo dame el número.";

        try {
            $respuesta = $this->llamarGemini($prompt, 0.2); // Temperatura baja para ser más preciso/matemático

            // Limpiamos la respuesta para obtener solo el número
            $numeroLimpio = preg_replace('/[^0-9.]/', '', $respuesta);
            return floatval($numeroLimpio);

        } catch (Exception $e) {
            error_log("Error en estimación Gemini: " . $e->getMessage());
            return 0.0; // Si falla, devolvemos 0 para indicar que no hubo estimación
        }
    }

    /**
     * FUNCIÓN 3: Genera un resumen del objetivo del proyecto (¡NUEVA!)
     * @param array $datosCotizacion Los datos completos de la cotización.
     * @return string El resumen generado o una cadena vacía si falla.
     */
    public function generarResumenObjetivo(array $datosCotizacion): string {
        if (empty($datosCotizacion['items_materiales']) && empty($datosCotizacion['items_mo'])) {
            return '';
        }

        $listaMateriales = "";
        foreach ($datosCotizacion['items_materiales'] as $item) {
            $listaMateriales .= "- " . floatval($item['cantidad']) . " " . htmlspecialchars($item['unidad']) . " de " . htmlspecialchars($item['nombre']) . "\n";
        }

        $listaTareas = "";
        foreach ($datosCotizacion['items_mo'] as $tarea) {
            $listaTareas .= "- " . htmlspecialchars($tarea['descripcion']) . " (" . floatval($tarea['horas']) . " hrs)\n";
        }

        $prompt = "Eres un asistente de ingeniería para la empresa LETE. Tu tarea es redactar un resumen claro y conciso del objetivo de un proyecto para incluirlo en una cotización. El resumen debe seguir el formato: 'El objetivo de esta intervención es corregir [FALLA] en la [ZONA] para garantizar [BENEFICIO]'.

Aquí están los detalles del trabajo:
**Materiales a utilizar:**
$listaMateriales

**Tareas a realizar:**
$listaTareas

Basado en esta información, deduce la falla, la zona y el beneficio principal para el cliente. Responde únicamente con la frase del resumen, sin explicaciones ni texto adicional.";

        try {
            return $this->llamarGemini($prompt, 0.4);
        } catch (Exception $e) {
            error_log("Error en resumen de objetivo con Gemini: " . $e->getMessage());
            return ''; // Devolver vacío si la IA falla
        }
    }


    /**
     * Función auxiliar privada para hacer la llamada cURL (evita repetir código)
     */
    private function llamarGemini(string $prompt, float $temperature = 0.5): string {
        $data = [
            'contents' => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => [
                'temperature' => $temperature,
                'maxOutputTokens' => 8192,
            ]
        ];

        $ch = curl_init($this->apiUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error || $httpCode !== 200) {
            throw new Exception("Error API Gemini ($httpCode): " . ($error ?: $response));
        }

        $json = json_decode($response, true);
        return $json['candidates'][0]['content']['parts'][0]['text'] ?? '';
    }
}
?>

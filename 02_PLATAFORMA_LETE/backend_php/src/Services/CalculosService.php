<?php
declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';

class CalculosService {
    private PDO $db;
    private array $config;       // Configuración de costos (IVA, Indirectos, etc.)
    private array $globalConfig; // Configuración de anticipos
    private array $systemConfig; // Reglas de negocio (límites, bloqueos)

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->cargarConfiguracion();
        $this->cargarConfiguracionGlobal();
        $this->cargarConfiguracionSistema();
    }

    private function cargarConfiguracion(): void {
        $stmt = $this->db->query("SELECT clave, valor FROM configuracion");
        while ($row = $stmt->fetch()) {
            $this->config[$row['clave']] = floatval($row['valor']);
        }
    }

    private function cargarConfiguracionGlobal(): void {
        $stmt = $this->db->query("SELECT * FROM configuracion_global WHERE id = 1");
        $this->globalConfig = $stmt->fetch() ?: [];
    }

    private function cargarConfiguracionSistema(): void {
        try {
            $stmt = $this->db->query("SELECT clave, valor FROM configuracion_sistema");
            while ($row = $stmt->fetch()) {
                $this->systemConfig[$row['clave']] = floatval($row['valor']);
            }
        } catch (PDOException $e) {
            $this->systemConfig = [
                'limite_monto_auto' => 5000.00,
                'factor_rentabilidad_min' => 2.2,
                'limite_solo_mano_obra' => 2000.00
            ];
        }
    }

    // --- VALIDACIÓN DE REGLAS FINANCIERAS ---
    public function validarReglasFinancieras(array $totales): array {
        $razones = [];
        
        // 1. Regla de Monto Máximo Automático
        $limiteAuto = $this->systemConfig['limite_monto_auto'] ?? 5000.0;
        if ($totales['total_venta'] > $limiteAuto) {
            $razones[] = "Monto total ($" . number_format($totales['total_venta'], 2) . ") excede el límite automático de $" . number_format($limiteAuto, 2);
        }

        // 2. Regla de Rentabilidad
        if ($totales['materiales_cd'] > 0) {
            $factorRentabilidad = $totales['subtotal'] / $totales['materiales_cd'];
            $factorMin = $this->systemConfig['factor_rentabilidad_min'] ?? 2.2;
            
            if ($factorRentabilidad < $factorMin) {
                $razones[] = "Rentabilidad baja (Factor " . number_format($factorRentabilidad, 2) . "x). Mínimo requerido: " . $factorMin . "x costo material.";
            }
        }

        // 3. Regla de Solo Mano de Obra
        if ($totales['materiales_cd'] <= 0 && $totales['mano_obra_cd'] > 0) {
            $limiteMO = $this->systemConfig['limite_solo_mano_obra'] ?? 2000.0;
            if ($totales['total_venta'] > $limiteMO) {
                $razones[] = "Trabajo de solo Mano de Obra excede el límite de seguridad ($" . number_format($limiteMO, 2) . "). Requiere revisión.";
            }
        }

        return [
            'aprobado' => empty($razones),
            'razones' => implode(" | ", $razones)
        ];
    }

    // --- CÁLCULO DE COTIZACIÓN ---
    public function calcularCotizacion(array $items, array $manoDeObraItems, float $descuentoPct = 0.0): array {
        $totalMaterialesCD = 0.0;
        $itemsCalculados = [];

        // 1. CÁLCULO DE MATERIALES
        foreach ($items as $item) {
            $stmt = $this->db->prepare("SELECT * FROM recursos WHERE id = ?");
            $stmt->execute([$item['id_recurso']]);
            $recurso = $stmt->fetch();
            if (!$recurso) continue;

            $diasAntiguedad = (time() - strtotime($recurso['fecha_actualizacion_costo'])) / (60 * 60 * 24);
            $colchonPct = 0.0;
            if ($diasAntiguedad > 365) $colchonPct = $this->config['COLCHON_C'] ?? 6.0;
            elseif ($diasAntiguedad > 180) $colchonPct = $this->config['COLCHON_B'] ?? 3.0;
            elseif ($diasAntiguedad > 90) $colchonPct = $this->config['COLCHON_A'] ?? 1.5;

            $precioBase = floatval($recurso['precio_costo_base']);
            $precioConColchon = $precioBase * (1 + ($colchonPct / 100));
            $desperdicioPct = floatval($recurso['desperdicio_pct_default']);
            $cantidad = floatval($item['cantidad']);
            $costoItem = ($precioConColchon * $cantidad) * (1 + ($desperdicioPct / 100));
            $totalMaterialesCD += $costoItem;

            $itemsCalculados[] = [
                'id_recurso_ref' => $recurso['id'],
                'nombre' => $recurso['nombre'],
                'cantidad' => $cantidad,
                'precio_base_capturado' => $precioBase,
                'colchon_aplicado_pct' => $colchonPct,
                'precio_con_colchon' => $precioConColchon,
                'desperdicio_aplicado_pct' => $desperdicioPct,
                'costo_final_calculado' => $costoItem,
                'unidad' => $recurso['unidad']
            ];
        }

        // 2. CÁLCULO DE MANO DE OBRA
        $horasTecnicoTotal = 0.0;
        foreach ($manoDeObraItems as $tarea) {
            $horasTecnicoTotal += floatval($tarea['horas']);
        }
        
        $costoHoraTecnico = floatval($this->config['COSTO_HORA_TECNICO'] ?? 120.00); 
        $costoHoraSupervisor = floatval($this->config['COSTO_HORA_SUPERVISOR'] ?? 250.00); 
        
        $costoBaseTecnico = $horasTecnicoTotal * $costoHoraTecnico;
        $costoBaseSupervisor = ($horasTecnicoTotal * ($this->config['PCT_SUPERVISION'] / 100)) * $costoHoraSupervisor;
        
        $fasar = floatval($this->config['FASAR'] ?? 1.0);
        $totalManoObraCD = ($costoBaseTecnico + $costoBaseSupervisor) * $fasar;

        // 3. CÁLCULOS FINALES
        $costoHerramienta = $totalManoObraCD * ($this->config['PCT_HERRAMIENTA'] / 100);
        $costoVehiculo = $totalManoObraCD * ($this->config['PCT_VEHICULO'] / 100);
        $cdt = $totalMaterialesCD + $totalManoObraCD + $costoHerramienta + $costoVehiculo;
        $costoConIndirectos = $cdt * (1 + ($this->config['PCT_INDIRECTOS'] / 100));
        
        $subtotalBruto = $costoConIndirectos * (1 + ($this->config['PCT_UTILIDAD'] / 100));
        $montoDescuento = $subtotalBruto * ($descuentoPct / 100);
        $subtotalNeto = $subtotalBruto - $montoDescuento;

        $montoIVA = $subtotalNeto * ($this->config['PCT_IVA'] / 100);
        $precioFinal = $subtotalNeto + $montoIVA;

        // Distribución visual
        $factorMarkup = ($cdt > 0) ? ($subtotalNeto / $cdt) : 0;
        $materialesCliente = $totalMaterialesCD * $factorMarkup;
        $manoObraCliente = ($totalManoObraCD + $costoHerramienta + $costoVehiculo) * $factorMarkup;
        $manoObraCliente += ($subtotalNeto - ($materialesCliente + $manoObraCliente));

        // Lógica de Anticipo
        $pctBase = floatval($this->globalConfig['pct_anticipo_base'] ?? 60.0);
        $pctMoSeguro = floatval($this->globalConfig['pct_anticipo_mo_seguro'] ?? 30.0);
        
        $proporcionMateriales = ($subtotalNeto > 0) ? ($materialesCliente / $subtotalNeto) * 100 : 0;
        if ($proporcionMateriales < $pctBase) {
            $montoAnticipoFinal = $precioFinal * ($pctBase / 100);
        } else {
            $baseSegura = $materialesCliente + ($manoObraCliente * ($pctMoSeguro / 100));
            $montoAnticipoFinal = $baseSegura * (1 + ($this->config['PCT_IVA'] / 100));
        }

        return [
            'totales' => [
                'materiales_cd' => $totalMaterialesCD,
                'mano_obra_cd' => $totalManoObraCD,
                'materiales_cliente' => $materialesCliente,
                'mano_obra_cliente' => $manoObraCliente,
                'subtotal_bruto' => $subtotalBruto,
                'monto_descuento' => $montoDescuento,
                'subtotal' => $subtotalNeto,
                'iva' => $montoIVA,
                'total_venta' => $precioFinal,
                'anticipo_sugerido' => $montoAnticipoFinal,
                'horas_totales_calculadas' => $horasTecnicoTotal
            ],
            'desglose_items' => $itemsCalculados,
            'desglose_mo' => $manoDeObraItems
        ];
    }

    // --- GUARDAR COTIZACIÓN ---
    public function guardarCotizacion(
        array $resultadoCalculo,
        string $tecnicoId,
        string $tecnicoNombre,
        array $clienteData,
        string $estado = 'ENVIADA',
        ?string $razonDetencion = null,
        ?float $estimacionIA = null,
        ?int $caso_id = null,
        float $descuentoPct = 0.0
    ): array {
        try {
            $uuid = bin2hex(random_bytes(16));
            $totales = $resultadoCalculo['totales'];

            $sqlHeader = "INSERT INTO cotizaciones 
                (uuid, tecnico_id_externo, tecnico_nombre, cliente_nombre, cliente_email, cliente_telefono, direccion_obra,
                 horas_estimadas_tecnico, total_materiales_cd, total_mano_obra_cd, 
                 subtotal_venta, monto_iva, precio_venta_final, monto_anticipo, 
                 descuento_pct, estado, razon_detencion, estimacion_ia, caso_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $this->db->prepare($sqlHeader)->execute([
                $uuid, $tecnicoId, $tecnicoNombre, 
                $clienteData['nombre'], $clienteData['email'], 
                $clienteData['telefono'] ?? null, $clienteData['direccion'] ?? '',
                $totales['horas_totales_calculadas'],
                $totales['materiales_cd'], $totales['mano_obra_cd'],
                $totales['subtotal'], $totales['iva'], $totales['total_venta'], 
                $totales['anticipo_sugerido'], $descuentoPct,
                $estado, $razonDetencion, $estimacionIA, $caso_id
            ]);

            $cotizacionId = $this->db->lastInsertId();

            // Guardar items
            $stmtItem = $this->db->prepare("INSERT INTO cotizaciones_items 
                (cotizacion_id, recurso_id, cantidad, precio_base_capturado, colchon_aplicado_pct, 
                 precio_con_colchon, desperdicio_aplicado_pct, costo_final_calculado) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            
            foreach ($resultadoCalculo['desglose_items'] as $item) {
                $stmtItem->execute([
                    $cotizacionId, $item['id_recurso_ref'], $item['cantidad'], 
                    $item['precio_base_capturado'], $item['colchon_aplicado_pct'], 
                    $item['precio_con_colchon'], $item['desperdicio_aplicado_pct'], 
                    $item['costo_final_calculado']
                ]);
            }

            // Guardar mano de obra
            $stmtMO = $this->db->prepare("INSERT INTO cotizaciones_mano_de_obra 
                (cotizacion_id, descripcion, horas) VALUES (?, ?, ?)");
            
            foreach ($resultadoCalculo['desglose_mo'] as $tarea) {
                $stmtMO->execute([
                    $cotizacionId, 
                    $tarea['descripcion'], 
                    floatval($tarea['horas'])
                ]);
            }

            return ['uuid' => $uuid, 'cotizacionId' => $cotizacionId];

        } catch (Exception $e) {
            throw new Exception("Error durante el guardado de la cotización: " . $e->getMessage());
        }
    }

    // --- OBTENER COTIZACIÓN ---
    public function obtenerCotizacionPorUuid(string $uuid): ?array {
        $stmt = $this->db->prepare("SELECT * FROM cotizaciones WHERE uuid = ? LIMIT 1");
        $stmt->execute([$uuid]);
        $cotizacion = $stmt->fetch();
        if (!$cotizacion) return null;

        $sqlItems = "SELECT ci.*, r.nombre, r.unidad 
                     FROM cotizaciones_items ci 
                     JOIN recursos r ON ci.recurso_id = r.id 
                     WHERE ci.cotizacion_id = ?";
        $stmtItems = $this->db->prepare($sqlItems);
        $stmtItems->execute([$cotizacion['id']]);
        
        $sqlMO = "SELECT * FROM cotizaciones_mano_de_obra WHERE cotizacion_id = ?";
        $stmtMO = $this->db->prepare($sqlMO);
        $stmtMO->execute([$cotizacion['id']]);

        $this->cargarConfiguracionGlobal();

        return [
            'header' => $cotizacion, 
            'items_materiales' => $stmtItems->fetchAll(), 
            'items_mo' => $stmtMO->fetchAll(), 
            'global_config' => $this->globalConfig
        ];
    }

    // --- GESTIÓN DE RECURSOS ---
    public function obtenerRecursosActivos(): array {
        $sql = "SELECT id, nombre, unidad, precio_costo_base, tipo, tiempo_instalacion_min 
                FROM recursos WHERE activo = 1 AND estatus = 'APROBADO' ORDER BY nombre ASC";
        return $this->db->query($sql)->fetchAll();
    }

    public function obtenerInventarioTotal(): array {
        $sql = "SELECT r.*, mp.sku_proveedor, mp.fecha_ultimo_xml 
                FROM recursos r 
                LEFT JOIN materiales_proveedores mp ON r.id = mp.recurso_id 
                WHERE r.activo = 1 
                ORDER BY FIELD(r.estatus, 'PENDIENTE_TECNICO', 'APROBADO'), r.nombre ASC";
        return $this->db->query($sql)->fetchAll();
    }

    public function crearNuevoRecurso(string $nombre, string $unidad, float $precioTotal, string $estatus = 'PENDIENTE_TECNICO'): array {
        $ivaPct = $this->config['PCT_IVA'] ?? 16.0;
        $precioBase = $precioTotal / (1 + ($ivaPct / 100));

        $sql = "INSERT INTO recursos (nombre, unidad, tipo, precio_costo_base, estatus) 
                VALUES (?, ?, 'MATERIAL', ?, ?)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$nombre, $unidad, $precioBase, $estatus]);
        
        return [
            'id' => (int)$this->db->lastInsertId(), 
            'nombre' => $nombre, 
            'unidad' => $unidad, 
            'precio_costo_base' => $precioBase, 
            'tipo' => 'MATERIAL'
        ];
    }

    public function actualizarRecurso(int $id, string $nombre, float $precio, int $tiempo, string $unidad): void {
        $sql = "UPDATE recursos 
                SET nombre = ?, precio_costo_base = ?, tiempo_instalacion_min = ?,
                    unidad = ?, fecha_actualizacion_costo = NOW() 
                WHERE id = ?";
        $this->db->prepare($sql)->execute([$nombre, $precio, $tiempo, $unidad, $id]);
    }

    public function eliminarRecurso(int $id): void {
        $sql = "UPDATE recursos SET activo = 0 WHERE id = ?";
        $this->db->prepare($sql)->execute([$id]);
    }

    public function aprobarRecurso(int $id): void {
        $sql = "UPDATE recursos SET estatus = 'APROBADO' WHERE id = ?";
        $this->db->prepare($sql)->execute([$id]);
    }

    // --- LISTADO Y GESTIÓN DE COTIZACIONES ---
    public function obtenerListadoCotizaciones(): array {
        $sql = "SELECT id, uuid, tecnico_nombre, cliente_nombre, precio_venta_final, 
                       total_materiales_cd, descuento_pct, estimacion_ia, razon_detencion, 
                       estatus, estado, fecha_creacion, direccion_obra
                FROM cotizaciones 
                ORDER BY fecha_creacion DESC";
        return $this->db->query($sql)->fetchAll();
    }

    public function obtenerDetalleCotizacionPorId(int $id): ?array {
        $stmt = $this->db->prepare("SELECT * FROM cotizaciones WHERE id = ?");
        $stmt->execute([$id]);
        $header = $stmt->fetch();
        
        if (!$header) return null;

        $sqlMat = "SELECT ci.*, r.nombre, r.unidad, r.precio_costo_base 
                   FROM cotizaciones_items ci 
                   JOIN recursos r ON ci.recurso_id = r.id 
                   WHERE ci.cotizacion_id = ?";
        $stmtMat = $this->db->prepare($sqlMat);
        $stmtMat->execute([$id]);
        
        $sqlMO = "SELECT * FROM cotizaciones_mano_de_obra WHERE cotizacion_id = ?";
        $stmtMO = $this->db->prepare($sqlMO);
        $stmtMO->execute([$id]);

        return [
            'header' => $header,
            'materiales' => $stmtMat->fetchAll(),
            'mano_obra' => $stmtMO->fetchAll(),
            'config_sistema' => $this->config
        ];
    }

    // --- GESTIÓN DE ESTADOS ---
    public function actualizarEstadoCotizacion(int $id, string $nuevoEstado): void {
        $sql = "UPDATE cotizaciones SET estado = ? WHERE id = ?";
        $this->db->prepare($sql)->execute([$nuevoEstado, $id]);
    }

    public function obtenerDatosEnvio(int $id): array {
        $sql = "SELECT uuid, cliente_email, cliente_nombre FROM cotizaciones WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$id]);
        return $stmt->fetch() ?: [];
    }

    // --- RECÁLCULO CON DESCUENTO ---
    public function recalcularConDescuento(int $cotizacionId, float $descuentoPct): array {
        $itemsStmt = $this->db->prepare("SELECT recurso_id as id_recurso, cantidad 
                                          FROM cotizaciones_items WHERE cotizacion_id = ?");
        $itemsStmt->execute([$cotizacionId]);
        $items = $itemsStmt->fetchAll();

        $moStmt = $this->db->prepare("SELECT descripcion, horas 
                                       FROM cotizaciones_mano_de_obra WHERE cotizacion_id = ?");
        $moStmt->execute([$cotizacionId]);
        $manoDeObraItems = $moStmt->fetchAll();

        if (empty($manoDeObraItems)) {
            $cotiStmt = $this->db->prepare("SELECT horas_estimadas_tecnico 
                                             FROM cotizaciones WHERE id = ?");
            $cotiStmt->execute([$cotizacionId]);
            $horas = $cotiStmt->fetchColumn();
            $manoDeObraItems = [['descripcion' => 'Mano de Obra General', 'horas' => $horas ?: 0]];
        }

        $resultadoCalculo = $this->calcularCotizacion($items, $manoDeObraItems, $descuentoPct);
        $totales = $resultadoCalculo['totales'];

        $sql = "UPDATE cotizaciones 
                SET subtotal_venta = ?, monto_iva = ?, precio_venta_final = ?, 
                    monto_anticipo = ?, descuento_pct = ? 
                WHERE id = ?";
        $this->db->prepare($sql)->execute([
            $totales['subtotal'], $totales['iva'], $totales['total_venta'], 
            $totales['anticipo_sugerido'], $descuentoPct, $cotizacionId
        ]);

        $infoStmt = $this->db->prepare("SELECT uuid, cliente_email, cliente_nombre 
                                         FROM cotizaciones WHERE id = ?");
        $infoStmt->execute([$cotizacionId]);
        $info = $infoStmt->fetch();

        return [
            'uuid' => $info['uuid'], 
            'email' => $info['cliente_email'], 
            'nombre' => $info['cliente_nombre']
        ];
    }

    // --- CIERRE FINANCIERO ---
    public function finalizarProyecto(int $id, float $realMateriales, float $realManoObra): void {
        $sql = "UPDATE cotizaciones 
                SET estado = 'COMPLETADA', costo_real_materiales = ?, costo_real_mano_obra = ?
                WHERE id = ?";
        $this->db->prepare($sql)->execute([$realMateriales, $realManoObra, $id]);
    }

    // --- CLONACIÓN ---
    public function clonarCotizacion(int $idOriginal): array {
        try {
            $this->db->beginTransaction();

            $stmt = $this->db->prepare("SELECT * FROM cotizaciones WHERE id = ?");
            $stmt->execute([$idOriginal]);
            $original = $stmt->fetch();

            if (!$original) throw new Exception("Cotización original no encontrada.");

            $nuevoUuid = bin2hex(random_bytes(16));
            
            $sqlHeader = "INSERT INTO cotizaciones 
                (uuid, tecnico_id_externo, tecnico_nombre, cliente_nombre, cliente_email, direccion_obra, 
                 horas_estimadas_tecnico, total_materiales_cd, total_mano_obra_cd, 
                 subtotal_venta, monto_iva, precio_venta_final, monto_anticipo, descuento_pct,
                 estado, version_padre_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ENVIADA', ?)";
            
            $this->db->prepare($sqlHeader)->execute([
                $nuevoUuid, 
                $original['tecnico_id_externo'], 
                $original['tecnico_nombre'], 
                $original['cliente_nombre'], 
                $original['cliente_email'], 
                $original['direccion_obra'],
                $original['horas_estimadas_tecnico'],
                $original['total_materiales_cd'],
                $original['total_mano_obra_cd'],
                $original['subtotal_venta'],
                $original['monto_iva'],
                $original['precio_venta_final'],
                $original['monto_anticipo'],
                $original['descuento_pct'],
                $idOriginal 
            ]);
            
            $nuevoId = $this->db->lastInsertId();

            // Clonar items
            $stmtItems = $this->db->prepare("SELECT * FROM cotizaciones_items WHERE cotizacion_id = ?");
            $stmtItems->execute([$idOriginal]);
            $items = $stmtItems->fetchAll();

            $sqlInsertItem = "INSERT INTO cotizaciones_items 
                (cotizacion_id, recurso_id, cantidad, precio_base_capturado, colchon_aplicado_pct, 
                 precio_con_colchon, desperdicio_aplicado_pct, costo_final_calculado) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            $stmtNewItem = $this->db->prepare($sqlInsertItem);

            foreach ($items as $item) {
                $stmtNewItem->execute([
                    $nuevoId, $item['recurso_id'], $item['cantidad'],
                    $item['precio_base_capturado'], $item['colchon_aplicado_pct'],
                    $item['precio_con_colchon'], $item['desperdicio_aplicado_pct'],
                    $item['costo_final_calculado']
                ]);
            }

            // Clonar mano de obra
            $stmtMO = $this->db->prepare("SELECT * FROM cotizaciones_mano_de_obra WHERE cotizacion_id = ?");
            $stmtMO->execute([$idOriginal]);
            $tareas = $stmtMO->fetchAll();

            $sqlInsertMO = "INSERT INTO cotizaciones_mano_de_obra 
                (cotizacion_id, descripcion, horas) VALUES (?, ?, ?)";
            $stmtNewMO = $this->db->prepare($sqlInsertMO);

            foreach ($tareas as $t) {
                $stmtNewMO->execute([$nuevoId, $t['descripcion'], $t['horas']]);
            }

            $this->db->commit();

            return [
                'id' => $nuevoId,
                'uuid' => $nuevoUuid,
                'mensaje' => "Clonada exitosamente. Nueva versión: #$nuevoId"
            ];

        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function powerCloneCotizacion(int $idOriginal, array $nuevosItems, array $nuevaMO, string $clienteEmail, string $clienteNombre): array {
        $this->db->beginTransaction();
        try {
            $stmtOriginal = $this->db->prepare("SELECT * FROM cotizaciones WHERE id = ?");
            $stmtOriginal->execute([$idOriginal]);
            $originalData = $stmtOriginal->fetch(PDO::FETCH_ASSOC);

            if (!$originalData) {
                throw new Exception("Cotización original no encontrada.");
            }

            $descuentoOriginal = floatval($originalData['descuento_pct'] ?? 0.0);
            $resultado = $this->calcularCotizacion($nuevosItems, $nuevaMO, $descuentoOriginal);

            $guardadoResult = $this->guardarCotizacion(
                $resultado,
                $originalData['tecnico_id_externo'],
                $originalData['tecnico_nombre'],
                ['email' => $clienteEmail, 'nombre' => $clienteNombre, 'direccion' => '', 'telefono' => null],
                'ENVIADA',
                null,
                null,
                $idOriginal,
                $descuentoOriginal
            );

            $this->db->commit();

            return [
                'id' => $guardadoResult['cotizacionId'],
                'uuid' => $guardadoResult['uuid'],
                'mensaje' => "Clonada exitosamente. Nueva versión creada."
            ];

        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // --- EDICIÓN DE CONTENIDO ---
    public function actualizarContenidoCotizacion(int $id, array $nuevosItems, array $nuevaMO, string $clienteEmail, string $clienteNombre): void {
        try {
            $this->db->beginTransaction();

            $resultado = $this->calcularCotizacion($nuevosItems, $nuevaMO);
            $totales = $resultado['totales'];

            $sqlHeader = "UPDATE cotizaciones SET 
                cliente_email = ?, cliente_nombre = ?, horas_estimadas_tecnico = ?,
                total_materiales_cd = ?, total_mano_obra_cd = ?, subtotal_venta = ?, 
                monto_iva = ?, precio_venta_final = ?, monto_anticipo = ?,
                estado = 'ENVIADA', razon_detencion = NULL, estimacion_ia = NULL
                WHERE id = ?";
            
            $this->db->prepare($sqlHeader)->execute([
                $clienteEmail, $clienteNombre,
                $totales['horas_totales_calculadas'], 
                $totales['materiales_cd'], $totales['mano_obra_cd'], 
                $totales['subtotal'], $totales['iva'], $totales['total_venta'], 
                $totales['anticipo_sugerido'], $id
            ]);

            // Borrar items viejos
            $this->db->prepare("DELETE FROM cotizaciones_items WHERE cotizacion_id = ?")->execute([$id]);
            $this->db->prepare("DELETE FROM cotizaciones_mano_de_obra WHERE cotizacion_id = ?")->execute([$id]);

            // Insertar nuevos items
            $stmtItem = $this->db->prepare("INSERT INTO cotizaciones_items 
                (cotizacion_id, recurso_id, cantidad, precio_base_capturado, colchon_aplicado_pct, 
                 precio_con_colchon, desperdicio_aplicado_pct, costo_final_calculado) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            
            foreach ($resultado['desglose_items'] as $item) {
                $stmtItem->execute([
                    $id, $item['id_recurso_ref'], $item['cantidad'], 
                    $item['precio_base_capturado'], $item['colchon_aplicado_pct'],
                    $item['precio_con_colchon'], $item['desperdicio_aplicado_pct'], 
                    $item['costo_final_calculado']
                ]);
            }

            // Insertar nueva MO
            $stmtMO = $this->db->prepare("INSERT INTO cotizaciones_mano_de_obra 
                (cotizacion_id, descripcion, horas) VALUES (?, ?, ?)");
            
            foreach ($resultado['desglose_mo'] as $tarea) {
                $stmtMO->execute([$id, $tarea['descripcion'], floatval($tarea['horas'])]);
            }

            $this->db->commit();

        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // --- UTILIDADES ---
    public function obtenerListaMaterialesExportar(int $cotizacionId): string {
        $sql = "SELECT ci.cantidad, r.unidad, r.nombre 
                FROM cotizaciones_items ci
                JOIN recursos r ON ci.recurso_id = r.id
                WHERE ci.cotizacion_id = ?
                ORDER BY r.nombre ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([$cotizacionId]);
        $items = $stmt->fetchAll();
        
        if (empty($items)) return "Esta cotización no tiene materiales registrados.";

        $texto = "LISTA DE MATERIALES - Cotización #" . $cotizacionId . "\n";
        $texto .= "===========================================\n\n";
        foreach ($items as $item) {
            $texto .= floatval($item['cantidad']) . " " . $item['unidad'] . " - " . $item['nombre'] . "\n";
        }
        return $texto;
    }

    public function actualizarUrlPdf(string $uuid, string $pdfUrl): void {
        try {
            $sql = "UPDATE cotizaciones SET pdf_url = ? WHERE uuid = ?";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$pdfUrl, $uuid]);
        } catch (PDOException $e) {
            error_log("Error al actualizar la URL del PDF para UUID $uuid: " . $e->getMessage());
        }
    }

    public function obtenerNombreUsuarioPorId(string $userId): ?string {
        try {
            // Se intenta obtener el nombre de la tabla local 'users'. 
            // Si la arquitectura separa DBs, esto podría fallar, por lo que el catch lo maneja.
            $sql = "SELECT nombre FROM ea_users WHERE id_externo = ? LIMIT 1";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$userId]);
            $resultado = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($resultado && !empty($resultado['nombre'])) {
                return $resultado['nombre'];
            }
            return null;
        } catch (PDOException $e) {
            error_log("Error al obtener nombre de usuario por ID ($userId): " . $e->getMessage());
            return null;
        }
    }

    public function contarCotizacionesPorCaso(string $tecnicoId): array {
        $sql = "SELECT version_padre_id AS caso_id, COUNT(*) AS cot_count
                FROM cotizaciones
                WHERE tecnico_id_externo = ? AND version_padre_id IS NOT NULL
                GROUP BY version_padre_id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([$tecnicoId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function obtenerRevisionCompletaPorId(int $revisionId): ?array {
        try {
            $sqlHeader = "SELECT r.id, r.fecha_creacion as fecha_revision,
                            c.cliente_nombre, c.cliente_direccion, c.cliente_email,
                            u.nombre as tecnico_nombre, r.firma_cliente_base64 as firma_base64
                          FROM revisiones r
                          LEFT JOIN casos c ON r.caso_id = c.id
                          LEFT JOIN users u ON r.tecnico_id = u.id_externo
                          WHERE r.id = ?";
            $stmtHeader = $this->db->prepare($sqlHeader);
            $stmtHeader->execute([$revisionId]);
            $header = $stmtHeader->fetch(PDO::FETCH_ASSOC);
            
            if (!$header) return null;

            $sqlMediciones = "SELECT * FROM revisiones_mediciones WHERE revision_id = ?";
            $stmtMediciones = $this->db->prepare($sqlMediciones);
            $stmtMediciones->execute([$revisionId]);
            $mediciones = $stmtMediciones->fetch(PDO::FETCH_ASSOC);

            $sqlEquipos = "SELECT * FROM revisiones_equipos WHERE revision_id = ?";
            $stmtEquipos = $this->db->prepare($sqlEquipos);
            $stmtEquipos->execute([$revisionId]);
            $equipos = $stmtEquipos->fetchAll(PDO::FETCH_ASSOC);

            $sqlCausas = "SELECT causa FROM revisiones_causas_alto_consumo WHERE revision_id = ?";
            $stmtCausas = $this->db->prepare($sqlCausas);
            $stmtCausas->execute([$revisionId]);
            $causas = $stmtCausas->fetchAll(PDO::FETCH_COLUMN);

            $sqlRecomendaciones = "SELECT recomendaciones FROM revisiones_recomendaciones WHERE revision_id = ?";
            $stmtRecomendaciones = $this->db->prepare($sqlRecomendaciones);
            $stmtRecomendaciones->execute([$revisionId]);
            $recomendaciones = $stmtRecomendaciones->fetchColumn();

            return [
                'header' => $header,
                'mediciones' => $mediciones,
                'equipos' => $equipos,
                'causas_alto_consumo' => $causas,
                'recomendaciones_tecnico' => $recomendaciones,
                'firma_base64' => $header['firma_base64'] ?? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
            ];
        } catch (PDOException $e) {
            error_log("Error en obtenerRevisionCompletaPorId: " . $e->getMessage());
            return null;
        }
    }
}
?>
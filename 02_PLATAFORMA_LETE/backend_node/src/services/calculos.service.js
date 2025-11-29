const getMultiplicador = (nombre_equipo, estado_equipo) => {
  let multiplicador = 1.0;
  // Lista de equipos donde el estado afecta drásticamente el consumo
  const equiposSensibles = ['Refrigerador', 'Aire Acondicionado', 'Congelador', 'Minisplit'];

  if (equiposSensibles.includes(nombre_equipo)) {
    if (estado_equipo === 'Regular') multiplicador = 1.25;
    else if (estado_equipo === 'Malo') multiplicador = 1.50;
  }
  return multiplicador;
};

const getDutyCycle = (nombre_equipo) => {
  // Porcentaje de tiempo que el compresor/motor está realmente encendido
  const dutyCycles = {
    'Refrigerador': 0.45,
    'Aire acondicionado': 0.50, // Ajustado para climas cálidos
    'Aire acondicionado inverter': 0.35,
    'Bomba periferica': 0.8, // Las bombas suelen usarse continuo cuando se prenden
    'Bomba presurizadora': 0.2, // Solo prende cuando abren grifo
    'Lavadora': 0.6,
    'Secadora': 0.8,
  };
  // Si no está en la lista, asumimos que usa energía todo el tiempo que se reporta (ej. Focos, TV)
  return dutyCycles[nombre_equipo] || 1.0;
};

const normalizarHorasBimestre = (tiempo_uso, unidad_tiempo) => {
  const t = parseFloat(tiempo_uso) || 0;
  if (unidad_tiempo === 'Horas/Día') return t * 60; // 60 días al bimestre
  if (unidad_tiempo === 'Horas/Semana') return (t / 7) * 60;
  return 0;
};

// ---------------------------------------------------------
// 1. CÁLCULO DE EQUIPOS (Consumo)
// ---------------------------------------------------------
export const calcularConsumoEquipos = (equiposData, voltaje) => {
  if (!equiposData || equiposData.length === 0 || !voltaje) {
    return [];
  }

  return equiposData.map(equipo => {
    const { nombre_equipo, estado_equipo, tiempo_uso, unidad_tiempo, amperaje_medido } = equipo;

    const multiplicadorEstado = getMultiplicador(nombre_equipo, estado_equipo);
    const dutyCycle = getDutyCycle(nombre_equipo);
    const horas_bimestre = normalizarHorasBimestre(tiempo_uso, unidad_tiempo);

    const Potencia_W = voltaje * (parseFloat(amperaje_medido) || 0);
    const Consumo_Base_kWh = (Potencia_W * horas_bimestre) / 1000;

    // Fórmula Final: Base * Estado * Ciclo de Trabajo
    const kwh_bimestre_calculado = Consumo_Base_kWh * multiplicadorEstado * dutyCycle;

    return {
      ...equipo,
      kwh_bimestre_calculado: parseFloat(kwh_bimestre_calculado.toFixed(2))
    };
  });
};

// ---------------------------------------------------------
// 2. DETECCIÓN DE FUGAS (Lógica de Texto / Alerta)
// ---------------------------------------------------------
export const detectarFugas = (revisionData) => {
  const {
    se_puede_apagar_todo,
    corriente_fuga_f1, corriente_fuga_f2, corriente_fuga_f3, // Estos pueden venir del switch multifase
    corriente_red_f1, corriente_red_f2, corriente_red_f3, corriente_red_n
  } = revisionData;

  // CASO A: Apagaron todo (Medición más fiable)
  if (se_puede_apagar_todo === true || se_puede_apagar_todo === 'true') {
    // Aquí sumamos todo lo que marca la pinza (sea en 1 fase o en 3)
    const fuga_total = (parseFloat(corriente_fuga_f1) || 0) +
      (parseFloat(corriente_fuga_f2) || 0) +
      (parseFloat(corriente_fuga_f3) || 0);

    if (fuga_total > 0.05) {
      return `FUGA CRÍTICA DETECTADA: Al bajar interruptores, la pinza siguió marcando ${fuga_total.toFixed(2)}A. Revise cableado oculto.`;
    }
  }

  // CASO B: Medición con carga (Balance de Kirchhoff: Lo que entra - Lo que sale)
  const f1 = parseFloat(corriente_red_f1) || 0;
  const f2 = parseFloat(corriente_red_f2) || 0;
  const f3 = parseFloat(corriente_red_f3) || 0;
  const neutro = parseFloat(corriente_red_n) || 0;

  const corriente_entrante = f1 + f2 + f3; // Suma aritmética (Regla de dedo para auditoría)
  const diferencia = Math.abs(corriente_entrante - neutro);

  // Umbral de 0.2A para evitar falsos positivos por imprecisión de pinza
  if (diferencia > 0.20) {
    return `POSIBLE FUGA DE CORRIENTE: Existe un desbalance de ${diferencia.toFixed(2)}A entre las fases y el neutro que no retorna correctamente.`;
  }

  return null;
};

// ---------------------------------------------------------
// 3. VERIFICACIÓN SOLAR
// ---------------------------------------------------------
export const verificarSolar = (revisionData) => {
  const {
    paneles_antiguedad_anos, cantidad_paneles, watts_por_panel,
    corriente_paneles_f1, corriente_paneles_f2, corriente_paneles_f3, voltaje_medido
  } = revisionData;

  // Validación corregida: No dependemos del nombre "Paneles", sino de los datos
  const tieneDatosPaneles = (cantidad_paneles > 0 && watts_por_panel > 0);

  if (!tieneDatosPaneles) {
    return null;
  }

  const A = parseFloat(paneles_antiguedad_anos) || 0;

  // Tabla de degradación estándar
  let factor_degradacion = 1.0;
  if (A >= 1) {
    // Pierden aprox 0.5% a 0.7% anual + degradación inicial
    factor_degradacion = 1.0 - (0.025 + ((A - 1) * 0.007));
  }

  const potencia_instalada_W = cantidad_paneles * watts_por_panel;

  // 0.75 es un factor conservador de "Performance Ratio" (Calor, suciedad, inversor, pérdidas DC/AC)
  const potencia_esperada_W = (potencia_instalada_W * factor_degradacion) * 0.75;

  const iTotalPaneles = (parseFloat(corriente_paneles_f1) || 0) +
    (parseFloat(corriente_paneles_f2) || 0) +
    (parseFloat(corriente_paneles_f3) || 0);

  const potencia_medida_W = iTotalPaneles * (parseFloat(voltaje_medido) || 127);

  // Evitamos división por cero
  if (potencia_esperada_W <= 0) return null;

  const eficiencia_relativa = potencia_medida_W / potencia_esperada_W;

  // Si produce menos del 80% de lo esperado (considerando ya el factor 0.75)
  if (eficiencia_relativa < 0.8) {
    return `RENDIMIENTO SOLAR BAJO: Generando ${potencia_medida_W.toFixed(0)}W vs Esperado ${potencia_esperada_W.toFixed(0)}W. Posible suciedad, sombra o fallo de inversor.`;
  }

  return null;
};

// ---------------------------------------------------------
// 4. DIAGNÓSTICOS AUTOMÁTICOS (Texto)
// ---------------------------------------------------------
export const generarDiagnosticosAutomaticos = (revisionData, equiposCalculados, externos = {}) => {
  // externos recibe: { deteccionFugas: string, verificarSolar: string }
  const { tipo_medidor, edad_instalacion, capacidad_vs_calibre } = revisionData;
  const diagnosticos = [];

  // Agregamos los diagnósticos externos si existen
  if (externos.deteccionFugas) diagnosticos.push(externos.deteccionFugas);
  if (externos.verificarSolar) diagnosticos.push(externos.verificarSolar);

  if (tipo_medidor === 'Digital') {
    diagnosticos.push("Nota Técnica: El medidor digital registra con alta precisión picos de arranque que los medidores antiguos ignoraban.");
  }

  if (edad_instalacion === '30+ años' || edad_instalacion === '20-30 años') {
    diagnosticos.push("Obsolescencia: Su instalación eléctrica supera los 20 años de vida útil, lo que incrementa el riesgo de fugas por aislamiento tostado.");
  }

  if (capacidad_vs_calibre === false || capacidad_vs_calibre === 'false') {
    diagnosticos.push("RIESGO DE SEGURIDAD: El cableado detectado es muy delgado para la protección instalada. Riesgo inminente de sobrecalentamiento.");
  }

  equiposCalculados.forEach(equipo => {
    if (equipo.estado_equipo === 'Malo') {
      const nombre = equipo.nombre_personalizado || equipo.nombre_equipo;
      diagnosticos.push(`Ineficiencia: El equipo "${nombre}" opera en malas condiciones, generando un sobrecosto estimado en su factura.`);
    }
  });

  return diagnosticos;
};
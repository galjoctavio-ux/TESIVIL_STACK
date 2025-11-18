<?php

return [
    // --- BLOQUE A: COTIZADOR BÁSICO ---
    ['method' => 'POST', 'uri' => '/api/cotizar', 'controller' => 'CotizacionController', 'action' => 'crearCotizacion'],
    ['method' => 'POST', 'uri' => '/api/cotizar/guardar', 'controller' => 'CotizacionController', 'action' => 'guardarCotizacion'],
    ['method' => 'GET', 'uri' => '/api/cotizar/pdf', 'controller' => 'PdfController', 'action' => 'generarPdfFromUuid'],

    // --- BLOQUE B: RECURSOS E INVENTARIO ---
    ['method' => 'GET', 'uri' => '/api/recursos', 'controller' => 'CotizacionController', 'action' => 'listarRecursos'],
    ['method' => 'POST', 'uri' => '/api/recursos', 'controller' => 'CotizacionController', 'action' => 'nuevoRecurso'],
    ['method' => 'POST', 'uri' => '/api/xml/upload', 'controller' => 'XmlController', 'action' => 'subirXml'],
    ['method' => 'GET', 'uri' => '/api/admin/pendientes', 'controller' => 'XmlController', 'action' => 'listarPendientes'],
    ['method' => 'POST', 'uri' => '/api/admin/vincular', 'controller' => 'XmlController', 'action' => 'vincular'],
    ['method' => 'POST', 'uri' => '/api/recursos/editar', 'controller' => 'CotizacionController', 'action' => 'editarRecurso'],
    ['method' => 'POST', 'uri' => '/api/recursos/eliminar', 'controller' => 'CotizacionController', 'action' => 'eliminarRecurso'],
    ['method' => 'GET', 'uri' => '/api/admin/inventario', 'controller' => 'CotizacionController', 'action' => 'listarInventarioAdmin'],
    ['method' => 'POST', 'uri' => '/api/recursos/aprobar', 'controller' => 'CotizacionController', 'action' => 'aprobarRecurso'],

    // --- BLOQUE C: INTELIGENCIA ARTIFICIAL ---
    ['method' => 'POST', 'uri' => '/api/ia/sugerir', 'controller' => 'AiController', 'action' => 'sugerirMateriales'],
    ['method' => 'GET', 'uri' => '/api/admin/auditoria-inventario', 'controller' => 'AiController', 'action' => 'auditarInventario'],

    // --- BLOQUE D: ADMINISTRACIÓN DE COTIZACIONES ---
    ['method' => 'GET', 'uri' => '/api/cotizaciones/counts', 'controller' => 'CotizacionController', 'action' => 'obtenerConteosPorTecnico'],
    // Ruta parametrizada: se manejará con una expresión regular en el router principal.
    ['method' => 'POST', 'uri' => '/^\/api\/cotizaciones\/authorize\/(\d+)$/', 'controller' => 'CotizacionController', 'action' => 'authorize'],
    ['method' => 'GET', 'uri' => '/api/admin/cotizaciones', 'controller' => 'CotizacionController', 'action' => 'listarCotizacionesAdmin'],
    ['method' => 'GET', 'uri' => '/api/cotizacion/exportar', 'controller' => 'CotizacionController', 'action' => 'exportarMaterialesTxt'],
    ['method' => 'POST', 'uri' => '/api/cotizacion/aplicar-descuento', 'controller' => 'CotizacionController', 'action' => 'aplicarDescuento'],
    ['method' => 'POST', 'uri' => '/api/admin/cotizacion/autorizar', 'controller' => 'CotizacionController', 'action' => 'autorizarCotizacion'],
    ['method' => 'POST', 'uri' => '/api/admin/cotizacion/rechazar', 'controller' => 'CotizacionController', 'action' => 'rechazarCotizacion'],
    ['method' => 'POST', 'uri' => '/api/admin/cotizacion/finalizar', 'controller' => 'CotizacionController', 'action' => 'finalizarProyecto'],
    ['method' => 'POST', 'uri' => '/api/admin/cotizacion/clonar', 'controller' => 'CotizacionController', 'action' => 'clonarCotizacion'],
    ['method' => 'POST', 'uri' => '/api/admin/cotizacion/powerclone', 'controller' => 'CotizacionController', 'action' => 'powerCloneCotizacion'],
    ['method' => 'POST', 'uri' => '/api/admin/cotizacion/reenviar', 'controller' => 'CotizacionController', 'action' => 'reenviarCorreo'],
    ['method' => 'GET', 'uri' => '/api/admin/cotizacion/detalle', 'controller' => 'CotizacionController', 'action' => 'obtenerDetalleEdicion'],
    ['method' => 'POST', 'uri' => '/api/admin/cotizacion/guardar-cambios', 'controller' => 'CotizacionController', 'action' => 'actualizarCotizacion'],

    // --- BLOQUE E: CONFIGURACIÓN FINANCIERA ---
    ['method' => 'GET', 'uri' => '/api/admin/configuracion', 'controller' => 'ConfigController', 'action' => 'listarConfiguracion'],
    ['method' => 'POST', 'uri' => '/api/admin/configuracion/actualizar', 'controller' => 'ConfigController', 'action' => 'actualizarConfiguracion'],

    // --- BLOQUE F: REVISIONES ---
    ['method' => 'POST', 'uri' => '/api/revisiones/generar_pdf_final', 'controller' => 'RevisionPdfController', 'action' => 'generarPdfFinalDesdeRevision'],

];

'use strict';

/**
 * Version visible de la aplicacion.
 * Se muestra en el HTML del portal y en el endpoint /health,
 * de modo que la evidencia del despliegue sea verificable a simple vista.
 */
const APP_VERSION = '1.0.0';
const APP_NAME = 'NovaTech - Portal de Pedidos';

module.exports = { APP_VERSION, APP_NAME };

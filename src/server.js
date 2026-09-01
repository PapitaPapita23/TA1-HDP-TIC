'use strict';

const { crearApp } = require('./app');
const { APP_NAME, APP_VERSION } = require('./version');

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

const app = crearApp();

const server = app.listen(PORT, HOST, () => {
  console.log(`[novatech] ${APP_NAME} v${APP_VERSION} escuchando en http://${HOST}:${PORT}`);
});

// Apagado ordenado: necesario para que "docker stop" no corte peticiones en curso.
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, () => {
    console.log(`[novatech] ${senal} recibido, cerrando servidor...`);
    server.close(() => process.exit(0));
  });
}

module.exports = server;

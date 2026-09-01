'use strict';

const express = require('express');

const { APP_NAME, APP_VERSION } = require('./version');
const { listarPedidos, buscarPedido } = require('./data');
const { formatearPedido, calcularMontoCartera, formatearMoneda } = require('./pedidos');
const { renderPortal } = require('./views');

/**
 * Construye la aplicacion Express.
 * Se exporta la app (sin listen) para que las pruebas la levanten con supertest.
 */
function crearApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  // Portal HTML: tabla de pedidos + version visible.
  app.get('/', (req, res) => {
    const pedidos = listarPedidos().map(formatearPedido);
    const cartera = formatearMoneda(calcularMontoCartera(listarPedidos()));
    res.type('html').send(renderPortal(pedidos, cartera));
  });

  // Endpoint de salud usado por el healthcheck del deploy y por Docker.
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      app: APP_NAME,
      version: APP_VERSION,
      uptime: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString()
    });
  });

  // API: listado de pedidos formateados.
  app.get('/api/pedidos', (req, res) => {
    const pedidos = listarPedidos().map(formatearPedido);
    res.json({
      version: APP_VERSION,
      cantidad: pedidos.length,
      montoCartera: calcularMontoCartera(listarPedidos()),
      pedidos
    });
  });

  // API: detalle de un pedido por codigo.
  app.get('/api/pedidos/:codigo', (req, res) => {
    const pedido = buscarPedido(req.params.codigo);
    if (!pedido) {
      return res.status(404).json({ error: 'Pedido no encontrado', codigo: req.params.codigo });
    }
    return res.json(formatearPedido(pedido));
  });

  // 404 para cualquier otra ruta.
  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada', ruta: req.originalUrl });
  });

  // Manejador de errores: evita filtrar stack traces al cliente.
  app.use((err, req, res, next) => {
    console.error('[error]', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

module.exports = { crearApp };

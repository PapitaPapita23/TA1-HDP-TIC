'use strict';

/**
 * Suite 3: endpoints HTTP.
 * El endpoint /health es el que consulta scripts/deploy.sh y el HEALTHCHECK
 * de Docker; si deja de responder, el despliegue debe considerarse fallido.
 */

const request = require('supertest');
const { crearApp } = require('../src/app');
const { APP_VERSION } = require('../src/version');

const app = crearApp();

describe('GET /health', () => {
  test('responde 200 con status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('reporta la version desplegada', async () => {
    const res = await request(app).get('/health');
    expect(res.body.version).toBe(APP_VERSION);
    expect(res.body.app).toBe('NovaTech - Portal de Pedidos');
  });

  test('devuelve JSON con uptime y timestamp validos', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(typeof res.body.uptime).toBe('number');
    expect(Number.isNaN(Date.parse(res.body.timestamp))).toBe(false);
  });
});

describe('GET /', () => {
  test('sirve el portal HTML', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  test('muestra la version visible v1.0.0 en el HTML', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain(`v${APP_VERSION}`);
    expect(res.text).toContain('id="app-version"');
  });

  test('lista los pedidos con sus columnas de negocio', async () => {
    const res = await request(app).get('/');
    expect(res.text).toContain('PED-0001');
    expect(res.text).toContain('Comercial Andina S.A.C.');
    expect(res.text).toContain('S/ 9,750.00');
    expect(res.text).toContain('Entregado');
  });
});

describe('GET /api/pedidos', () => {
  test('devuelve la coleccion completa de pedidos', async () => {
    const res = await request(app).get('/api/pedidos');
    expect(res.status).toBe(200);
    expect(res.body.cantidad).toBe(5);
    expect(res.body.pedidos).toHaveLength(5);
    expect(res.body.version).toBe(APP_VERSION);
  });

  test('cada pedido trae total calculado', async () => {
    const res = await request(app).get('/api/pedidos');
    const primero = res.body.pedidos[0];
    expect(primero.codigo).toBe('PED-0001');
    expect(primero.total).toBe(9750);
    expect(primero.totalFmt).toBe('S/ 9,750.00');
  });
});

describe('GET /api/pedidos/:codigo', () => {
  test('devuelve el detalle de un pedido existente', async () => {
    const res = await request(app).get('/api/pedidos/PED-0003');
    expect(res.status).toBe(200);
    expect(res.body.cliente).toBe('Textiles del Sur S.A.');
    expect(res.body.total).toBe(2901);
  });

  test('responde 404 si el pedido no existe', async () => {
    const res = await request(app).get('/api/pedidos/PED-9999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Pedido no encontrado');
  });
});

describe('rutas desconocidas', () => {
  test('responden 404 en JSON', async () => {
    const res = await request(app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Ruta no encontrada');
  });
});

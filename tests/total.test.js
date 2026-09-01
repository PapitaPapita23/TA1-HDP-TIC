'use strict';

/**
 * Suite 1: calculo del total.
 * Es la regla de negocio mas sensible del portal: si falla,
 * NovaTech factura montos incorrectos.
 */

const {
  calcularTotal,
  calcularMontoCartera,
  redondear2
} = require('../src/pedidos');
const { listarPedidos } = require('../src/data');

describe('calcularTotal()', () => {
  test('multiplica cantidad por precio unitario', () => {
    expect(calcularTotal(3, 3250.0)).toBe(9750.0);
  });

  test('resuelve correctamente montos con decimales', () => {
    expect(calcularTotal(8, 899.9)).toBe(7199.2);
  });

  test('redondea a 2 decimales evitando errores de punto flotante', () => {
    // 3 * 0.1 en coma flotante da 0.30000000000000004
    expect(calcularTotal(3, 0.1)).toBe(0.3);
    expect(calcularTotal(7, 10.005)).toBe(70.04);
  });

  test('acepta precio unitario cero (producto de cortesia)', () => {
    expect(calcularTotal(5, 0)).toBe(0);
  });

  test('rechaza cantidades no enteras o menores o iguales a cero', () => {
    expect(() => calcularTotal(0, 100)).toThrow(TypeError);
    expect(() => calcularTotal(-2, 100)).toThrow(TypeError);
    expect(() => calcularTotal(1.5, 100)).toThrow(TypeError);
    expect(() => calcularTotal('3', 100)).toThrow(TypeError);
  });

  test('rechaza precios invalidos', () => {
    expect(() => calcularTotal(2, -10)).toThrow(TypeError);
    expect(() => calcularTotal(2, NaN)).toThrow(TypeError);
    expect(() => calcularTotal(2, '100')).toThrow(TypeError);
  });
});

describe('redondear2()', () => {
  test('redondea hacia arriba en el limite', () => {
    expect(redondear2(2.345)).toBe(2.35);
    expect(redondear2(0.1 + 0.2)).toBe(0.3);
  });
});

describe('calcularMontoCartera()', () => {
  test('suma los totales excluyendo pedidos cancelados', () => {
    const pedidos = [
      { cantidad: 2, precioUnitario: 100, estado: 'ENTREGADO' },
      { cantidad: 1, precioUnitario: 50.5, estado: 'PENDIENTE' },
      { cantidad: 10, precioUnitario: 999, estado: 'CANCELADO' }
    ];
    expect(calcularMontoCartera(pedidos)).toBe(250.5);
  });

  test('calcula la cartera real del catalogo de la PoC', () => {
    // 9750 + 7199.20 + 2901 + 12800.75 = 32650.95 (PED-0005 esta CANCELADO)
    expect(calcularMontoCartera(listarPedidos())).toBe(32650.95);
  });

  test('devuelve 0 cuando no hay pedidos', () => {
    expect(calcularMontoCartera([])).toBe(0);
  });

  test('rechaza entradas que no son arreglo', () => {
    expect(() => calcularMontoCartera(null)).toThrow(TypeError);
  });
});

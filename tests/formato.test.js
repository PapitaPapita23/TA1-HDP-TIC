'use strict';

/**
 * Suite 2: formato del pedido.
 * Valida el contrato de datos que consumen el portal HTML y la API:
 * codigo PED-0000, estados del catalogo y moneda "S/ 0,000.00".
 */

const {
  formatearPedido,
  formatearMoneda,
  esCodigoValido,
  esEstadoValido,
  ESTADOS_VALIDOS
} = require('../src/pedidos');
const { listarPedidos } = require('../src/data');

const PEDIDO_BASE = {
  codigo: 'PED-0007',
  cliente: 'Comercial Andina S.A.C.',
  producto: 'Laptop Nova Pro 14"',
  cantidad: 4,
  precioUnitario: 1250.5,
  estado: 'ENVIADO'
};

describe('esCodigoValido()', () => {
  test('acepta el formato oficial PED-0000', () => {
    expect(esCodigoValido('PED-0001')).toBe(true);
    expect(esCodigoValido('PED-9999')).toBe(true);
  });

  test('rechaza formatos fuera de norma', () => {
    ['ped-0001', 'PED-1', 'PED-00012', 'PEDIDO-0001', '0001', '', null, 123].forEach((valor) => {
      expect(esCodigoValido(valor)).toBe(false);
    });
  });
});

describe('esEstadoValido()', () => {
  test('acepta los cinco estados del catalogo', () => {
    ESTADOS_VALIDOS.forEach((estado) => expect(esEstadoValido(estado)).toBe(true));
  });

  test('rechaza estados desconocidos', () => {
    expect(esEstadoValido('DEVUELTO')).toBe(false);
    expect(esEstadoValido('pendiente')).toBe(false);
  });
});

describe('formatearMoneda()', () => {
  test('usa prefijo S/ y dos decimales', () => {
    expect(formatearMoneda(1250.5)).toBe('S/ 1,250.50');
    expect(formatearMoneda(0)).toBe('S/ 0.00');
    expect(formatearMoneda(999)).toBe('S/ 999.00');
  });

  test('inserta separador de miles', () => {
    expect(formatearMoneda(12800.75)).toBe('S/ 12,800.75');
    expect(formatearMoneda(1234567.891)).toBe('S/ 1,234,567.89');
  });
});

describe('formatearPedido()', () => {
  test('devuelve todos los campos que muestra el portal', () => {
    const pedido = formatearPedido(PEDIDO_BASE);
    expect(Object.keys(pedido).sort()).toEqual(
      [
        'cantidad',
        'cliente',
        'codigo',
        'estado',
        'estadoEtiqueta',
        'precioUnitario',
        'precioUnitarioFmt',
        'producto',
        'total',
        'totalFmt'
      ].sort()
    );
  });

  test('calcula y formatea el total del pedido', () => {
    const pedido = formatearPedido(PEDIDO_BASE);
    expect(pedido.total).toBe(5002.0);
    expect(pedido.totalFmt).toBe('S/ 5,002.00');
    expect(pedido.precioUnitarioFmt).toBe('S/ 1,250.50');
  });

  test('traduce el estado a una etiqueta legible', () => {
    expect(formatearPedido(PEDIDO_BASE).estadoEtiqueta).toBe('Enviado');
    expect(formatearPedido({ ...PEDIDO_BASE, estado: 'EN_PREPARACION' }).estadoEtiqueta)
      .toBe('En preparacion');
  });

  test('recorta espacios en cliente y producto', () => {
    const pedido = formatearPedido({ ...PEDIDO_BASE, cliente: '  Textiles del Sur S.A.  ' });
    expect(pedido.cliente).toBe('Textiles del Sur S.A.');
  });

  test('rechaza un pedido con codigo mal formado', () => {
    expect(() => formatearPedido({ ...PEDIDO_BASE, codigo: 'PEDIDO-7' }))
      .toThrow(/Codigo de pedido invalido/);
  });

  test('rechaza un pedido con estado fuera del catalogo', () => {
    expect(() => formatearPedido({ ...PEDIDO_BASE, estado: 'DEVUELTO' }))
      .toThrow(/Estado invalido/);
  });

  test('rechaza un pedido sin cliente o sin producto', () => {
    expect(() => formatearPedido({ ...PEDIDO_BASE, cliente: '   ' })).toThrow(/no tiene cliente/);
    expect(() => formatearPedido({ ...PEDIDO_BASE, producto: undefined })).toThrow(/no tiene producto/);
  });

  test('rechaza entradas que no son objeto', () => {
    expect(() => formatearPedido(null)).toThrow(TypeError);
    expect(() => formatearPedido('PED-0001')).toThrow(TypeError);
  });

  test('todo el catalogo de la PoC cumple el formato', () => {
    listarPedidos().forEach((crudo) => {
      const pedido = formatearPedido(crudo);
      expect(pedido.codigo).toMatch(/^PED-\d{4}$/);
      expect(pedido.totalFmt).toMatch(/^S\/ [\d,]+\.\d{2}$/);
      expect(ESTADOS_VALIDOS).toContain(pedido.estado);
    });
  });
});

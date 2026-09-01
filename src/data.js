'use strict';

/**
 * Fuente de datos de la PoC.
 * En un escenario real esto vendria del ERP de NovaTech; para la TA1
 * basta un arreglo en memoria que alimente el portal y las pruebas.
 */
const PEDIDOS = Object.freeze([
  {
    codigo: 'PED-0001',
    cliente: 'Comercial Andina S.A.C.',
    producto: 'Laptop Nova Pro 14"',
    cantidad: 3,
    precioUnitario: 3250.0,
    estado: 'ENTREGADO'
  },
  {
    codigo: 'PED-0002',
    cliente: 'Distribuidora Los Olivos E.I.R.L.',
    producto: 'Monitor NovaView 27"',
    cantidad: 8,
    precioUnitario: 899.9,
    estado: 'ENVIADO'
  },
  {
    codigo: 'PED-0003',
    cliente: 'Textiles del Sur S.A.',
    producto: 'Impresora NovaJet 500',
    cantidad: 2,
    precioUnitario: 1450.5,
    estado: 'EN_PREPARACION'
  },
  {
    codigo: 'PED-0004',
    cliente: 'Minera Altiplano S.A.C.',
    producto: 'Servidor NovaRack X1',
    cantidad: 1,
    precioUnitario: 12800.75,
    estado: 'PENDIENTE'
  },
  {
    codigo: 'PED-0005',
    cliente: 'Bodegas Union S.R.L.',
    producto: 'Teclado NovaType K2',
    cantidad: 25,
    precioUnitario: 129.9,
    estado: 'CANCELADO'
  }
]);

/** Devuelve una copia de los pedidos crudos. */
function listarPedidos() {
  return PEDIDOS.map((p) => ({ ...p }));
}

/** Busca un pedido por su codigo. Devuelve undefined si no existe. */
function buscarPedido(codigo) {
  return listarPedidos().find((p) => p.codigo === codigo);
}

module.exports = { PEDIDOS, listarPedidos, buscarPedido };

'use strict';

/**
 * Reglas de negocio del Portal de Pedidos de NovaTech S.A.C.
 * Este modulo NO conoce Express: es logica pura y por eso es facil de testear.
 */

/** Estados por los que puede pasar un pedido. */
const ESTADOS_VALIDOS = Object.freeze([
  'PENDIENTE',
  'EN_PREPARACION',
  'ENVIADO',
  'ENTREGADO',
  'CANCELADO'
]);

/** Etiquetas legibles para mostrar en el portal. */
const ETIQUETAS_ESTADO = Object.freeze({
  PENDIENTE: 'Pendiente',
  EN_PREPARACION: 'En preparacion',
  ENVIADO: 'Enviado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado'
});

/** Formato oficial del codigo de pedido: PED- seguido de 4 digitos. */
const PATRON_CODIGO = /^PED-\d{4}$/;

/** Redondeo comercial a 2 decimales, evitando errores de punto flotante. */
function redondear2(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Calcula el total de una linea de pedido.
 * total = cantidad * precioUnitario, redondeado a 2 decimales.
 */
function calcularTotal(cantidad, precioUnitario) {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    throw new TypeError('La cantidad debe ser un entero mayor que cero');
  }
  if (typeof precioUnitario !== 'number' || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
    throw new TypeError('El precio unitario debe ser un numero finito no negativo');
  }
  return redondear2(cantidad * precioUnitario);
}

/** Valida el formato del codigo de pedido (PED-0001). */
function esCodigoValido(codigo) {
  return typeof codigo === 'string' && PATRON_CODIGO.test(codigo);
}

/** Valida que el estado pertenezca al catalogo permitido. */
function esEstadoValido(estado) {
  return ESTADOS_VALIDOS.includes(estado);
}

/** Formatea un monto como moneda peruana: 1250.5 -> "S/ 1,250.50". */
function formatearMoneda(monto) {
  const numero = redondear2(Number(monto));
  if (!Number.isFinite(numero)) {
    throw new TypeError('El monto debe ser un numero finito');
  }
  const negativo = numero < 0;
  const [entero, decimales] = Math.abs(numero).toFixed(2).split('.');
  const enteroSeparado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negativo ? '-' : ''}S/ ${enteroSeparado}.${decimales}`;
}

/**
 * Normaliza y valida un pedido crudo, devolviendo la estructura que
 * consume la vista y la API. Lanza Error si el pedido es invalido.
 */
function formatearPedido(pedido) {
  if (!pedido || typeof pedido !== 'object') {
    throw new TypeError('El pedido debe ser un objeto');
  }

  const { codigo, cliente, producto, cantidad, precioUnitario, estado } = pedido;

  if (!esCodigoValido(codigo)) {
    throw new Error(`Codigo de pedido invalido: "${codigo}". Formato esperado: PED-0000`);
  }
  if (typeof cliente !== 'string' || cliente.trim() === '') {
    throw new Error(`El pedido ${codigo} no tiene cliente`);
  }
  if (typeof producto !== 'string' || producto.trim() === '') {
    throw new Error(`El pedido ${codigo} no tiene producto`);
  }
  if (!esEstadoValido(estado)) {
    throw new Error(`Estado invalido en ${codigo}: "${estado}". Validos: ${ESTADOS_VALIDOS.join(', ')}`);
  }

  const total = calcularTotal(cantidad, precioUnitario);

  return {
    codigo,
    cliente: cliente.trim(),
    producto: producto.trim(),
    cantidad,
    precioUnitario: redondear2(precioUnitario),
    precioUnitarioFmt: formatearMoneda(precioUnitario),
    total,
    totalFmt: formatearMoneda(total),
    estado,
    estadoEtiqueta: ETIQUETAS_ESTADO[estado]
  };
}

/** Suma los totales de una lista de pedidos ya formateados o crudos. */
function calcularMontoCartera(pedidos) {
  if (!Array.isArray(pedidos)) {
    throw new TypeError('Se esperaba un arreglo de pedidos');
  }
  const suma = pedidos
    .filter((p) => p.estado !== 'CANCELADO')
    .reduce((acc, p) => acc + calcularTotal(p.cantidad, p.precioUnitario), 0);
  return redondear2(suma);
}

module.exports = {
  ESTADOS_VALIDOS,
  ETIQUETAS_ESTADO,
  PATRON_CODIGO,
  redondear2,
  calcularTotal,
  esCodigoValido,
  esEstadoValido,
  formatearMoneda,
  formatearPedido,
  calcularMontoCartera
};

'use strict';

const { APP_NAME, APP_VERSION } = require('./version');

/** Escapa texto para evitar inyeccion de HTML desde los datos del pedido. */
function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function filaPedido(p) {
  return `
        <tr>
          <td class="codigo">${escaparHtml(p.codigo)}</td>
          <td>${escaparHtml(p.cliente)}</td>
          <td>${escaparHtml(p.producto)}</td>
          <td class="num">${escaparHtml(p.cantidad)}</td>
          <td class="num">${escaparHtml(p.precioUnitarioFmt)}</td>
          <td class="num total">${escaparHtml(p.totalFmt)}</td>
          <td><span class="badge ${escaparHtml(p.estado.toLowerCase())}">${escaparHtml(p.estadoEtiqueta)}</span></td>
        </tr>`;
}

/**
 * Renderiza el portal completo. La version (v1.0.0) se imprime en el
 * encabezado y en el pie para que el despliegue sea verificable a simple vista.
 */
function renderPortal(pedidos, montoCartera) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="app-version" content="${APP_VERSION}">
  <title>${APP_NAME} v${APP_VERSION}</title>
  <style>
    :root {
      --azul: #0b3d68; --azul-claro: #1565a8; --gris: #f4f6f9;
      --borde: #dfe4ea; --texto: #1f2933; --suave: #6b7684;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; background: var(--gris); color: var(--texto);
      font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    header {
      background: linear-gradient(135deg, var(--azul), var(--azul-claro));
      color: #fff; padding: 24px 32px;
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
    }
    header h1 { margin: 0; font-size: 22px; letter-spacing: .3px; }
    header p { margin: 4px 0 0; font-size: 13px; opacity: .85; }
    .version {
      background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.4);
      padding: 6px 14px; border-radius: 999px; font-weight: 700; font-size: 14px;
      font-family: Consolas, "Courier New", monospace;
    }
    main { max-width: 1100px; margin: 28px auto; padding: 0 20px; }
    .resumen { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    .card {
      background: #fff; border: 1px solid var(--borde); border-radius: 10px;
      padding: 16px 20px; flex: 1 1 200px;
    }
    .card span { display: block; font-size: 12px; text-transform: uppercase; color: var(--suave); letter-spacing: .6px; }
    .card strong { font-size: 22px; color: var(--azul); }
    .tabla-wrap { background: #fff; border: 1px solid var(--borde); border-radius: 10px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 780px; }
    thead th {
      background: var(--azul); color: #fff; text-align: left; padding: 12px 14px;
      font-size: 12px; text-transform: uppercase; letter-spacing: .6px;
    }
    tbody td { padding: 12px 14px; border-top: 1px solid var(--borde); }
    tbody tr:nth-child(even) { background: #fafbfc; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .total { font-weight: 700; color: var(--azul); }
    .codigo { font-family: Consolas, monospace; font-weight: 600; }
    .badge {
      display: inline-block; padding: 4px 10px; border-radius: 999px;
      font-size: 12px; font-weight: 600; border: 1px solid transparent;
    }
    .badge.pendiente       { background: #fff4d6; color: #8a6100; border-color: #f0d38a; }
    .badge.en_preparacion  { background: #e2eefc; color: #16548f; border-color: #b9d4f2; }
    .badge.enviado         { background: #e4f1ff; color: #0b57a4; border-color: #b7d6f7; }
    .badge.entregado       { background: #e3f6e9; color: #1c6b3a; border-color: #b4e2c6; }
    .badge.cancelado       { background: #fde8e8; color: #98241f; border-color: #f5bcbc; }
    footer {
      text-align: center; color: var(--suave); font-size: 12px;
      padding: 20px; border-top: 1px solid var(--borde); margin-top: 28px;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>${APP_NAME}</h1>
      <p>NovaTech S.A.C. &middot; PoC de entrega continua &middot; TA1 UTP</p>
    </div>
    <div class="version" id="app-version">v${APP_VERSION}</div>
  </header>

  <main>
    <section class="resumen">
      <div class="card"><span>Pedidos registrados</span><strong>${pedidos.length}</strong></div>
      <div class="card"><span>Monto en cartera</span><strong>${escaparHtml(montoCartera)}</strong></div>
      <div class="card"><span>Version desplegada</span><strong>v${APP_VERSION}</strong></div>
    </section>

    <div class="tabla-wrap">
      <table>
        <thead>
          <tr>
            <th>Codigo</th><th>Cliente</th><th>Producto</th>
            <th class="num">Cantidad</th><th class="num">Precio unit.</th>
            <th class="num">Total</th><th>Estado</th>
          </tr>
        </thead>
        <tbody>${pedidos.map(filaPedido).join('')}
        </tbody>
      </table>
    </div>
  </main>

  <footer>${APP_NAME} &mdash; version <strong>v${APP_VERSION}</strong> &middot; healthcheck en <code>/health</code></footer>
</body>
</html>`;
}

module.exports = { renderPortal, escaparHtml };

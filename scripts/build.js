#!/usr/bin/env node
'use strict';

/**
 * Etapa "build" del pipeline.
 * No usamos bundler: el artefacto es la app lista para empaquetar en Docker.
 * Lo que si hacemos es (1) validar que todo el codigo carga sin errores,
 * (2) copiar el runtime a dist/ y (3) sellar el artefacto con build-info.json.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const raiz = path.resolve(__dirname, '..');
const dist = path.join(raiz, 'dist');

function log(mensaje) {
  console.log(`[build] ${mensaje}`);
}

function commitActual() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: raiz, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'sin-git';
  }
}

// 1. Validacion: si algun modulo tiene un error de sintaxis, el build falla aqui.
log('validando modulos...');
const { APP_VERSION, APP_NAME } = require('../src/version');
require('../src/pedidos');
require('../src/data');
require('../src/views');
require('../src/app');
log(`modulos OK (${APP_NAME} v${APP_VERSION})`);

// 2. Empaquetado del artefacto.
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(path.join(raiz, 'src'), path.join(dist, 'src'), { recursive: true });
fs.copyFileSync(path.join(raiz, 'package.json'), path.join(dist, 'package.json'));
log('artefacto copiado a dist/');

// 3. Sello del build: trazabilidad version <-> commit <-> fecha.
const info = {
  app: APP_NAME,
  version: APP_VERSION,
  commit: commitActual(),
  builtAt: new Date().toISOString(),
  node: process.version
};
fs.writeFileSync(path.join(dist, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');

log(`build OK -> v${info.version} (commit ${info.commit})`);

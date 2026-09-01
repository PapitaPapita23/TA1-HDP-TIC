# Evidencias — Escenario de falla controlada

> **Objetivo:** demostrar con un caso real que la cadena de CI/CD **impide que
> código defectuoso llegue a producción**, sin depender de que una persona se
> dé cuenta a tiempo.

**Repositorio:** https://github.com/PapitaPapita23/TA1-HDP-TIC

## Resumen del experimento

| Run | Rama | Commit | Resultado | Qué demuestra |
| --- | --- | --- | --- | --- |
| [#1](https://github.com/PapitaPapita23/TA1-HDP-TIC/actions/runs/33529692471) | `main` | `a821413` | ✅ SUCCESS | Línea base: los 4 jobs en verde, deploy ejecutado |
| [#2](https://github.com/PapitaPapita23/TA1-HDP-TIC/actions/runs/33529722294) | `demo/falla-pruebas` | `2a9a8bb` | ❌ **FAILURE** | **Una prueba falla → build y deploy en `skipped`** |
| [#3](https://github.com/PapitaPapita23/TA1-HDP-TIC/actions/runs/33530130026) | `demo/falla-pruebas` | `a2f2bc7` | ✅ SUCCESS | Corregido el error, el pipeline vuelve a verde |

## Archivos de esta carpeta

| Archivo | Contenido |
| --- | --- |
| `00-impacto-del-error.txt` | Montos erróneos que se habrían facturado |
| `01-pipeline-local-ROJO.txt` | Pipeline local con el bug: test falla, build bloqueado |
| `02-validacion-workflow.txt` | Verificación de las dependencias `needs:` del workflow |
| `03-github-actions.txt` | Resultado job por job de los runs #1 y #2 |
| `04-pipeline-local-VERDE.txt` | Pipeline local tras la corrección |
| `05-pipeline-local-DOCKER.txt` | Pipeline completo con `docker build` + `deploy.sh` |
| `06-contenedor.txt` | Contenedor en ejecución: imagen, puertos, usuario, `/health` |

---

## 1. El error introducido

Rama `demo/falla-pruebas` · commit `2a9a8bb` — *"refactor(pedidos): simplifica el cálculo del total"*

En [`src/pedidos.js`](../../src/pedidos.js) se eliminó el redondeo comercial:

```diff
  function calcularTotal(cantidad, precioUnitario) {
    // ...validaciones...
-   return redondear2(cantidad * precioUnitario);
+   // "El redondeo esta de mas, la multiplicacion ya da el valor exacto." (ERROR)
+   return cantidad * precioUnitario;
  }
```

**Por qué este error y no otro.** Es exactamente el tipo de cambio que sobrevive a una
revisión de código: el mensaje del commit suena razonable, el código queda más corto y en
la mayoría de los casos el resultado *parece* correcto. Pero en aritmética de coma flotante
`3 × 0.1` no da `0.3`, sino `0.30000000000000004`.

### Impacto si hubiera llegado a producción

```
Caso                 | Total calculado        | Total correcto
---------------------+------------------------+---------------
3 x 0.1              | 0.30000000000000004    | 0.3 MAL
7 x 10.005           | 70.03500000000001      | 70.04 MAL
3 x 33.333           | 99.999                 | 99.99 MAL
6 x 16.665           | 99.99                  | 99.99 OK
11 x 1.115           | 12.265                 | 12.27 MAL
```

Esos importes irían tal cual a la factura del cliente y al asiento contable. Nótese que un
caso (`6 × 16.665`) **sí** da correcto: por eso una prueba manual puntual no habría
detectado nada.

---

## 2. Evidencia local — pipeline en rojo

Comando: `SKIP_DOCKER=1 bash scripts/pipeline-local.sh` → **exit code 1**

```
FAIL tests/total.test.js
  ● calcularTotal() › redondea a 2 decimales evitando errores de punto flotante

    expect(received).toBe(expected) // Object.is equality

    Expected: 0.3
    Received: 0.30000000000000004

    > 27 |     expect(calcularTotal(3, 0.1)).toBe(0.3);

Test Suites: 1 failed, 2 passed, 3 total
Tests:       1 failed, 36 passed, 37 total
```

```
  [   OK    ] 1/5 - LINT (calidad de codigo)
  [  FALLO  ] 2/5 - TEST (pruebas automatizadas)
  [BLOQUEADA] 3/5 - BUILD (artefacto de la aplicacion)
  [ OMITIDA ] 4/5 - DOCKER BUILD
  [ OMITIDA ] 5/5 - DEPLOY + HEALTHCHECK

PIPELINE EN ROJO.
El despliegue quedo BLOQUEADO por el fallo en: 2/5 - TEST
```

**1 de 37 pruebas falló y eso bastó para detener toda la cadena.**

---

## 3. Evidencia en GitHub Actions — el bloqueo real

### Run #2 — rama `demo/falla-pruebas`, commit `2a9a8bb` → **FAILURE**

```
  [SUCCESS]  17s  1. Lint (calidad de codigo)
  [FAILURE]  15s  2. Pruebas automatizadas
              ^ paso que fallo: Ejecutar suite Jest con cobertura
  [SKIPPED]   0s  3. Build + imagen Docker
  [SKIPPED]   0s  4. Deploy simulado (bloqueado si fallan las pruebas)
```

El dato decisivo son los **`0s` de duración** en los jobs 3 y 4: GitHub Actions ni siquiera
los arrancó. No es que el deploy se ejecutara y fallara — **nunca llegó a existir**, por el
`needs: [test, build]` declarado en el workflow.

### Run #1 — rama `main`, commit `a821413` → **SUCCESS** (línea base)

```
  [SUCCESS]  14s  1. Lint (calidad de codigo)
  [SUCCESS]  18s  2. Pruebas automatizadas
  [SUCCESS]  29s  3. Build + imagen Docker
  [SUCCESS]  28s  4. Deploy simulado (bloqueado si fallan las pruebas)
```

---

## 4. La corrección

Commit `a2f2bc7` — *"fix(pedidos): restaura el redondeo comercial del total"*

```diff
- // "El redondeo esta de mas, la multiplicacion ya da el valor exacto." (ERROR)
- return cantidad * precioUnitario;
+ // El redondeo NO es opcional: en coma flotante 3 * 0.1 da 0.30000000000000004
+ // y ese importe llegaria tal cual a la factura del cliente.
+ return redondear2(cantidad * precioUnitario);
```

### Run #3 — mismo branch, commit `a2f2bc7` → **SUCCESS**

```
  [SUCCESS]  13s  1. Lint (calidad de codigo)
  [SUCCESS]  17s  2. Pruebas automatizadas
  [SUCCESS]  34s  3. Build + imagen Docker
  [SUCCESS]  15s  4. Deploy simulado (bloqueado si fallan las pruebas)
```

Con el error corregido, los cuatro jobs pasan y el deploy **sí** se ejecuta. La compuerta
no bloquea por bloquear: autoriza en cuanto la calidad se cumple.

---

## 5. Despliegue real con contenedores

`bash scripts/pipeline-local.sh` con Docker activo → **exit code 0**

```
[deploy] 1/4 Deteniendo despliegue anterior...
[deploy] 2/4 Construyendo la imagen...
[  OK  ] Imagen construida: novatech-portal-pedidos:v1.0.0
[deploy] 3/4 Levantando el contenedor...
[deploy] 4/4 Healthcheck contra http://localhost:80/health ...

[  OK  ] La aplicacion responde (intento 2/15).
       Respuesta: {"status":"ok","app":"NovaTech - Portal de Pedidos","version":"1.0.0",...}

[  OK  ] DESPLIEGUE EXITOSO -> http://localhost:80
```

Estado del contenedor:

```
NAMES                     STATUS            PORTS
novatech-portal-pedidos   Up (healthy)      0.0.0.0:80->8080/tcp

Usuario dentro del contenedor: node      (no root)
Imagen: novatech-portal-pedidos:v1.0.0   207 MB
Version visible en el HTML: id="app-version">v1.0.0
```

---

## Conclusión

El cambio defectuoso existió, fue commiteado y fue empujado al repositorio remoto. Lo que
**no** ocurrió fue el despliegue: la cadena lo detuvo automáticamente, en 15 segundos y sin
intervención humana.

En el modelo actual de NovaTech —despliegue manual, sin pruebas— ese mismo commit habría
llegado a producción, y el error se habría descubierto cuando un cliente reclamara su
factura. La diferencia entre los dos modelos no es la herramienta: es **en qué momento se
detecta el error y cuánto cuesta corregirlo**.

# NovaTech — Portal de Pedidos `v1.0.0`

> **PoC de la TA1** — Herramientas de Desarrollo Profesional · TIC · UTP
> Caso: **NovaTech S.A.C.**

Prueba de concepto que demuestra, sobre una aplicación real y ejecutable, cómo una
**cadena de CI/CD con pruebas automatizadas, contenedores e IaC** resuelve los problemas
de despliegue manual de NovaTech: entregas lentas, errores en producción y "en mi máquina
sí funciona".

El punto central de la PoC: **si una prueba falla, el despliegue no ocurre.**

---

## Índice

- [Qué hace la aplicación](#qué-hace-la-aplicación)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Cómo ejecutarla](#cómo-ejecutarla)
- [Pruebas automatizadas](#pruebas-automatizadas)
- [Docker](#docker)
- [Pipeline CI/CD](#pipeline-cicd)
- [Despliegue](#despliegue)
- [Infraestructura como Código](#infraestructura-como-código)
- [Escenario de falla controlada](#escenario-de-falla-controlada)

---

## Qué hace la aplicación

Portal web que muestra los pedidos de NovaTech con todos sus datos de negocio:

| Campo | Ejemplo |
| --- | --- |
| Código de pedido | `PED-0001` |
| Cliente | Comercial Andina S.A.C. |
| Producto | Laptop Nova Pro 14" |
| Cantidad | 3 |
| Precio unitario | S/ 3,250.00 |
| **Total** | **S/ 9,750.00** |
| Estado | Entregado |

La **versión desplegada (`v1.0.0`) es visible en el HTML** —en la cabecera, en la tarjeta
de resumen y en el pie— para que cualquier despliegue se pueda verificar a simple vista.

### Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/` | Portal HTML con la tabla de pedidos y la versión visible |
| `GET` | `/health` | Estado del servicio (`status`, `version`, `uptime`) — lo consulta el deploy y Docker |
| `GET` | `/api/pedidos` | Listado de pedidos en JSON, con totales calculados |
| `GET` | `/api/pedidos/:codigo` | Detalle de un pedido (404 si no existe) |

---

## Estructura del repositorio

```
novatech-portal-pedidos/
├── src/                        # Código de la aplicación
│   ├── app.js                  # Rutas Express (exporta la app, no hace listen)
│   ├── server.js               # Arranque del servidor + apagado ordenado
│   ├── pedidos.js              # Reglas de negocio: total, formato, estados
│   ├── data.js                 # Catálogo de pedidos de la PoC
│   ├── views.js                # Render del portal HTML
│   └── version.js              # Versión visible (v1.0.0)
├── tests/                      # Pruebas automatizadas (Jest + Supertest)
│   ├── total.test.js           # Cálculo del total
│   ├── formato.test.js         # Formato del pedido
│   └── health.test.js          # Endpoints, incluido /health
├── scripts/
│   ├── deploy.sh               # Despliegue con contenedores + healthcheck
│   ├── pipeline-local.sh       # Simulador local del pipeline (misma compuerta)
│   └── build.js                # Etapa de build: valida y sella el artefacto
├── .github/workflows/
│   └── ci.yml                  # Pipeline CI/CD (la compuerta de calidad)
├── docs/
│   ├── iac/                    # Propuesta de IaC (Terraform + Ansible)
│   └── evidencias/             # Evidencias del escenario de falla
├── Dockerfile                  # Imagen liviana multi-stage (node:20-alpine)
├── .dockerignore
├── .gitattributes              # Fuerza LF en scripts (evita CRLF al correr en Linux)
├── .gitignore
├── package.json
└── README.md
```

---

## Cómo ejecutarla

**Requisitos:** Node.js ≥ 20 y (opcional) Docker.

```bash
npm install       # instalar dependencias
npm start         # levantar en http://localhost:8080
npm run dev       # modo desarrollo con recarga automática
```

| Comando | Qué hace |
| --- | --- |
| `npm run lint` | ESLint en modo estricto (`--max-warnings 0`) |
| `npm test` | Suite completa de Jest |
| `npm run test:cov` | Pruebas + reporte de cobertura |
| `npm run build` | Valida los módulos y genera `dist/` con `build-info.json` |

---

## Pruebas automatizadas

**37 pruebas** en 3 suites, con Jest y Supertest:

| Suite | Qué valida |
| --- | --- |
| `tests/total.test.js` | Cálculo del total: multiplicación, decimales, redondeo comercial a 2 decimales, rechazo de cantidades y precios inválidos, monto de cartera excluyendo cancelados |
| `tests/formato.test.js` | Formato del pedido: código `PED-0000`, catálogo de estados, moneda `S/ 0,000.00`, estructura completa del objeto que consume la vista |
| `tests/health.test.js` | Endpoint de salud (`200`, `status: ok`, versión), portal HTML con la versión visible, API de pedidos y respuestas 404 |

```bash
npm test
```

---

## Docker

Imagen **multi-stage** sobre `node:20-alpine` (207 MB medidos) que corre **sin privilegios de root**:

```bash
docker build -t novatech-portal-pedidos:v1.0.0 .
docker run -d --name novatech-portal-pedidos -p 80:8080 novatech-portal-pedidos:v1.0.0

curl http://localhost/health
```

El contenedor **escucha en el 8080** y se publica en el **puerto 80** del host.
Incluye `HEALTHCHECK`, de modo que Docker marca el contenedor como *unhealthy* si
`/health` deja de responder.

---

## Pipeline CI/CD

Definido en [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

```
┌──────────┐   ┌──────────┐   ┌───────────────────┐   ┌──────────────────┐
│ 1. LINT  │   │ 2. TEST  │──►│ 3. BUILD          │──►│ 4. DEPLOY        │
│ checkout │   │ checkout │   │ npm run build     │   │ carga la imagen  │
│ setup    │   │ setup    │   │ docker build      │   │ deploy.sh        │
│ install  │   │ install  │   │ smoke test        │   │ verifica /health │
│ eslint   │   │ jest     │   │ publica artefacto │   │ resumen          │
└────┬─────┘   └────┬─────┘   └───────────────────┘   └──────────────────┘
     └──────┬───────┘                 needs: [lint, test]   needs: [test, build]
            ▼
      Compuerta de calidad
```

**La compuerta:** el job `deploy` declara `needs: [test, build]`. Si una sola prueba falla,
el job `test` queda en rojo y GitHub Actions **nunca ejecuta `build` ni `deploy`** — aparecen
como *skipped*. El despliegue queda bloqueado de forma automática, sin intervención humana.

---

## Despliegue

`scripts/deploy.sh` automatiza el despliegue completo con contenedores:

```bash
./scripts/deploy.sh                    # publica en el puerto 80
HOST_PORT=8080 ./scripts/deploy.sh     # publica en otro puerto
IMAGE_TAG=v1.0.1 ./scripts/deploy.sh   # etiqueta otra versión
```

Los cuatro pasos que ejecuta:

1. **Detiene y elimina** el contenedor de la versión anterior
2. **Construye** la nueva imagen desde el `Dockerfile`
3. **Levanta** el contenedor publicando `8080` → puerto del host
4. **Healthcheck**: consulta `/health` con `curl` hasta 15 veces

Si el healthcheck no responde, el script **muestra los logs, elimina el contenedor
defectuoso y termina con código ≠ 0**, de modo que el pipeline marca el despliegue como
fallido en lugar de dejar una versión rota en el aire.

---

## Infraestructura como Código

En [`docs/iac/`](docs/iac/) hay una **propuesta** con Terraform y Ansible:

- **`main.tf`** — Terraform: crea la red, el firewall (solo 80 y 22) y una instancia EC2
  Ubuntu que instala Docker sola al arrancar.
- **`playbook.yml`** — Ansible: instala Docker, despliega el contenedor y verifica `/health`.

No se ejecutan en la PoC (crearían recursos facturables en AWS). El detalle y las decisiones
de diseño están en [`docs/iac/README.md`](docs/iac/README.md).

---

## Escenario de falla controlada

Se rompió una prueba a propósito para comprobar que la compuerta funciona de verdad.
Evidencia completa en [`docs/evidencias/`](docs/evidencias/).

| Run | Rama | Commit | Resultado | Qué demuestra |
| --- | --- | --- | --- | --- |
| [#6](https://github.com/PapitaPapita23/TA1-HDP-TIC/actions/runs/33535398653) | `main` | `bb26319` | ✅ SUCCESS | Línea base: 4 jobs en verde |
| [#7](https://github.com/PapitaPapita23/TA1-HDP-TIC/actions/runs/33535414594) | `demo/falla-pruebas` | `1d77698` | ❌ **FAILURE** | **1 prueba falla → `build` y `deploy` en `skipped` (0s)** |
| [#8](https://github.com/PapitaPapita23/TA1-HDP-TIC/actions/runs/33535571237) | `demo/falla-pruebas` | `bd3d880` | ✅ SUCCESS | Corregido: el deploy se ejecuta |

El error introducido fue eliminar el redondeo comercial del total, con un mensaje de commit
que sonaba razonable. En coma flotante `3 × 0.1` da `0.30000000000000004`: ese importe
habría llegado a la factura del cliente. **1 de 37 pruebas lo detectó y bastó para frenar
la entrega.**

Para reproducirlo en local, sin GitHub:

```bash
bash scripts/pipeline-local.sh                 # pipeline completo, con Docker
SKIP_DOCKER=1 bash scripts/pipeline-local.sh   # solo lint / test / build
```

El script respeta las mismas dependencias que el workflow: si `test` falla, las etapas
siguientes se marcan como `BLOQUEADA` y no se ejecutan.

---

**Equipo NovaTech** — TA1 Herramientas de Desarrollo Profesional · UTP

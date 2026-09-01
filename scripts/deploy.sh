#!/usr/bin/env bash
# ============================================================================
# NovaTech - Portal de Pedidos | Despliegue con contenedores
#
# Pasos:
#   1. Detiene y elimina el contenedor de la version anterior
#   2. Construye la nueva imagen a partir del Dockerfile
#   3. Levanta el contenedor publicando 8080 (interno) en el puerto del host
#   4. Healthcheck: consulta /health con curl hasta confirmar que responde
#   5. Si el healthcheck falla -> muestra logs, apaga el contenedor y sale != 0
#      (asi el pipeline marca el despliegue como fallido)
#
# Uso:   ./scripts/deploy.sh
#        HOST_PORT=8080 ./scripts/deploy.sh      # publicar en otro puerto
#        IMAGE_TAG=v1.0.1 ./scripts/deploy.sh    # etiquetar otra version
# ============================================================================

set -euo pipefail

# ---------------------------- Configuracion ---------------------------------
APP_NAME="${APP_NAME:-novatech-portal-pedidos}"
CONTAINER_NAME="${CONTAINER_NAME:-$APP_NAME}"
IMAGE_TAG="${IMAGE_TAG:-v1.0.0}"
IMAGE="${APP_NAME}:${IMAGE_TAG}"
HOST_PORT="${HOST_PORT:-80}"        # puerto publicado en el host
APP_PORT="${APP_PORT:-8080}"        # puerto interno del contenedor
HEALTH_URL="http://localhost:${HOST_PORT}/health"
REINTENTOS="${REINTENTOS:-15}"      # intentos del healthcheck
ESPERA="${ESPERA:-2}"               # segundos entre intentos

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ------------------------------- Utilidades ---------------------------------
log()   { printf '\033[0;36m[deploy]\033[0m %s\n' "$*"; }
ok()    { printf '\033[0;32m[  OK  ]\033[0m %s\n' "$*"; }
error() { printf '\033[0;31m[FALLO ]\033[0m %s\n' "$*" >&2; }

if ! command -v docker >/dev/null 2>&1; then
  error 'Docker no esta instalado o no esta en el PATH.'
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  error 'El daemon de Docker no responde. Inicia Docker Desktop / dockerd.'
  exit 1
fi

log "Aplicacion : ${APP_NAME}"
log "Imagen     : ${IMAGE}"
log "Puertos    : host ${HOST_PORT} -> contenedor ${APP_PORT}"
echo

# ------------------- 1. Detener la version anterior -------------------------
log '1/4 Deteniendo despliegue anterior...'
if [ -n "$(docker ps -aq -f "name=^${CONTAINER_NAME}$")" ]; then
  docker rm -f "${CONTAINER_NAME}" >/dev/null
  ok "Contenedor anterior '${CONTAINER_NAME}' detenido y eliminado."
else
  ok 'No habia un contenedor previo (primer despliegue).'
fi

# ------------------------- 2. Construir la imagen ---------------------------
log '2/4 Construyendo la imagen...'
docker build -t "${IMAGE}" -t "${APP_NAME}:latest" "${RAIZ}"
ok "Imagen construida: ${IMAGE}"

# ------------------------ 3. Levantar el contenedor -------------------------
log '3/4 Levantando el contenedor...'
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${HOST_PORT}:${APP_PORT}" \
  -e "PORT=${APP_PORT}" \
  -e 'NODE_ENV=production' \
  "${IMAGE}" >/dev/null
ok "Contenedor '${CONTAINER_NAME}' en ejecucion."

# --------------------------- 4. Healthcheck ---------------------------------
log "4/4 Healthcheck contra ${HEALTH_URL} ..."
intento=1
while [ "${intento}" -le "${REINTENTOS}" ]; do
  if respuesta="$(curl -fsS --max-time 3 "${HEALTH_URL}" 2>/dev/null)"; then
    echo
    ok "La aplicacion responde (intento ${intento}/${REINTENTOS})."
    echo "       Respuesta: ${respuesta}"
    echo
    ok "DESPLIEGUE EXITOSO -> http://localhost:${HOST_PORT}"
    exit 0
  fi
  printf '   ... esperando a la aplicacion (%s/%s)\n' "${intento}" "${REINTENTOS}"
  sleep "${ESPERA}"
  intento=$((intento + 1))
done

# ------------------------- Camino de fallo ----------------------------------
echo
error "La aplicacion no respondio tras ${REINTENTOS} intentos."
error 'Ultimos logs del contenedor:'
docker logs --tail 40 "${CONTAINER_NAME}" || true
log 'Revirtiendo: se detiene el contenedor defectuoso.'
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
error 'DESPLIEGUE FALLIDO.'
exit 1

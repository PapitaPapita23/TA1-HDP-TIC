#!/usr/bin/env bash
# ============================================================================
# NovaTech - Portal de Pedidos | Simulador local del pipeline
#
# Reproduce en la maquina del desarrollador las mismas etapas que
# .github/workflows/ci.yml, respetando las MISMAS dependencias:
#
#   1. LINT   ─┐
#   2. TEST   ─┴─► 3. BUILD ─► 4. DOCKER BUILD ─► 5. DEPLOY + HEALTHCHECK
#
# Si una etapa falla, las siguientes NO se ejecutan: aparecen como BLOQUEADA,
# igual que los jobs "skipped" de GitHub Actions por el needs: [test, build].
#
# Uso:  ./scripts/pipeline-local.sh
#       SKIP_DOCKER=1 ./scripts/pipeline-local.sh    # solo lint/test/build
#       HOST_PORT=8080 ./scripts/pipeline-local.sh   # publicar en otro puerto
# ============================================================================

set -uo pipefail # NO usamos -e: queremos capturar el fallo y seguir informando

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$RAIZ"

HOST_PORT="${HOST_PORT:-8080}"
SKIP_DOCKER="${SKIP_DOCKER:-0}"

ROJO='\033[0;31m'; VERDE='\033[0;32m'; AMARILLO='\033[0;33m'
AZUL='\033[0;36m'; GRIS='\033[0;90m'; NEGRITA='\033[1m'; FIN='\033[0m'

ETAPA_FALLIDA=""
declare -a RESUMEN=()

titulo() {
  echo ""
  printf "${AZUL}${NEGRITA}==============================================================${FIN}\n"
  printf "${AZUL}${NEGRITA} ETAPA %s${FIN}\n" "$1"
  printf "${AZUL}${NEGRITA}==============================================================${FIN}\n"
}

# Ejecuta una etapa. Si ya hubo un fallo previo, la marca como BLOQUEADA
# sin ejecutarla: asi se ve el efecto del "needs" del workflow.
etapa() {
  local nombre="$1"; shift
  titulo "$nombre"

  if [ -n "$ETAPA_FALLIDA" ]; then
    printf "${AMARILLO}BLOQUEADA${FIN} - no se ejecuta porque fallo la etapa '%s'.\n" "$ETAPA_FALLIDA"
    printf "${GRIS}(en GitHub Actions este job aparece como \"skipped\" por el needs:)${FIN}\n"
    RESUMEN+=("BLOQUEADA|$nombre")
    return 0
  fi

  printf "${GRIS}\$ %s${FIN}\n\n" "$*"
  if "$@"; then
    printf "\n${VERDE}OK${FIN} - etapa '%s' superada.\n" "$nombre"
    RESUMEN+=("OK|$nombre")
  else
    printf "\n${ROJO}FALLO${FIN} - etapa '%s' no superada.\n" "$nombre"
    RESUMEN+=("FALLO|$nombre")
    ETAPA_FALLIDA="$nombre"
  fi
}

echo ""
printf "${NEGRITA}NovaTech - Portal de Pedidos | Pipeline local${FIN}\n"
printf "${GRIS}Rama:   %s${FIN}\n" "$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'sin-git')"
printf "${GRIS}Commit: %s${FIN}\n" "$(git rev-parse --short HEAD 2>/dev/null || echo 'sin-git')"
printf "${GRIS}Fecha:  %s${FIN}\n" "$(date '+%Y-%m-%d %H:%M:%S')"

# --------------------------- Etapas del pipeline ---------------------------
etapa "1/5 - LINT (calidad de codigo)" npm run lint
etapa "2/5 - TEST (pruebas automatizadas)" npm test
etapa "3/5 - BUILD (artefacto de la aplicacion)" npm run build

if [ "$SKIP_DOCKER" = "1" ]; then
  titulo "4/5 - DOCKER BUILD"
  printf "${AMARILLO}OMITIDA${FIN} - SKIP_DOCKER=1\n"
  RESUMEN+=("OMITIDA|4/5 - DOCKER BUILD")
  titulo "5/5 - DEPLOY + HEALTHCHECK"
  printf "${AMARILLO}OMITIDA${FIN} - SKIP_DOCKER=1\n"
  RESUMEN+=("OMITIDA|5/5 - DEPLOY + HEALTHCHECK")
elif ! docker info >/dev/null 2>&1; then
  titulo "4/5 y 5/5 - DOCKER"
  printf "${AMARILLO}OMITIDAS${FIN} - el daemon de Docker no responde.\n"
  printf "${GRIS}Inicia Docker Desktop y vuelve a ejecutar este script.${FIN}\n"
  RESUMEN+=("OMITIDA|4/5 - DOCKER BUILD")
  RESUMEN+=("OMITIDA|5/5 - DEPLOY + HEALTHCHECK")
else
  etapa "4/5 - DOCKER BUILD (imagen del contenedor)" \
    docker build -t novatech-portal-pedidos:v1.0.0 -t novatech-portal-pedidos:latest .
  etapa "5/5 - DEPLOY + HEALTHCHECK (despliegue simulado)" \
    env HOST_PORT="$HOST_PORT" bash scripts/deploy.sh
fi

# ------------------------------- Resumen ------------------------------------
echo ""
printf "${NEGRITA}==============================================================${FIN}\n"
printf "${NEGRITA} RESUMEN DEL PIPELINE${FIN}\n"
printf "${NEGRITA}==============================================================${FIN}\n"
for linea in "${RESUMEN[@]}"; do
  estado="${linea%%|*}"
  nombre="${linea#*|}"
  case "$estado" in
    OK)        printf "  ${VERDE}[   OK    ]${FIN} %s\n" "$nombre" ;;
    FALLO)     printf "  ${ROJO}[  FALLO  ]${FIN} %s\n" "$nombre" ;;
    BLOQUEADA) printf "  ${AMARILLO}[BLOQUEADA]${FIN} %s\n" "$nombre" ;;
    OMITIDA)   printf "  ${GRIS}[ OMITIDA ]${FIN} %s\n" "$nombre" ;;
  esac
done
echo ""

if [ -n "$ETAPA_FALLIDA" ]; then
  printf "${ROJO}${NEGRITA}PIPELINE EN ROJO.${FIN}\n"
  printf "${ROJO}El despliegue quedo BLOQUEADO por el fallo en: %s${FIN}\n" "$ETAPA_FALLIDA"
  printf "${GRIS}Ninguna version llego al entorno. Es exactamente el comportamiento buscado.${FIN}\n\n"
  exit 1
fi

printf "${VERDE}${NEGRITA}PIPELINE EN VERDE.${FIN}\n"
printf "${VERDE}Todas las etapas pasaron: el despliegue esta autorizado.${FIN}\n\n"
exit 0

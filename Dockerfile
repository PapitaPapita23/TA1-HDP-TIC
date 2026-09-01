# ============================================================================
# NovaTech - Portal de Pedidos | Imagen de produccion
# Multi-stage sobre node:20-alpine para obtener una imagen liviana (~130 MB)
# ============================================================================

# ---------- Etapa 1: dependencias ----------
FROM node:20-alpine AS deps
WORKDIR /app
# Copiamos solo los manifiestos para aprovechar la cache de capas:
# si package.json no cambia, Docker reutiliza el npm ci de builds anteriores.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Etapa 2: runtime ----------
FROM node:20-alpine AS runtime

# curl es necesario para el HEALTHCHECK y para el healthcheck de deploy.sh
RUN apk add --no-cache curl

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

# Dependencias ya resueltas en la etapa anterior (sin devDependencies)
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src

# Buenas practicas de seguridad: la app NO corre como root.
# La imagen node:alpine ya trae el usuario "node" (uid 1000).
USER node

# El contenedor escucha en 8080; el host lo publica en el 80 (ver deploy.sh)
EXPOSE 8080

# Docker marca el contenedor unhealthy si /health deja de responder.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1

CMD ["node", "src/server.js"]

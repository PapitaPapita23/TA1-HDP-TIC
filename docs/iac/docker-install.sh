#!/bin/bash
# ============================================================================
# user_data de la instancia EC2 (lo invoca main.tf con file(...))
#
# Se ejecuta UNA sola vez, en el primer arranque del servidor, como root.
# Deja la maquina lista para que el pipeline corra scripts/deploy.sh sobre ella:
# con Docker instalado, habilitado al inicio y usable sin sudo.
# ============================================================================
set -euo pipefail

# 1. Actualizar el sistema base
apt-get update -y
apt-get upgrade -y

# 2. Instalar Docker desde el repositorio oficial (no el de Ubuntu, que va
#    varias versiones atras)
apt-get install -y ca-certificates curl gnupg git

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg |
  gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "$VERSION_CODENAME")"
echo "deb [arch=$ARCH signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $CODENAME stable" \
  >/etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 3. Docker debe arrancar solo si el servidor se reinicia
systemctl enable --now docker

# 4. El usuario ubuntu usa docker sin sudo (lo necesita el deploy por SSH)
usermod -aG docker ubuntu

# 5. Carpeta donde el pipeline dejara el codigo del portal
mkdir -p /opt/novatech/portal-pedidos
chown -R ubuntu:ubuntu /opt/novatech

echo "Servidor listo para recibir el Portal de Pedidos" >/var/log/novatech-init.log

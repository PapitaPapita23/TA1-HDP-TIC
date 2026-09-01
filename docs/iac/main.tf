# ============================================================================
# NovaTech S.A.C. - Infraestructura como Codigo (PROPUESTA - TA1)
# Terraform | Servidor de aplicaciones con Docker preinstalado
#
# QUE HACE ESTE FRAGMENTO
#   Levanta en AWS el servidor donde vive el Portal de Pedidos:
#     1. Una red minima (VPC + subred publica + gateway + ruta a Internet)
#     2. Un firewall (security group) que solo abre 22 (SSH) y 80 (HTTP)
#     3. Una instancia EC2 Ubuntu que, al arrancar, instala Docker sola
#        y deja el servidor listo para recibir el deploy del pipeline
#
# POR QUE IaC
#   Hoy NovaTech configura los servidores a mano: cada entorno termina
#   distinto y nadie recuerda que se toco. Con este archivo la infraestructura
#   queda versionada en Git, es reproducible (mismo comando -> mismo servidor)
#   y desechable (terraform destroy limpia todo sin residuos).
#
# COMO SE USARIA
#   terraform init      # descarga el proveedor de AWS
#   terraform plan      # muestra que se va a crear, SIN crear nada
#   terraform apply     # crea la infraestructura
#   terraform destroy   # la elimina por completo
#
# NOTA: es una PROPUESTA de la PoC. No se ejecuta en la TA1 porque
#       crearia recursos facturables en una cuenta real de AWS.
# ============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # En produccion el estado NO se guarda en la laptop del desarrollador:
  # iria en un bucket S3 con bloqueo en DynamoDB para trabajo en equipo.
  # backend "s3" {
  #   bucket         = "novatech-terraform-state"
  #   key            = "portal-pedidos/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "novatech-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region
}

# ----------------------------------------------------------------------------
# Variables: los valores que cambian entre entornos (dev / staging / prod)
# ----------------------------------------------------------------------------
variable "region" {
  description = "Region de AWS donde se despliega el portal"
  type        = string
  default     = "us-east-1"
}

variable "entorno" {
  description = "Nombre del entorno (dev, staging, prod)"
  type        = string
  default     = "staging"
}

variable "tipo_instancia" {
  description = "Tamano de la maquina. t3.micro entra en la capa gratuita."
  type        = string
  default     = "t3.micro"
}

variable "nombre_llave_ssh" {
  description = "Nombre del key pair de AWS para acceder por SSH"
  type        = string
  default     = "novatech-key"
}

variable "ips_admin" {
  description = "IPs autorizadas para SSH. En produccion NUNCA 0.0.0.0/0."
  type        = list(string)
  default     = ["0.0.0.0/0"] # <-- restringir a la IP de la oficina
}

# Etiquetas comunes: permiten saber quien paga cada recurso en la factura.
locals {
  tags_comunes = {
    Proyecto = "novatech-portal-pedidos"
    Entorno  = var.entorno
    Gestion  = "terraform"
    Curso    = "TA1-Herramientas-Desarrollo-Profesional-UTP"
  }
}

# ----------------------------------------------------------------------------
# 1. Red: una VPC propia para que el portal no comparta red con nada mas
# ----------------------------------------------------------------------------
resource "aws_vpc" "novatech" {
  cidr_block           = "10.20.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags_comunes, { Name = "vpc-novatech-${var.entorno}" })
}

# Subred publica: la instancia necesita IP publica para recibir trafico HTTP.
resource "aws_subnet" "publica" {
  vpc_id                  = aws_vpc.novatech.id
  cidr_block              = "10.20.1.0/24"
  map_public_ip_on_launch = true

  tags = merge(local.tags_comunes, { Name = "subnet-publica-${var.entorno}" })
}

# Puerta de enlace a Internet: sin esto la subred queda aislada.
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.novatech.id

  tags = merge(local.tags_comunes, { Name = "igw-novatech-${var.entorno}" })
}

# Tabla de rutas: todo lo que no sea trafico local sale por el gateway.
resource "aws_route_table" "publica" {
  vpc_id = aws_vpc.novatech.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = merge(local.tags_comunes, { Name = "rt-publica-${var.entorno}" })
}

resource "aws_route_table_association" "publica" {
  subnet_id      = aws_subnet.publica.id
  route_table_id = aws_route_table.publica.id
}

# ----------------------------------------------------------------------------
# 2. Firewall: principio de minimo privilegio, solo lo estrictamente necesario
# ----------------------------------------------------------------------------
resource "aws_security_group" "portal" {
  name        = "sg-portal-pedidos-${var.entorno}"
  description = "Permite HTTP publico y SSH administrativo"
  vpc_id      = aws_vpc.novatech.id

  # El portal se publica en el puerto 80 (el contenedor escucha en 8080)
  ingress {
    description = "HTTP publico hacia el Portal de Pedidos"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH solo para administracion, restringido por IP
  ingress {
    description = "SSH administrativo"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ips_admin
  }

  # Salida libre: necesaria para descargar la imagen Docker y actualizaciones
  egress {
    description = "Salida a Internet"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.tags_comunes, { Name = "sg-portal-pedidos-${var.entorno}" })
}

# ----------------------------------------------------------------------------
# 3. Servidor: Ubuntu 22.04 con Docker instalado automaticamente al arrancar
# ----------------------------------------------------------------------------

# Busca siempre la AMI oficial de Ubuntu mas reciente: evita fijar un id
# que queda obsoleto y que ademas es distinto en cada region.
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "portal" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.tipo_instancia
  subnet_id              = aws_subnet.publica.id
  vpc_security_group_ids = [aws_security_group.portal.id]
  key_name               = var.nombre_llave_ssh

  # user_data: script que corre UNA sola vez, en el primer arranque.
  # Aqui es donde el servidor se configura solo: instala Docker y queda
  # listo para que el pipeline ejecute scripts/deploy.sh sobre el.
  # El fichero externo mantiene el HCL legible (ver docker-install.sh).
  user_data = file("${path.module}/docker-install.sh")

  # Si cambia el user_data, se recrea la instancia con la nueva configuracion.
  user_data_replace_on_change = true

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
    encrypted   = true
  }

  tags = merge(local.tags_comunes, { Name = "ec2-portal-pedidos-${var.entorno}" })
}

# IP fija: si la instancia se recrea, la URL del portal no cambia.
resource "aws_eip" "portal" {
  instance = aws_instance.portal.id
  domain   = "vpc"

  tags = merge(local.tags_comunes, { Name = "eip-portal-pedidos-${var.entorno}" })
}

# ----------------------------------------------------------------------------
# 4. Salidas: los datos que el pipeline necesita para desplegar
# ----------------------------------------------------------------------------
output "ip_publica" {
  description = "IP publica del servidor del Portal de Pedidos"
  value       = aws_eip.portal.public_ip
}

output "url_portal" {
  description = "URL donde queda publicado el portal"
  value       = "http://${aws_eip.portal.public_ip}"
}

output "url_health" {
  description = "Endpoint de salud usado por el healthcheck del deploy"
  value       = "http://${aws_eip.portal.public_ip}/health"
}

output "comando_ssh" {
  description = "Comando para conectarse al servidor"
  value       = "ssh -i ~/.ssh/${var.nombre_llave_ssh}.pem ubuntu@${aws_eip.portal.public_ip}"
}

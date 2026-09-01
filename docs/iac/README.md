# Propuesta de Infraestructura como Código (IaC)

> **Estado: propuesta.** Los archivos de esta carpeta **no se ejecutan** en la PoC de la TA1,
> porque `terraform apply` crearía recursos facturables en una cuenta real de AWS y el
> playbook necesita un servidor accesible por SSH. Se entregan como **diseño documentado y
> versionado**, que es exactamente lo que aporta IaC: la infraestructura deja de vivir en la
> cabeza de una persona y pasa a estar en el repositorio.

## El problema actual de NovaTech

Hoy los servidores se configuran a mano. Eso produce tres síntomas conocidos:

| Síntoma | Causa | Cómo lo resuelve IaC |
| --- | --- | --- |
| "En mi servidor sí funciona" | Cada entorno se armó a mano y quedó distinto | Un mismo archivo genera servidores idénticos |
| Nadie sabe qué se tocó | Los cambios no se registran | Todo cambio pasa por Git, con autor y fecha |
| Recrear un servidor toma días | El proceso está en la memoria del técnico | `terraform apply` lo levanta en minutos |
| Recursos zombis que siguen facturando | Se crearon a mano y se olvidaron | `terraform destroy` elimina exactamente lo creado |

## Qué hay en esta carpeta

| Archivo | Herramienta | Responsabilidad |
| --- | --- | --- |
| `main.tf` | Terraform | **Aprovisionar**: crea la red, el firewall y el servidor EC2 |
| `docker-install.sh` | Bash (`user_data`) | Script de primer arranque: instala Docker en el servidor |
| `playbook.yml` | Ansible | **Configurar y desplegar**: instala Docker, copia el código, levanta el contenedor y verifica `/health` |
| `inventory.ini` | Ansible | Lista de servidores destino (la IP sale del output de Terraform) |

### La división del trabajo

```
Terraform  ──crea──►  Servidor vacío con Docker
                             │
                             ▼
Ansible    ──configura──►  Contenedor del portal corriendo en el puerto 80
                             │
                             ▼
deploy.sh  ──verifica──►  curl /health responde 200
```

Terraform y Ansible se complementan: Terraform es bueno creando y destruyendo recursos
(mantiene un *estado* de lo que existe); Ansible es bueno dejando un servidor ya existente
en la configuración deseada, de forma idempotente.

## Cómo se ejecutaría (fuera de la PoC)

### 1. Aprovisionar el servidor con Terraform

```bash
cd docs/iac

terraform init      # descarga el proveedor de AWS
terraform plan      # muestra qué se creará, SIN crear nada
terraform apply     # crea la infraestructura (pide confirmación)

terraform output url_portal    # http://<ip>  -> el portal ya publicado
terraform output ip_publica    # se usa en inventory.ini

terraform destroy   # elimina TODO lo creado, sin residuos
```

### 2. Desplegar la aplicación con Ansible

```bash
# Reemplazar la IP en inventory.ini con la que devolvió terraform output
ansible-playbook -i inventory.ini playbook.yml --check   # simulación (dry run)
ansible-playbook -i inventory.ini playbook.yml           # despliegue real
```

## Decisiones de diseño y por qué

- **AMI buscada dinámicamente** (`data "aws_ami"`): fijar un ID de imagen la deja obsoleta
  y además cambia entre regiones.
- **Security group mínimo**: solo 80 (HTTP público) y 22 (SSH restringido por IP).
  `var.ips_admin` está en `0.0.0.0/0` **solo como ejemplo**; en producción debe limitarse
  a la IP de la oficina.
- **Elastic IP**: si la instancia se recrea, la URL del portal no cambia.
- **Disco cifrado** (`encrypted = true`): requisito básico de seguridad.
- **Backend S3 comentado**: en equipo, el estado de Terraform no puede vivir en una laptop;
  va en S3 con bloqueo en DynamoDB para que dos personas no apliquen a la vez.
- **`recreate: true` en Ansible**: replica el comportamiento de `scripts/deploy.sh`,
  que detiene el contenedor anterior antes de levantar el nuevo.
- **Healthcheck obligatorio**: tanto el playbook como `deploy.sh` fallan si `/health` no
  responde 200. Un despliegue que no se verifica no es un despliegue.

## Relación con el pipeline

El job `deploy` de [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) hoy ejecuta
`scripts/deploy.sh` contra el propio runner (deploy simulado). Con esta IaC en marcha, ese
mismo job cambiaría a:

```yaml
- name: Desplegar en el servidor de staging
  run: ansible-playbook -i docs/iac/inventory.ini docs/iac/playbook.yml
```

El resto del pipeline —y sobre todo la compuerta `needs: [test, build]`— **no cambia**.

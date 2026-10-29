# One JSON secret holds the whole production env. Terraform writes it once with generated
# secrets; after that it owns only the secret's existence (put-ai-keys.sh adds the AI keys and
# Terraform will not overwrite them). recovery_window_in_days = 0 so destroy really deletes it.
resource "random_password" "app" {
  for_each = toset(["JWT_SECRET", "HOST_API_KEY", "HOST_SIGNING_SECRET", "POSTGRES_PASSWORD"])
  length   = 48
  special  = false
}

# AES-256 key for workspace secrets: exactly 32 random bytes, base64.
resource "random_bytes" "secrets_master_key" {
  length = 32
}

locals {
  env = {
    NODE_ENV                      = "production"
    LOG_LEVEL                     = "info"
    APP_ORIGIN                    = var.web_url
    SUPPORT_URL                   = var.web_url
    HOST_ORIGINS                  = var.portal_url
    HOST_SIGN_IN_URL              = var.portal_url
    PUBLIC_API_WS_ORIGIN          = "wss://${local.api_host}"
    API_HOST                      = local.api_host
    HOST_API_HOST                 = local.host_api_host
    ACME_EMAIL                    = var.alert_email
    JWT_SECRET                    = random_password.app["JWT_SECRET"].result
    HOST_API_KEY                  = random_password.app["HOST_API_KEY"].result
    HOST_SIGNING_SECRET           = random_password.app["HOST_SIGNING_SECRET"].result
    POSTGRES_PASSWORD             = random_password.app["POSTGRES_PASSWORD"].result
    SECRETS_MASTER_KEY            = random_bytes.secrets_master_key.base64
    CONNECTOR_ALLOW_PRIVATE_HOSTS = "false"
    HOST_SECURE_COOKIES           = "true"
    DATA_AS_OF                    = "2025-12-31"
    WORKER_ENABLED                = "true"
    HOST_DEMO_PASSWORD            = "Author@BookLeaf1"
    SEED_ADMIN_PASSWORD           = "Admin@BookLeaf1"
    ANTHROPIC_API_KEY             = ""
    OPENAI_API_KEY                = ""
  }
}

resource "aws_secretsmanager_secret" "env" {
  name                    = "${var.project}/${var.environment}/env"
  description             = "BookLeaf demo box production env (rendered to /opt/bookleaf/.env.prod)"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "env" {
  secret_id     = aws_secretsmanager_secret.env.id
  secret_string = jsonencode(local.env)

  lifecycle {
    ignore_changes = [secret_string]
  }
}

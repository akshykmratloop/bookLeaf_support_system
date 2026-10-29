output "instance_id" {
  value = aws_instance.box.id
}

output "public_ip" {
  value = aws_eip.box.public_ip
}

output "api_url" {
  value = "https://${local.api_host}"
}

output "host_api_url" {
  value = "https://${local.host_api_host}"
}

output "secret_id" {
  value = aws_secretsmanager_secret.env.name
}

# Exactly what the deploy workflow reads from GitHub (repo Settings → Secrets and variables →
# Actions). infra/scripts/apply.sh prints this; VERCEL_TOKEN is the only value not listed here.
output "github_config" {
  value = {
    secrets = {
      AWS_DEPLOY_ROLE_ARN = aws_iam_role.deploy.arn
    }
    variables = {
      AWS_REGION           = var.region
      BOOKLEAF_INSTANCE_ID = aws_instance.box.id
      RELEASE_BUCKET       = aws_s3_bucket.releases.bucket
      API_HOST             = local.api_host
      HOST_API_HOST        = local.host_api_host
      WEB_URL              = var.web_url
      PORTAL_URL           = var.portal_url
      VERCEL_SCOPE         = var.vercel_scope
    }
  }
}

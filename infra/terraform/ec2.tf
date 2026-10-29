# One small arm64 box. The Elastic IP is created first so its address can be baked into the
# sslip.io hostnames (secret + Caddy) before the box ever boots.
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }
  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_eip" "box" {
  domain = "vpc"
  tags   = { Name = "${var.project}-${var.environment}" }
}

locals {
  ip_dashed     = replace(aws_eip.box.public_ip, ".", "-")
  api_host      = "api.${local.ip_dashed}.sslip.io"
  host_api_host = "host-api.${local.ip_dashed}.sslip.io"

  # /etc/bookleaf/project.env — read by every bookleaf-* helper on the box.
  project_env = join("\n", [
    "AWS_REGION=${var.region}",
    "SECRET_ID=${aws_secretsmanager_secret.env.name}",
    "RELEASE_BUCKET=${aws_s3_bucket.releases.bucket}",
  ])

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
    project_env = local.project_env
    load_env_sh = file("${path.module}/files/bookleaf-load-env")
    deploy_sh   = file("${path.module}/files/bookleaf-deploy")
    prune_sh    = file("${path.module}/files/bookleaf-prune")
    env_unit    = file("${path.module}/files/bookleaf-env.service")
    prune_unit  = file("${path.module}/files/bookleaf-prune.service")
    prune_timer = file("${path.module}/files/bookleaf-prune.timer")
  })
}

resource "aws_instance" "box" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnet.default.id
  vpc_security_group_ids = [aws_security_group.box.id]
  iam_instance_profile   = aws_iam_instance_profile.box.name

  user_data_base64            = base64gzip(local.user_data)
  user_data_replace_on_change = false

  # Standard credits: a busy build slows down instead of adding burst charges to the bill.
  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
    http_endpoint               = "enabled"
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_gb
    encrypted             = true
    delete_on_termination = true
  }

  tags = { Name = "${var.project}-${var.environment}" }

  lifecycle {
    # A newer AMI or an edited bootstrap must never replace the running box (and its database).
    ignore_changes = [ami, user_data_base64]
  }
}

resource "aws_eip_association" "box" {
  instance_id   = aws_instance.box.id
  allocation_id = aws_eip.box.id
}

variable "aws_account_id" {
  description = "The only account this may be applied to (guards against the wrong profile)."
  type        = string
  default     = "533063875346"
}

variable "region" {
  type    = string
  default = "ap-south-1"
}

variable "project" {
  type    = string
  default = "bookleaf"
}

variable "environment" {
  type    = string
  default = "demo"
}

variable "instance_type" {
  description = "t4g.small (2 vCPU burst, 2 GB) is the smallest size that runs both backends, Postgres, Redis and Caddy."
  type        = string
  default     = "t4g.small"
}

variable "root_volume_gb" {
  type    = number
  default = 20
}

variable "github_repo" {
  type    = string
  default = "akshykmratloop/bookLeaf_support_system"
}

variable "github_subject_prefix" {
  description = "OIDC `sub` prefix. This repo uses GitHub's immutable form; read it with `gh api repos/<repo>/actions/oidc/customization/sub`."
  type        = string
  default     = "repo:akshykmratloop@160120719/bookLeaf_support_system@1437068547"

  validation {
    condition     = startswith(var.github_subject_prefix, "repo:")
    error_message = "github_subject_prefix must start with repo:."
  }
}

variable "web_url" {
  description = "The support web app on Vercel (apps/web)."
  type        = string
  default     = "https://bookleaf-support-ak.vercel.app"
}

variable "portal_url" {
  description = "The BookLeaf author dashboard on Vercel (apps/host-web)."
  type        = string
  default     = "https://bookleaf-authors.vercel.app"
}

variable "alert_email" {
  description = "Gets the Let's Encrypt account mail and the monthly budget alerts."
  type        = string
  default     = "akshykmr@loopmethods.com"
}

variable "monthly_budget_usd" {
  type    = number
  default = 25
}

variable "vercel_scope" {
  description = "Vercel team slug the two frontend projects live in."
  type        = string
  default     = "akshay-kumars-projects-af3b1e32"
}

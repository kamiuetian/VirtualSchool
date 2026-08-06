locals {
  resource_prefix = "${var.name_prefix}-${var.environment}"
  az_count        = length(var.availability_zones)

  common_tags = merge({
    Application = "Virtual School"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }, var.tags)

  buckets = toset([
    "imports",
    "exports",
    "reports",
    "artifacts",
  ])

  application_secrets = toset([
    "application",
    "auth0",
    "android-management",
  ])

  ecs_workloads = toset([
    "admin",
    "api",
    "worker",
    "migration",
  ])
}

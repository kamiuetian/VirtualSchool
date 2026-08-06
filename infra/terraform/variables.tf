variable "aws_region" {
  description = "AWS region in which to create the staging foundation."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment. This root module is intentionally restricted to staging."
  type        = string
  default     = "staging"

  validation {
    condition     = var.environment == "staging"
    error_message = "This foundation only manages the staging environment."
  }
}

variable "name_prefix" {
  description = "Prefix applied to resource names."
  type        = string
  default     = "virtual-school"
}

variable "vpc_cidr" {
  description = "CIDR for the staging VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "availability_zones" {
  description = "Two or more availability zones used by public and private subnets."
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "At least two availability zones are required."
  }
}

variable "database_name" {
  description = "Initial PostgreSQL database name."
  type        = string
  default     = "virtualschool"
}

variable "database_username" {
  description = "RDS master username. The password is generated and stored by RDS in Secrets Manager."
  type        = string
  default     = "virtualschool_admin"
}

variable "database_instance_class" {
  description = "RDS instance class for staging."
  type        = string
  default     = "db.t4g.micro"
}

variable "redis_node_type" {
  description = "ElastiCache node type for staging."
  type        = string
  default     = "cache.t4g.micro"
}

variable "tags" {
  description = "Additional tags to apply to every supported resource."
  type        = map(string)
  default     = {}
}

variable "operational_alert_email" {
  description = "Optional operations email subscribed to the encrypted alert topic. AWS requires confirmation."
  type        = string
  default     = null
  nullable    = true
}

variable "application_error_threshold" {
  description = "Structured error log count in five minutes that triggers an operational alarm."
  type        = number
  default     = 5

  validation {
    condition     = var.application_error_threshold >= 1
    error_message = "The application error threshold must be at least one."
  }
}

output "vpc_id" {
  description = "Staging VPC ID."
  value       = aws_vpc.staging.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs for load balancers."
  value       = values(aws_subnet.public)[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs for ECS and data services."
  value       = values(aws_subnet.private)[*].id
}

output "ecs_cluster_arn" {
  description = "ECS cluster ARN used by application services and migration tasks."
  value       = aws_ecs_cluster.staging.arn
}

output "ecs_security_group_id" {
  description = "Security group to attach to ECS services."
  value       = aws_security_group.ecs.id
}

output "ecr_repository_urls" {
  description = "Immutable workload repository URLs."
  value       = { for name, repository in aws_ecr_repository.workload : name => repository.repository_url }
}

output "database_endpoint" {
  description = "Private PostgreSQL endpoint."
  value       = aws_db_instance.staging.endpoint
}

output "database_master_secret_arn" {
  description = "RDS-managed master credential secret ARN."
  value       = aws_db_instance.staging.master_user_secret[0].secret_arn
  sensitive   = true
}

output "redis_primary_endpoint" {
  description = "TLS-enabled Redis primary endpoint."
  value       = aws_elasticache_replication_group.staging.primary_endpoint_address
}

output "bucket_names" {
  description = "Application storage bucket names."
  value       = { for name, bucket in aws_s3_bucket.staging : name => bucket.id }
}

output "application_secret_arns" {
  description = "Empty secret containers to populate through an approved operational process."
  value       = { for name, secret in aws_secretsmanager_secret.application : name => secret.arn }
  sensitive   = true
}

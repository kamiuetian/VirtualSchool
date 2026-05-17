# Terraform

This directory will hold AWS infrastructure for the `dev`, `staging`, and `prod` environments.

Phase 1 target infrastructure:

- VPC with public and private subnets.
- Application Load Balancer with ACM TLS.
- ECS Fargate services for admin, API, worker, and one-off migration jobs.
- RDS PostgreSQL with encrypted storage and PITR.
- ElastiCache Redis.
- S3 buckets for imports, exports, reports, and artifacts.
- Secrets Manager and KMS.
- CloudWatch alarms and dashboards.
- WAF and Route 53.

GitHub Actions should use AWS OIDC federation instead of static access keys.

# AWS staging Terraform foundation

This root module provisions the shared foundation for the Virtual School staging environment. It intentionally stops before public DNS, load balancers, and running ECS services: those require approved hostnames, certificates, and released application images. The outputs provide the network, cluster, repositories, roles, and log groups needed by that deployment layer.

## Resources

- A VPC spanning at least two availability zones, with public and private subnets and outbound NAT for private workloads.
- A private, encrypted PostgreSQL 16 RDS instance with seven-day point-in-time recovery and deletion protection. RDS generates its master password and stores it in Secrets Manager.
- A private, TLS-enabled, encrypted, two-node Redis replication group with automatic failover and snapshots.
- KMS-encrypted, versioned, public-access-blocked buckets for imports, exports, reports, and artifacts.
- Empty KMS-encrypted Secrets Manager containers for application, Auth0, and Android Management configuration. Terraform never stores their values.
- An ECS Fargate cluster foundation with Container Insights, private-workload security groups, least-privilege task roles, encrypted CloudWatch log groups, and immutable/scanned ECR repositories for admin, API, worker, and migration workloads.
- An encrypted operational alert topic, structured-error metric filters and alarms, database and Redis capacity alarms, and a CloudWatch operations dashboard.

Staging uses one NAT gateway to control pilot cost. Production should use one NAT gateway per availability zone before workloads with a multi-AZ availability objective are deployed.

## Prerequisites

- Terraform 1.7 or newer.
- AWS credentials supplied through the normal provider chain. CI and deployment workflows must use GitHub OIDC role assumption; do not create static access keys or put credentials in Terraform variables.
- A remote S3 state backend with locking configured by the deployment operator. Backend configuration is deliberately not embedded so validation and account-specific initialization remain portable.

## Validate

```bash
terraform -chdir=infra/terraform fmt -check -recursive
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform validate
```

## Plan and apply

Choose availability zones that belong to `aws_region` if overriding the defaults. Keep account-specific, non-secret settings in an ignored `.tfvars` file:

```hcl
aws_region         = "ap-south-1"
availability_zones = ["ap-south-1a", "ap-south-1b"]
tags = {
  Owner      = "platform-team"
  CostCenter = "virtual-school-staging"
}
```

Initialize with the approved remote backend, review the saved plan, then apply that exact plan:

```bash
terraform -chdir=infra/terraform init -backend-config=backend.hcl
terraform -chdir=infra/terraform plan -var-file=staging.tfvars -out=staging.tfplan
terraform -chdir=infra/terraform apply staging.tfplan
```

Populate the application secret containers after apply through an approved secrets workflow. Secret values must not be passed to Terraform because values written by Terraform are retained in state. The RDS credential is available through the sensitive `database_master_secret_arn` output and remains managed by RDS.

Set the optional `operational_alert_email` variable to subscribe an operations mailbox to alarm and recovery notifications. The recipient must confirm the AWS subscription. Follow `docs/operations/staging-observability-readiness.md` for rollout checks, alert response, and isolated backup restore drills.

The database has deletion protection and requires a final snapshot. Disable deletion protection in a separately reviewed plan before intentionally destroying the staging database.

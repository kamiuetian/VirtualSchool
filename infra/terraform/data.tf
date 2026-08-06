resource "aws_kms_key" "staging" {
  description             = "Virtual School staging data encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "staging" {
  name          = "alias/${local.resource_prefix}"
  target_key_id = aws_kms_key.staging.key_id
}

resource "aws_db_subnet_group" "staging" {
  name       = local.resource_prefix
  subnet_ids = values(aws_subnet.private)[*].id
}

resource "aws_db_instance" "staging" {
  identifier = local.resource_prefix

  engine                        = "postgres"
  engine_version                = "16.6"
  instance_class                = var.database_instance_class
  allocated_storage             = 20
  max_allocated_storage         = 100
  storage_type                  = "gp3"
  storage_encrypted             = true
  kms_key_id                    = aws_kms_key.staging.arn
  db_name                       = var.database_name
  username                      = var.database_username
  manage_master_user_password   = true
  master_user_secret_kms_key_id = aws_kms_key.staging.arn
  db_subnet_group_name          = aws_db_subnet_group.staging.name
  vpc_security_group_ids        = [aws_security_group.data.id]
  publicly_accessible           = false
  multi_az                      = false
  backup_retention_period       = 7
  copy_tags_to_snapshot         = true
  deletion_protection           = true
  skip_final_snapshot           = false
  final_snapshot_identifier     = "${local.resource_prefix}-final"
  auto_minor_version_upgrade    = true
  apply_immediately             = false
}

resource "aws_elasticache_subnet_group" "staging" {
  name       = local.resource_prefix
  subnet_ids = values(aws_subnet.private)[*].id
}

resource "aws_elasticache_replication_group" "staging" {
  replication_group_id = local.resource_prefix
  description          = "Virtual School staging queues and cache"

  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 2
  port                       = 6379
  automatic_failover_enabled = true
  multi_az_enabled           = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  kms_key_id                 = aws_kms_key.staging.arn
  subnet_group_name          = aws_elasticache_subnet_group.staging.name
  security_group_ids         = [aws_security_group.data.id]
  snapshot_retention_limit   = 7
  apply_immediately          = false
}

resource "aws_s3_bucket" "staging" {
  for_each = local.buckets

  bucket_prefix = "${local.resource_prefix}-${each.key}-"
  force_destroy = false
}

resource "aws_s3_bucket_public_access_block" "staging" {
  for_each = aws_s3_bucket.staging

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "staging" {
  for_each = aws_s3_bucket.staging
  bucket   = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.staging.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "staging" {
  for_each = aws_s3_bucket.staging
  bucket   = each.value.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_secretsmanager_secret" "application" {
  for_each = local.application_secrets

  name                    = "${local.resource_prefix}/${each.key}"
  description             = "Provisioned container for ${each.key} staging configuration; populate out of band"
  kms_key_id              = aws_kms_key.staging.arn
  recovery_window_in_days = 30
}

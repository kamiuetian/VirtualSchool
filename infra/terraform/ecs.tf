data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_ecs_cluster" "staging" {
  name = local.resource_prefix

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecr_repository" "workload" {
  for_each = local.ecs_workloads

  name                 = "${local.resource_prefix}/${each.key}"
  image_tag_mutability = "IMMUTABLE"

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.staging.arn
  }

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_cloudwatch_log_group" "workload" {
  for_each = local.ecs_workloads

  name              = "/ecs/${local.resource_prefix}/${each.key}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.staging.arn
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${local.resource_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name               = "${local.resource_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

data "aws_iam_policy_document" "ecs_application" {
  statement {
    sid       = "ReadApplicationSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = concat(values(aws_secretsmanager_secret.application)[*].arn, [aws_db_instance.staging.master_user_secret[0].secret_arn])
  }

  statement {
    sid = "UseApplicationBuckets"
    actions = [
      "s3:DeleteObject",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:PutObject",
    ]
    resources = flatten([
      for bucket in aws_s3_bucket.staging : [bucket.arn, "${bucket.arn}/*"]
    ])
  }

  statement {
    sid       = "DecryptApplicationData"
    actions   = ["kms:Decrypt", "kms:GenerateDataKey"]
    resources = [aws_kms_key.staging.arn]
  }
}

resource "aws_iam_role_policy" "ecs_application" {
  name   = "application-access"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.ecs_application.json
}

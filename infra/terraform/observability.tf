resource "aws_sns_topic" "operational_alerts" {
  name              = "${local.resource_prefix}-operational-alerts"
  kms_master_key_id = "alias/aws/sns"
}

resource "aws_sns_topic_subscription" "operational_email" {
  count = var.operational_alert_email == null ? 0 : 1

  topic_arn = aws_sns_topic.operational_alerts.arn
  protocol  = "email"
  endpoint  = var.operational_alert_email
}

resource "aws_cloudwatch_log_metric_filter" "application_errors" {
  for_each = aws_cloudwatch_log_group.workload

  name           = "${local.resource_prefix}-${each.key}-errors"
  pattern        = "{ $.level = \"error\" }"
  log_group_name = each.value.name

  metric_transformation {
    name          = "ApplicationErrors"
    namespace     = "VirtualSchool/${var.environment}/${each.key}"
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "application_errors" {
  for_each = aws_cloudwatch_log_metric_filter.application_errors

  alarm_name          = "${local.resource_prefix}-${each.key}-application-errors"
  alarm_description   = "${each.key} emitted structured error logs in staging."
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ApplicationErrors"
  namespace           = "VirtualSchool/${var.environment}/${each.key}"
  period              = 300
  statistic           = "Sum"
  threshold           = var.application_error_threshold
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.operational_alerts.arn]
  ok_actions          = [aws_sns_topic.operational_alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${local.resource_prefix}-database-high-cpu"
  alarm_description   = "PostgreSQL CPU has remained above the staging readiness threshold."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "breaching"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.staging.identifier }
  alarm_actions       = [aws_sns_topic.operational_alerts.arn]
  ok_actions          = [aws_sns_topic.operational_alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name          = "${local.resource_prefix}-database-low-storage"
  alarm_description   = "PostgreSQL free storage is below 5 GiB."
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 5368709120
  treat_missing_data  = "breaching"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.staging.identifier }
  alarm_actions       = [aws_sns_topic.operational_alerts.arn]
  ok_actions          = [aws_sns_topic.operational_alerts.arn]
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${local.resource_prefix}-redis-high-cpu"
  alarm_description   = "Redis engine CPU has remained above the staging readiness threshold."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 300
  statistic           = "Average"
  threshold           = 70
  treat_missing_data  = "breaching"
  dimensions          = { ReplicationGroupId = aws_elasticache_replication_group.staging.replication_group_id }
  alarm_actions       = [aws_sns_topic.operational_alerts.arn]
  ok_actions          = [aws_sns_topic.operational_alerts.arn]
}

resource "aws_cloudwatch_dashboard" "staging" {
  dashboard_name = "${local.resource_prefix}-operations"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "PostgreSQL health"
          region = var.aws_region
          period = 300
          stat   = "Average"
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.staging.identifier],
            [".", "DatabaseConnections", ".", "."],
            [".", "FreeStorageSpace", ".", ".", { yAxis = "right" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "Redis health"
          region = var.aws_region
          period = 300
          stat   = "Average"
          metrics = [
            ["AWS/ElastiCache", "EngineCPUUtilization", "ReplicationGroupId", aws_elasticache_replication_group.staging.replication_group_id],
            [".", "CurrConnections", ".", "."],
            [".", "FreeableMemory", ".", ".", { yAxis = "right" }]
          ]
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 24
        height = 6
        properties = {
          title   = "Structured application errors"
          region  = var.aws_region
          period  = 300
          stat    = "Sum"
          metrics = [for workload in local.ecs_workloads : ["VirtualSchool/${var.environment}/${workload}", "ApplicationErrors"]]
        }
      }
    ]
  })
}

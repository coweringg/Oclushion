resource "aws_elasticache_subnet_group" "this" {
  name        = "${var.environment}-oclushion-redis"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for Oclushion Redis"

  tags = merge(var.tags, { Name = "${var.environment}-oclushion-redis" })
}

resource "aws_elasticache_parameter_group" "this" {
  name        = "${var.environment}-oclushion-redis-pg"
  family      = "redis7"
  description = "Parameter group for Oclushion Redis"

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = merge(var.tags, { Name = "${var.environment}-oclushion-redis-pg" })
}

resource "aws_elasticache_replication_group" "this" {
  replication_group_id = "${var.environment}-oclushion-redis"
  description          = "Redis cluster for Oclushion ${var.environment}"
  node_type            = var.node_type
  num_cache_clusters   = var.num_cache_nodes
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.this.name
  subnet_group_name    = aws_elasticache_subnet_group.this.name
  security_group_ids   = [var.security_group_id]

  automatic_failover_enabled = var.num_cache_nodes > 1
  multi_az_enabled           = var.num_cache_nodes > 1
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  apply_immediately          = var.apply_immediately

  auto_minor_version_upgrade = true

  tags = merge(var.tags, { Name = "${var.environment}-oclushion-redis" })
}

resource "aws_secretsmanager_secret" "connection_string" {
  name        = "${var.environment}-oclushion-redis-connection"
  description = "Redis connection string for Oclushion ${var.environment}"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "connection_string" {
  secret_id = aws_secretsmanager_secret.connection_string.id
  secret_string = jsonencode({
    connection_string = "rediss://${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
    host              = aws_elasticache_replication_group.this.primary_endpoint_address
    port              = 6379
  })
}

output "primary_endpoint_address" {
  value = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "reader_endpoint_address" {
  value = aws_elasticache_replication_group.this.reader_endpoint_address
}

output "port" {
  value = aws_elasticache_replication_group.this.port
}

output "connection_secret_arn" {
  value = aws_secretsmanager_secret.connection_string.arn
}

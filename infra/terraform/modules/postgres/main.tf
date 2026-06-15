resource "aws_db_subnet_group" "this" {
  name        = "${var.environment}-oclushion-postgres"
  subnet_ids  = var.subnet_ids
  description = "Subnet group for Oclushion PostgreSQL"

  tags = merge(var.tags, { Name = "${var.environment}-oclushion-postgres" })
}

resource "aws_db_parameter_group" "this" {
  name        = "${var.environment}-oclushion-postgres-pg"
  family      = "postgres17"
  description = "Parameter group for Oclushion PostgreSQL"

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = merge(var.tags, { Name = "${var.environment}-oclushion-postgres-pg" })
}

resource "aws_db_instance" "this" {
  identifier = "${var.environment}-oclushion-postgres"

  engine         = "postgres"
  engine_version = "17.2"
  instance_class = var.instance_class

  allocated_storage       = var.allocated_storage
  storage_type            = "gp3"
  storage_encrypted       = true
  backup_retention_period = var.backup_retention_days
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:05:00-sun:06:00"

  db_name  = "oclushion"
  username = var.master_username
  password = var.master_password
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.this.name
  parameter_group_name   = aws_db_parameter_group.this.name
  vpc_security_group_ids = [var.security_group_id]

  multi_az              = var.multi_az
  copy_tags_to_snapshot = true
  deletion_protection   = var.deletion_protection
  skip_final_snapshot   = !var.deletion_protection

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = merge(var.tags, { Name = "${var.environment}-oclushion-postgres" })
}

resource "aws_secretsmanager_secret" "connection_string" {
  name        = "${var.environment}-oclushion-postgres-connection"
  description = "PostgreSQL connection string for Oclushion ${var.environment}"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "connection_string" {
  secret_id = aws_secretsmanager_secret.connection_string.id
  secret_string = jsonencode({
    connection_string = "postgresql://${var.master_username}:${urlencode(var.master_password)}@${aws_db_instance.this.endpoint}/${aws_db_instance.this.db_name}"
    host              = aws_db_instance.this.address
    port              = aws_db_instance.this.port
    database          = aws_db_instance.this.db_name
    username          = var.master_username
  })
}

output "endpoint" {
  value = aws_db_instance.this.endpoint
}

output "address" {
  value = aws_db_instance.this.address
}

output "port" {
  value = aws_db_instance.this.port
}

output "db_name" {
  value = aws_db_instance.this.db_name
}

output "connection_secret_arn" {
  value = aws_secretsmanager_secret.connection_string.arn
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
}

variable "master_username" {
  description = "Master username for PostgreSQL"
  type        = string
  sensitive   = true
}

variable "master_password" {
  description = "Master password for PostgreSQL"
  type        = string
  sensitive   = true
}

variable "subnet_ids" {
  description = "Subnet IDs for the DB subnet group"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for the database"
  type        = string
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Backup retention period in days"
  type        = number
  default     = 30
}

variable "deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
}

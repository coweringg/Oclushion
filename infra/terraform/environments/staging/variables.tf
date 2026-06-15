variable "db_master_username" {
  description = "Master username for staging PostgreSQL"
  type        = string
  sensitive   = true
}

variable "db_master_password" {
  description = "Master password for staging PostgreSQL"
  type        = string
  sensitive   = true
}

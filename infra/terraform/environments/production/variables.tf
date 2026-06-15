variable "db_master_username" {
  description = "Master username for production PostgreSQL"
  type        = string
  sensitive   = true
}

variable "db_master_password" {
  description = "Master password for production PostgreSQL"
  type        = string
  sensitive   = true
}

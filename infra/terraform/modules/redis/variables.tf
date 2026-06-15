variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "node_type" {
  description = "ElastiCache node type"
  type        = string
}

variable "num_cache_nodes" {
  description = "Number of cache nodes"
  type        = number
}

variable "subnet_ids" {
  description = "Subnet IDs for the cache subnet group"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for Redis"
  type        = string
}

variable "apply_immediately" {
  description = "Apply changes immediately"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Common tags"
  type        = map(string)
}

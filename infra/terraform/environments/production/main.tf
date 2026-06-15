module "network" {
  source = "../../modules/network"

  environment = "production"
  vpc_cidr    = "10.0.0.0/16"

  availability_zones   = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnet_cidrs  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  tags = {
    Environment = "production"
    Project     = "Oclushion"
    ManagedBy   = "Terraform"
  }
}

module "postgres" {
  source = "../../modules/postgres"

  environment           = "production"
  instance_class        = "db.t4g.small"
  allocated_storage     = 20
  multi_az              = true
  backup_retention_days = 30
  deletion_protection   = true

  master_username   = var.db_master_username
  master_password   = var.db_master_password
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.database_security_group_id

  tags = {
    Environment = "production"
    Project     = "Oclushion"
  }
}

module "redis" {
  source = "../../modules/redis"

  environment     = "production"
  node_type       = "cache.t4g.small"
  num_cache_nodes = 2

  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.redis_security_group_id

  tags = {
    Environment = "production"
    Project     = "Oclushion"
  }
}

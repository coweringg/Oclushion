module "network" {
  source = "../../modules/network"

  environment = "staging"
  vpc_cidr   = "10.1.0.0/16"

  availability_zones  = ["us-east-1a", "us-east-1b"]
  private_subnet_cidrs = ["10.1.1.0/24", "10.1.2.0/24"]
  public_subnet_cidrs  = ["10.1.101.0/24", "10.1.102.0/24"]

  tags = {
    Environment = "staging"
    Project     = "Oclushion"
    ManagedBy   = "Terraform"
  }
}

module "postgres" {
  source = "../../modules/postgres"

  environment       = "staging"
  instance_class    = "db.t4g.micro"
  allocated_storage = 10
  multi_az          = false
  backup_retention_days = 7
  deletion_protection   = false

  master_username   = var.db_master_username
  master_password   = var.db_master_password
  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.database_security_group_id

  tags = {
    Environment = "staging"
    Project     = "Oclushion"
  }
}

module "redis" {
  source = "../../modules/redis"

  environment    = "staging"
  node_type      = "cache.t4g.micro"
  num_cache_nodes = 1

  subnet_ids        = module.network.private_subnet_ids
  security_group_id = module.network.redis_security_group_id

  tags = {
    Environment = "staging"
    Project     = "Oclushion"
  }
}

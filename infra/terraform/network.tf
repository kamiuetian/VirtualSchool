resource "aws_vpc" "staging" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "${local.resource_prefix}-vpc" }
}

resource "aws_internet_gateway" "staging" {
  vpc_id = aws_vpc.staging.id
  tags   = { Name = "${local.resource_prefix}-igw" }
}

resource "aws_subnet" "public" {
  for_each = { for index, az in var.availability_zones : az => index }

  vpc_id                  = aws_vpc.staging.id
  availability_zone       = each.key
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, each.value)
  map_public_ip_on_launch = true

  tags = { Name = "${local.resource_prefix}-public-${each.key}" }
}

resource "aws_subnet" "private" {
  for_each = { for index, az in var.availability_zones : az => index }

  vpc_id            = aws_vpc.staging.id
  availability_zone = each.key
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, each.value + 100)

  tags = { Name = "${local.resource_prefix}-private-${each.key}" }
}

resource "aws_eip" "nat" {
  domain = "vpc"
  tags   = { Name = "${local.resource_prefix}-nat" }

  depends_on = [aws_internet_gateway.staging]
}

resource "aws_nat_gateway" "staging" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[var.availability_zones[0]].id
  tags          = { Name = "${local.resource_prefix}-nat" }

  depends_on = [aws_internet_gateway.staging]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.staging.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.staging.id
  }

  tags = { Name = "${local.resource_prefix}-public" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.staging.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.staging.id
  }

  tags = { Name = "${local.resource_prefix}-private" }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private.id
}

resource "aws_security_group" "ecs" {
  name        = "${local.resource_prefix}-ecs"
  description = "Egress for staging ECS workloads"
  vpc_id      = aws_vpc.staging.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "data" {
  name        = "${local.resource_prefix}-data"
  description = "Database and Redis access from ECS only"
  vpc_id      = aws_vpc.staging.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  ingress {
    description     = "Redis from ECS"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }
}

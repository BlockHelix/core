# Private subnets for OpenClaw agent containers
# Agents run in isolated containers with no public IP
# Outbound internet via NAT Gateway (for Claude API, GitHub, etc.)

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = data.aws_vpc.default.id
  cidr_block        = cidrsubnet(data.aws_vpc.default.cidr_block, 8, 200 + count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  map_public_ip_on_launch = false

  tags = {
    Name = "${local.name_prefix}-private-${count.index}"
  }
}

resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-nat-eip"
  }
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = tolist(data.aws_subnets.default.ids)[0]

  tags = {
    Name = "${local.name_prefix}-nat"
  }
}

resource "aws_route_table" "private" {
  vpc_id = data.aws_vpc.default.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${local.name_prefix}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# NACL to block IMDS and ECS metadata endpoints (SSRF defense)
# All link-local denied on all protocols — covers EC2 IMDS (169.254.169.254),
# ECS task metadata (169.254.170.2), and any future metadata services.
resource "aws_network_acl" "private" {
  vpc_id     = data.aws_vpc.default.id
  subnet_ids = aws_subnet.private[*].id

  # Deny all outbound to IPv4 link-local (IMDS, ECS metadata, etc.)
  egress {
    rule_no    = 50
    protocol   = "-1"
    action     = "deny"
    cidr_block = "169.254.0.0/16"
    from_port  = 0
    to_port    = 0
  }

  # Deny all outbound to IPv6 link-local (defensive, even if IPv6 not enabled)
  egress {
    rule_no         = 51
    protocol        = "-1"
    action          = "deny"
    ipv6_cidr_block = "fe80::/10"
    from_port       = 0
    to_port         = 0
  }

  # Allow all other outbound (SG handles fine-grained filtering)
  egress {
    rule_no    = 100
    protocol   = "-1"
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  # Allow all inbound (SG handles fine-grained filtering)
  ingress {
    rule_no    = 100
    protocol   = "-1"
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }

  tags = {
    Name = "${local.name_prefix}-private-nacl"
  }
}

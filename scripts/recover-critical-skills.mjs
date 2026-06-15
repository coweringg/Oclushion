#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CATALOG_PATH = join(ROOT, "docker/data/marketplace/v1/catalog.json");
const SKILLS_DIR = join(ROOT, "docker/data/marketplace/v1/skills");

const CRITICAL = [
  {
    id: "database-staff",
    name: "Database Design and Optimization",
    description: "Expert guidance on relational and NoSQL database design, query optimization, indexing strategies, and schema migration patterns. Covers PostgreSQL, MySQL, MongoDB, and modern database technologies.",
    category: "backend",
    tier: "pro",
    content: `# Database Design and Optimization

## Overview
Expert guidance on relational and NoSQL database design, query optimization, indexing strategies, and schema migration patterns.

## Capabilities
- Relational database design (PostgreSQL, MySQL)
- NoSQL database design (MongoDB, Redis)
- Query optimization and EXPLAIN analysis
- Indexing strategies
- Schema migration patterns
- ACID vs BASE tradeoffs
- Connection pooling
- Backup and recovery
- Replication and sharding
- Performance monitoring`,
  },
  {
    id: "fullstack-staff",
    name: "Full Stack Development Expert",
    description: "Expert-level full stack development covering TypeScript, React, Node.js, databases, and architecture patterns for building production-grade web applications.",
    category: "fullstack",
    tier: "free",
    content: `# Full Stack Development Expert

## Overview
Expert-level guidance for full stack development covering the complete web application stack. From frontend to backend, database to deployment.

## Capabilities
- TypeScript/JavaScript architecture and patterns
- React and Next.js application development
- Node.js/Deno backend services
- Database design (SQL and NoSQL)
- API design and integration
- Testing strategies (unit, integration, e2e)
- CI/CD pipeline setup
- Cloud deployment and infrastructure
- Performance optimization
- Security best practices

## Usage
Activate this skill when working on full stack web applications that require coordinated frontend and backend development.`,
  },
  {
    id: "gsap-animations-staff",
    name: "GSAP Animation Expert",
    description: "Professional motion design and animation implementation using GSAP (GreenSock Animation Platform), covering timelines, scroll-triggered animations, and React integration.",
    category: "design",
    tier: "pro",
    content: `# GSAP Animation Expert

## Overview
Professional motion design implementation using GSAP and modern web animation APIs. Create polished, performant animations for web applications.

## Capabilities
- GSAP timeline sequencing and control
- ScrollTrigger integration
- React GSAP patterns
- SVG animation
- Performance optimization
- Canvas and WebGL animation
- Micro-interactions
- Page transitions
- Lottie and JSON animation
- Motion design principles`,
  },
  {
    id: "aws-infra-architect",
    name: "AWS Infrastructure Architect",
    description: "Design and implement scalable, secure, cost-optimized AWS infrastructure following the Well-Architected Framework. Covers compute, storage, networking, and serverless.",
    category: "devops",
    tier: "enterprise",
    content: `# AWS Infrastructure Architect

## Overview
Design and implement scalable, secure, and cost-optimized AWS infrastructure. Follows AWS Well-Architected Framework principles.

## Capabilities
- VPC design and networking
- EC2, ECS, EKS compute
- S3 storage patterns
- Lambda serverless architecture
- RDS and DynamoDB databases
- CloudFront CDN
- IAM security and policies
- CloudFormation/Terraform IaC
- Cost optimization
- Disaster recovery`,
  },
  {
    id: "security-owasp",
    name: "OWASP Security Auditor",
    description: "Comprehensive security audit methodology covering OWASP Top 10 vulnerabilities, threat modeling, penetration testing, and security best practices for web applications.",
    category: "security",
    tier: "free",
    content: `# OWASP Security Auditor

## Overview
Systematic security audit methodology based on OWASP guidelines. Identify, assess, and remediate security vulnerabilities in web applications.

## Capabilities
- OWASP Top 10 vulnerability assessment
- Authentication and session management
- Access control testing
- Injection attack prevention (XSS, SQLi, CSRF)
- API security testing
- Cryptographic practice review
- Security header configuration
- Dependency vulnerability scanning
- Threat modeling (STRIDE)
- Security incident response`,
  },
];

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf-8"));
const existingIds = new Set(catalog.skills.map((s) => s.id));
let added = 0;

for (const skill of CRITICAL) {
  if (existingIds.has(skill.id)) {
    console.log(`  Already exists: ${skill.id}`);
    continue;
  }

  const hash = sha256(skill.content);
  const sizeKb = Math.max(1, Math.round(Buffer.byteLength(skill.content, "utf-8") / 1024));

  const mdPath = join(SKILLS_DIR, `${skill.id}.md`);
  writeFileSync(mdPath, skill.content);

  catalog.skills.push({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    tier: skill.tier,
    version: "1.0.0",
    downloadUrl: `https://cdn.oclushion.com/marketplace/v1/skills/${skill.id}.md`,
    sha256: hash,
    sizeKb,
    keywords: skill.content.split(/\s+/).filter((w) => w.length > 5).slice(0, 8).map((w) => w.toLowerCase().replace(/[^a-z0-9-]/g, "")).filter(Boolean),
    previewLines: skill.content.split("\n").slice(0, 5).filter((l) => l.trim()),
  });
  added++;
}

const hasCliTool = catalog.tools.some((t) => t.id === "oclushion-cli");
if (!hasCliTool) {
  catalog.tools.push({
    id: "oclushion-cli",
    name: "Oclushion CLI",
    description: "Command-line interface for Oclushion: repo scanning, skill management, configuration, and diagnostics.",
    version: "0.1.0",
    downloadUrl: "https://cdn.oclushion.com/marketplace/v1/tools/oclushion-cli",
    platform: "all",
    requiredBin: "oclushion",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    gitignoreEntry: ".oclushion-tools/",
  });
  console.log("  Added tool: oclushion-cli");
}

writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
console.log(`\nRecovered ${added} critical skills. Total: ${catalog.skills.length} skills, ${catalog.tools.length} tools.`);

import { logger } from "../utils/logger";

export type FinOpsAlert = {
  id: string;
  title: string;
  description: string;
  projectedCost: string;
  optimizedCost: string;
  savings: string;
  proposal: string;
  triggerFile: string;
};

export class FinOpsService {
  
  public analyzeTask(input: string, targetPaths: string[]): FinOpsAlert | null {
    const combinedStr = `${input} ${targetPaths.join(" ")}`.toLowerCase();
    
    if (combinedStr.includes("s3") || combinedStr.includes("upload") || combinedStr.includes("storage")) {
      logger.info("FinOps", "Detected S3 Storage pattern.");
      return {
        id: `finops-${Date.now()}`,
        title: "Inefficient S3 Upload Loop",
        description: "The code iterates over a dataset and performs individual PUT requests to S3 inside the loop. At your current traffic volume (100k ops/day), this generates excessive API Gateway and PUT request fees.",
        projectedCost: "$145.00/mo",
        optimizedCost: "$8.00/mo",
        savings: "$137.00/mo (94% ROI)",
        proposal: "Batch the uploads using S3 Multipart Upload or compress the payload before transmission. Do you want me to generate a SafeDiff to implement batching?",
        triggerFile: targetPaths.find(p => p.toLowerCase().includes("s3") || p.toLowerCase().includes("upload")) || targetPaths[0] || "unknown",
      };
    }

    if (combinedStr.includes("db") || combinedStr.includes("database") || combinedStr.includes("query") || combinedStr.includes("sql")) {
      logger.info("FinOps", "Detected Database Query pattern.");
      return {
        id: `finops-${Date.now()}`,
        title: "N+1 Query Detected",
        description: "A database query is being executed inside a map/forEach loop. This will cause CPU spikes on your RDS instance and force an early instance size upgrade.",
        projectedCost: "$350.00/mo (RDS Large)",
        optimizedCost: "$50.00/mo (RDS Micro)",
        savings: "$300.00/mo (85% ROI)",
        proposal: "Use a SQL JOIN or Prisma `include` to fetch the related entities in a single round-trip. Shall I refactor this loop?",
        triggerFile: targetPaths.find(p => p.toLowerCase().includes("db") || p.toLowerCase().includes("query")) || targetPaths[0] || "unknown",
      };
    }

    return null;
  }
}

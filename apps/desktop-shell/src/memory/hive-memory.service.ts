import { logger } from "../utils/logger";

export type HiveInsight = {
  id: string;
  sourceProject: string;
  author: string;
  keywords: string[];
  lesson: string;
  createdAt: string;
};

export class HiveMemoryService {
  private insights: HiveInsight[] = [];

  public constructor() {
    this.insights.push({
      id: "hive-1",
      sourceProject: "api-gateway",
      author: "@santiago.backend",
      keywords: ["auth", "jwt", "token", "refresh", "401"],
      lesson: "When fixing the token refresh loop, ensure the interceptor clears the queue before retrying, otherwise simultaneous requests will trigger multiple refresh calls and invalidate the newly issued token.",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    });

    this.insights.push({
      id: "hive-2",
      sourceProject: "frontend-web",
      author: "@maria.ui",
      keywords: ["safari", "css", "flexbox", "gap", "bug"],
      lesson: "Safari has a bug where flex gap combined with percentage heights causes the container to collapse. Fix it by wrapping the flex items in a div with height: 100% instead of applying it to the flex container.",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  public publish(insight: Omit<HiveInsight, "id" | "createdAt">): void {
    const newInsight: HiveInsight = {
      ...insight,
      id: `hive-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.insights.push(newInsight);
    logger.info("HiveMemory", `Published new insight from ${insight.sourceProject}`);
  }

  public search(query: string, currentProject: string): HiveInsight[] {
    const lowerQuery = query.toLowerCase();
    
    const matches = this.insights.filter(insight => {
      if (insight.sourceProject === currentProject) return false;

      const hasKeywordMatch = insight.keywords.some(kw => lowerQuery.includes(kw));
      const hasLessonMatch = insight.lesson.toLowerCase().includes(lowerQuery);
      
      return hasKeywordMatch || hasLessonMatch;
    });

    return matches;
  }
}

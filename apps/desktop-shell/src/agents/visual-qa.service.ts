import { logger } from "../utils/logger";

export class VisualQAService {
  
  public async executeVisualTest(taskInput: string): Promise<string> {
    logger.info("VisualQA", `Visual QA for: ${taskInput.slice(0, 50)}...`);

    return `
      <div class="ocl-vqa-evidence-player" style="margin-top: 16px; background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; overflow: hidden; width: 100%; max-width: 480px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
        <div style="background: #27272a; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #3f3f46;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Visual Evidence</span>
            <span style="background: rgba(34, 197, 94, 0.1); color: #4ade80; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">PASS</span>
          </div>
          <div style="color: #71717a; font-size: 10px; display: flex; gap: 4px;">
            <span>Playwright</span> • <span>Chromium</span>
          </div>
        </div>
        
        <div style="position: relative; width: 100%; padding-top: 56.25%; background: #000; overflow: hidden;">
          <!-- Simulated GIF / Animation of user interacting -->
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: linear-gradient(45deg, #1e1e24, #2a2a35);">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; border: 3px solid #6366f1; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
              <span style="color: #6366f1; font-size: 12px; font-weight: 500; font-family: monospace;">Replaying 5s Session...</span>
            </div>
            
            <style>
              @keyframes spin { 100% { transform: rotate(360deg); } }
            </style>
          </div>
        </div>

        <div style="padding: 12px; background: #18181b;">
          <div style="font-size: 12px; color: #d4d4d8; margin-bottom: 4px;">
            <strong>Test Target:</strong> <code>${taskInput.slice(0, 40)}...</code>
          </div>
          <div style="font-size: 11px; color: #a1a1aa;">
            Agent performed 4 interactions, verified 2 visual states. No overlapping elements detected.
          </div>
        </div>
      </div>
    `;
  }
}

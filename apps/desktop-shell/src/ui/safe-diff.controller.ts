import { BaseController, type ControllerContext } from "./controller";
import { ChatDiffRenderer, type ChatDiffState } from "./renderers/chat-diff.renderer";
import { SafeDiffRenderer, type SafeDiffEditorState } from "./renderers/safe-diff.renderer";
import type { SafeDiffProposal } from "../safe-diff.service";
import { SanoShield } from "../sano-shield.service";
import { logger } from "../utils/logger";

export class SafeDiffController extends BaseController {
  private chatRenderer = new ChatDiffRenderer();
  private editorRenderer = new SafeDiffRenderer();
  private sanoShield = new SanoShield();
  
  private proposals: SafeDiffProposal[] = [];
  
  private chatContainer: HTMLElement;
  private editorContainer: HTMLElement;

  public constructor(context: ControllerContext) {
    super(context);
    
    this.chatContainer = document.createElement("div");
    this.chatContainer.id = "chat-diff-container";
    
    this.editorContainer = document.createElement("div");
    this.editorContainer.id = "editor-diff-container";
    
    document.body.appendChild(this.chatContainer);
    document.body.appendChild(this.editorContainer);
  }

  public async mount(): Promise<void> {
    await this.sanoShield.init();

    this.chatContainer.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      
      if (target.id === "btn-accept-all") {
        this.acceptAll();
      } else if (target.id === "btn-reject-all") {
        this.rejectAll();
      } else {
        const fileItem = target.closest(".ocl-file-item") as HTMLElement;
        if (fileItem && fileItem.dataset.proposalId) {
          this.openProposalInEditor(fileItem.dataset.proposalId);
        }
      }
    });

    this.editorContainer.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      
      if (target.dataset.action === "accept-file" && target.dataset.id) {
        this.updateProposalStatus(target.dataset.id!, "approved");
      } else if (target.dataset.action === "reject-file" && target.dataset.id) {
        this.updateProposalStatus(target.dataset.id!, "rejected");
      } else if (target.dataset.action === "accept-chunk" && target.dataset.id) {
        this.updateChunkStatus(target.dataset.id!, "approved");
      } else if (target.dataset.action === "reject-chunk" && target.dataset.id) {
        this.updateChunkStatus(target.dataset.id!, "rejected");
      }
    });
  }

  public loadProposals(proposals: SafeDiffProposal[]): void {
    this.proposals = proposals;
    this.updateChatView();
    if (this.proposals.length > 0 && this.proposals[0]) {
      this.openProposalInEditor(this.proposals[0].id);
    }
  }

  private openProposalInEditor(proposalId: string): void {
    const proposal = this.proposals.find(p => p.id === proposalId);
    if (!proposal) return;

    const securityWarnings: string[] = [];
    for (const chunk of proposal.chunks) {
      const result = this.sanoShield.sanitize(chunk.newContent);
      if (result.mappings.length > 0) {
        const types = result.mappings.map(m => m.type);
        securityWarnings.push(`Detected sensitive data: ${[...new Set(types)].join(", ")}`);
      }
    }

    this.editorRenderer.render(this.editorContainer, {
      proposal,
      securityWarnings
    });
  }

  private acceptAll(): void {
    this.proposals.forEach(p => {
      p.status = "approved";
      p.chunks.forEach(c => c.status = "approved");
    });
    this.updateChatView();
    const currentOpen = this.proposals.find(p => p.status === "pending") || this.proposals[0];
    if (currentOpen) this.openProposalInEditor(currentOpen.id);
    
    logger.info("SafeDiff", "Accepted all AI changes");
  }

  private rejectAll(): void {
    this.proposals.forEach(p => {
      p.status = "rejected";
      p.chunks.forEach(c => c.status = "rejected");
    });
    this.updateChatView();
    const currentOpen = this.proposals.find(p => p.status === "pending") || this.proposals[0];
    if (currentOpen) this.openProposalInEditor(currentOpen.id);
    
    logger.info("SafeDiff", "Rejected all AI changes");
  }

  private updateProposalStatus(proposalId: string, status: "approved" | "rejected"): void {
    const p = this.proposals.find(x => x.id === proposalId);
    if (p) {
      p.status = status;
      p.chunks.forEach(c => c.status = status);
      this.updateChatView();
    }
  }

  private updateChunkStatus(chunkId: string, status: "approved" | "rejected"): void {
    for (const p of this.proposals) {
      const chunk = p.chunks.find(c => c.id === chunkId);
      if (chunk) {
        chunk.status = status;
        if (p.chunks.every(c => c.status === "approved")) {
          p.status = "approved";
        } else if (p.chunks.every(c => c.status === "rejected")) {
          p.status = "rejected";
        }
        this.updateChatView();
        break;
      }
    }
  }

  private updateChatView(): void {
    const allApproved = this.proposals.every(p => p.status === "approved");
    const allRejected = this.proposals.every(p => p.status === "rejected");
    const anyPending = this.proposals.some(p => p.status === "pending");

    let globalStatus: "pending" | "approved" | "rejected" = "pending";
    if (!anyPending) {
      globalStatus = allApproved ? "approved" : "rejected";
    }

    this.chatRenderer.render(this.chatContainer, {
      proposals: this.proposals,
      globalStatus
    });
  }
}

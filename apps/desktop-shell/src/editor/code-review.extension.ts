export type ReviewCommentDisplay = {
  id: string;
  authorId: string;
  authorName: string;
  message: string;
  lineNumber: number;
  codeSnippet: string;
  status: "open" | "resolved";
  createdAt: string;
};

export function createCodeReviewExtension(
  comments: ReviewCommentDisplay[],
  onTriggerAI: (commentId: string) => void
) {
  const { StateField, StateEffect } = require("@codemirror/state");
  const { Decoration, WidgetType, EditorView } = require("@codemirror/view");

  class ReviewWidget extends WidgetType {
    constructor(private readonly comment: ReviewCommentDisplay) {
      super();
    }

    eq(other: ReviewWidget) {
      return other.comment.id === this.comment.id;
    }

    toDOM() {
      const wrap = document.createElement("div");
      wrap.style.padding = "8px 12px";
      wrap.style.margin = "4px 0";
      wrap.style.backgroundColor = "#2d2d30";
      wrap.style.borderLeft = "4px solid #E91E63";
      wrap.style.borderRadius = "4px";
      wrap.style.fontFamily = "var(--font-sans)";
      wrap.style.fontSize = "13px";
      wrap.style.display = "flex";
      wrap.style.justifyContent = "space-between";
      wrap.style.alignItems = "center";
      wrap.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";

      const content = document.createElement("div");
      
      const author = document.createElement("strong");
      author.textContent = this.comment.authorName + ": ";
      author.style.color = "#ccc";
      
      const text = document.createElement("span");
      text.textContent = this.comment.message;
      text.style.color = "#fff";

      content.appendChild(author);
      content.appendChild(text);

      const btn = document.createElement("button");
      btn.textContent = "✨ Fix with AI";
      btn.style.background = "linear-gradient(45deg, #FF007A, #7928CA)";
      btn.style.color = "white";
      btn.style.border = "none";
      btn.style.padding = "4px 12px";
      btn.style.borderRadius = "4px";
      btn.style.cursor = "pointer";
      btn.style.fontWeight = "bold";
      btn.style.transition = "transform 0.1s ease";
      
      btn.onmouseenter = () => btn.style.transform = "scale(1.05)";
      btn.onmouseleave = () => btn.style.transform = "scale(1)";
      
      btn.onclick = (e) => {
        e.preventDefault();
        onTriggerAI(this.comment.id);
      };

      wrap.appendChild(content);
      wrap.appendChild(btn);

      return wrap;
    }
  }

  const setComments = StateEffect.define();

  const reviewField = StateField.define({
    create() {
      return Decoration.none;
    },
    update(decorations: any, tr: any) {
      decorations = decorations.map(tr.changes);
      
      for (const e of tr.effects) {
        if (e.is(setComments)) {
          const builder: any[] = [];
          for (const c of e.value) {
            if (c.status === "open") {
              const pos = tr.state.doc.line(c.lineNumber).to;
              builder.push(Decoration.widget({
                widget: new ReviewWidget(c),
                block: true,
                side: 1
              }).range(pos));
            }
          }
          builder.sort((a, b) => a.from - b.from);
          return Decoration.set(builder);
        }
      }
      return decorations;
    },
    provide: (f: any) => EditorView.decorations.from(f)
  });

  return { reviewField, setComments };
}

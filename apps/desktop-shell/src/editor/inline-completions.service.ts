import type { Extension } from "@codemirror/state";
import { StateField, StateEffect, EditorSelection } from "@codemirror/state";
import { EditorView, keymap, Decoration, WidgetType, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { ModelRouter } from "../llm/model-router";
import { SanoShield } from "../sano-shield.service";
import { logger } from "../utils/logger";

const DEBOUNCE_MS = 300;
const MAX_COMPLETION_LENGTH = 256;
const GHOST_CLASS = "ocl-ghost-text";

interface CompletionState {
  text: string;
  from: number;
  to: number;
  active: boolean;
}

const emptyCompletion: CompletionState = {
  text: "",
  from: 0,
  to: 0,
  active: false,
};

const setCompletionEffect = StateEffect.define<CompletionState>();

const completionField = StateField.define<CompletionState>({
  create: () => emptyCompletion,
  update(state, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setCompletionEffect)) {
        return effect.value;
      }
    }
    return state;
  },
});

class GhostTextWidget extends WidgetType {
  constructor(private readonly text: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = GHOST_CLASS;
    span.textContent = this.text;
    span.style.opacity = "0.5";
    span.style.pointerEvents = "none";
    span.style.userSelect = "none";
    return span;
  }

  override eq(other: GhostTextWidget): boolean {
    return other.text === this.text;
  }

  override updateDOM(): boolean {
    return false;
  }
}

class GhostTextPlugin {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

  constructor(
    private readonly view: EditorView,
    private readonly modelRouter: ModelRouter,
    private readonly shield: SanoShield,
  ) {}

  update(update: ViewUpdate) {
    if (!update.docChanged) return;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.abortController?.abort();

    this.debounceTimer = setTimeout(() => {
      void this.fetchCompletion();
    }, DEBOUNCE_MS);
  }

  destroy() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.abortController?.abort();
  }

  private async fetchCompletion() {
    const state = this.view.state;
    const cursor = state.selection.main.head;
    const line = state.doc.lineAt(cursor);

    if (cursor < line.to) return;

    const contextStart = Math.max(0, cursor - 500);
    const context = state.doc.toString().slice(contextStart, cursor);

    if (context.trim().length < 5) return;

    this.abortController = new AbortController();

    try {
      const shielded = this.shield.sanitize(context);

      const response = await this.modelRouter.generate({
        model: "gpt-4o-mini",
        systemPrompt:
          "You are a code completion engine. Continue the following code naturally. Only provide the completion text, no explanations.",
        userMessage: shielded.sanitizedText,
        messages: [],
      });

      const completionText = this.shield.restore(response.content, shielded.mappings);
      const truncated = completionText.slice(0, MAX_COMPLETION_LENGTH);

      if (truncated.trim().length > 0) {
        this.view.dispatch({
          effects: setCompletionEffect.of({
            text: truncated,
            from: cursor,
            to: cursor,
            active: true,
          }),
        });
      }
    } catch (error) {
      logger.debug("InlineCompletion", "Failed to fetch completion", error);
    }
  }
}

const ghostTextMark = EditorView.decorations.compute([completionField], (state) => {
  const completion = state.field(completionField);
  if (!completion.active || !completion.text) {
    return Decoration.none;
  }

  const widget = new GhostTextWidget(completion.text);
  return Decoration.set([
    Decoration.widget({
      widget,
      side: 1,
    }).range(completion.from),
  ]);
});

const inlineCompletionKeymap = keymap.of([
  {
    key: "Tab",
    run: (view) => {
      const completion = view.state.field(completionField);
      if (!completion.active) return false;

      view.dispatch({
        changes: { from: completion.from, to: completion.to, insert: completion.text },
        effects: setCompletionEffect.of(emptyCompletion),
        selection: EditorSelection.cursor(completion.from + completion.text.length),
      });
      return true;
    },
  },
  {
    key: "Escape",
    run: (view) => {
      const completion = view.state.field(completionField);
      if (!completion.active) return false;

      view.dispatch({
        effects: setCompletionEffect.of(emptyCompletion),
      });
      return true;
    },
  },
]);

export function inlineCompletions(modelRouter: ModelRouter, shield: SanoShield): Extension[] {
  const plugin = ViewPlugin.fromClass(
    class {
      private ghost: GhostTextPlugin;
      constructor(v: EditorView) {
        this.ghost = new GhostTextPlugin(v, modelRouter, shield);
      }
      update(update: ViewUpdate) {
        this.ghost.update(update);
      }
      destroy() {
        this.ghost.destroy();
      }
    }
  );

  return [completionField, ghostTextMark, inlineCompletionKeymap, plugin];
}

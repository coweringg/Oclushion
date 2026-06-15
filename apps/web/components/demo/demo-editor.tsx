"use client";

import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

import { DEMO_SAMPLE_CODE } from "./demo-types";

export function DemoEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return;

    const startState = EditorState.create({
      doc: DEMO_SAMPLE_CODE,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        bracketMatching(),
        indentOnInput(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        javascript({ typescript: true }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        oneDark,
        EditorView.theme({
          "&": { height: "100%", fontSize: "13px" },
          ".cm-scroller": { overflow: "auto" },
        }),
        EditorView.editable.of(true),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  const resetCode = () => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: DEMO_SAMPLE_CODE },
    });
  };

  return (
    <div className="demo-editor">
      <div className="demo-editor-header">
        <span className="demo-editor-title">main.ts</span>
        <button className="demo-editor-reset" type="button" onClick={resetCode}>
          Reset
        </button>
      </div>
      <div ref={containerRef} className="demo-editor-cm" />
    </div>
  );
}

import { EditorState, StateEffect } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import type * as Y from "yjs";
import type { WebsocketProvider } from "y-websocket";

import type { CollaborationUser } from "./multiplayer.types";

const remoteUpdate = StateEffect.define<string>();

export function configureCollaborativeEditor(input: {
  ytext: Y.Text;
  provider: WebsocketProvider;
  localUser: CollaborationUser;
}) {
  input.provider.awareness.setLocalStateField("user", {
    name: input.localUser.name,
    color: input.localUser.color,
    type: input.localUser.type,
  });
  let applyingRemote = false;
  return [
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (!update.docChanged || applyingRemote) {
        return;
      }
      input.ytext.delete(0, input.ytext.length);
      input.ytext.insert(0, update.state.doc.toString());
    }),
    EditorView.domEventHandlers({
      focus: (_event, view) => {
        syncFromYText(view, input.ytext, (flag) => {
          applyingRemote = flag;
        });
      },
    }),
    EditorState.transactionExtender.of((transaction) => {
      const effect = transaction.effects.find((candidate) => candidate.is(remoteUpdate));
      if (!effect) {
        return null;
      }
      return { effects: StateEffect.appendConfig.of([]) };
    }),
  ];
}

export function syncFromYText(
  view: EditorView,
  ytext: Y.Text,
  setApplyingRemote: (value: boolean) => void,
): void {
  const remote = ytext.toString();
  if (remote === view.state.doc.toString()) {
    return;
  }
  setApplyingRemote(true);
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: remote } });
  setApplyingRemote(false);
}

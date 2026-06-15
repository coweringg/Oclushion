"use client";

import { useState, useCallback } from "react";

import type { DemoTerminalLine } from "./demo-types";
import { DEMO_TERMINAL_LINES } from "./demo-types";

export function DemoTerminal() {
  const [lines, setLines] = useState<DemoTerminalLine[]>(DEMO_TERMINAL_LINES);
  const [command, setCommand] = useState("");

  const executeCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      const inputLine: DemoTerminalLine = {
        id: `input-${Date.now()}`,
        text: `$ ${trimmed}`,
        type: "input",
      };

      const outputLine: DemoTerminalLine = {
        id: `output-${Date.now()}`,
        text: `oclushion: running in demo sandbox — command simulated`,
        type: "info",
      };

      setLines((prev) => [...prev, inputLine, outputLine]);
      setCommand("");
    },
    [],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(command);
  };

  const clearTerminal = () => {
    setLines([]);
  };

  return (
    <div className="demo-terminal">
      <div className="demo-terminal-header">
        <span className="demo-terminal-title">Terminal</span>
        <button className="demo-terminal-clear" type="button" onClick={clearTerminal}>
          Clear
        </button>
      </div>
      <div className="demo-terminal-output" role="log" aria-live="polite">
        {lines.map((line) => (
          <div key={line.id} className={`demo-terminal-line ${line.type}`}>
            <span className="demo-terminal-prefix">
              {line.type === "input" ? "$" : line.type === "error" ? "!" : " "}
            </span>
            <span>{line.text}</span>
          </div>
        ))}
      </div>
      <form className="demo-terminal-input-row" onSubmit={handleSubmit}>
        <span className="demo-terminal-prompt">$</span>
        <input
          className="demo-terminal-input"
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Type a command..."
          aria-label="Terminal command"
        />
      </form>
    </div>
  );
}

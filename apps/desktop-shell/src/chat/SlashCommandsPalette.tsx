import { useState } from "react";
import { SlashCommandsService } from "../chat/slash-commands.service";

interface SlashCommandsPaletteProps {
  commandsService: SlashCommandsService;
  onSelect: (command: string) => void;
  query: string;
}

export function SlashCommandsPalette({ commandsService, onSelect, query }: SlashCommandsPaletteProps) {
  const allCommands = commandsService.getAllCommands();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = allCommands.filter(
    (cmd) => cmd.name.includes(query) || cmd.description.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = filtered[selectedIndex];
      if (selected) {
        onSelect(selected.name);
      }
    } else if (e.key === "Escape") {
      onSelect("");
    }
  };

  if (filtered.length === 0) return null;

  return (
    <div className="slash-commands-palette" onKeyDown={handleKeyDown}>
      <ul>
        {filtered.map((cmd, index) => (
          <li
            key={cmd.name}
            className={index === selectedIndex ? "selected" : ""}
            onClick={() => onSelect(cmd.name)}
          >
            <span className="cmd-name">{cmd.name}</span>
            <span className="cmd-desc">{cmd.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

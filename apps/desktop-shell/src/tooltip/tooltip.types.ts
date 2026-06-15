export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export type TooltipContent = {
  title: string;
  description: string;
};

export type TooltipOptions = {
  placement: TooltipPlacement;
  delayMs: number;
  maxWidth: number;
};

export type TooltipTrigger = "hover" | "focus" | "both";

export const DEFAULT_TOOLTIP_OPTIONS: TooltipOptions = {
  placement: "bottom",
  delayMs: 400,
  maxWidth: 280,
};

export type TourStep = {
  id: string;
  target: string;
  title: string;
  content: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  disableOverlayClick?: boolean;
  onShow?: (el: HTMLElement) => void | Promise<void>;
};

export type TourConfig = {
  id: string;
  name: string;
  steps: TourStep[];
  autoStart?: boolean;
  allowSkip?: boolean;
  allowRestart?: boolean;
  storageKey?: string;
};

export type TourState = {
  isActive: boolean;
  currentStepIndex: number;
  completed: boolean;
  skipped: boolean;
  lastStartedAt?: string;
  completedAt?: string;
  version: number;
};

export const TOUR_ROLE = "dialog";
export const TOARIA_LABELLED_BY = "tour-title";
export const TOARIA_DESCRIBED_BY = "tour-content";

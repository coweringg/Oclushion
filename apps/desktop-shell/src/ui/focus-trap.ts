const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
}

export function createFocusTrap(container: HTMLElement): () => void {
  const previouslyFocused = document.activeElement as HTMLElement;

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Tab") return;

    const elements = getFocusableElements(container);
    if (elements.length === 0) return;

    const firstEl = elements[0] as HTMLElement;
    const lastEl = elements[elements.length - 1] as HTMLElement;

    if (event.shiftKey) {
      if (document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      }
    } else {
      if (document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }
  };

  container.addEventListener("keydown", handleKeyDown);

  const elements = getFocusableElements(container);
  if (elements.length > 0) {
    (elements[0] as HTMLElement).focus();
  }

  return () => {
    container.removeEventListener("keydown", handleKeyDown);
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
  };
}

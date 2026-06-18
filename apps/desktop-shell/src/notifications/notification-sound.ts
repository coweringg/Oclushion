declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

function createAudioContext(): AudioContext | null {
  const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextConstructor) {
    return null;
  }
  return new AudioContextConstructor();
}

function scheduleCleanup(ctx: AudioContext, delayMs: number): void {
  window.setTimeout(() => void ctx.close().catch(() => undefined), delayMs);
}

export function playSuccessSound(): void {
  const ctx = createAudioContext();
  if (!ctx) return;

  const notes = [523, 659, 784];
  const noteDuration = 0.12;
  const totalDuration = 0.5;

  notes.forEach((freq, i) => {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * noteDuration);

    gainNode.gain.setValueAtTime(0.25, ctx.currentTime + i * noteDuration);
    gainNode.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * noteDuration + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + totalDuration);

    oscillator.start(ctx.currentTime + i * noteDuration);
    oscillator.stop(ctx.currentTime + totalDuration);
  });

  scheduleCleanup(ctx, 650);
}

export function playErrorSound(): void {
  const ctx = createAudioContext();
  if (!ctx) return;

  const beepDelay = 0.12;
  const beepDuration = 0.08;

  for (let i = 0; i < 3; i++) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime + i * beepDelay);

    gainNode.gain.setValueAtTime(0.08, ctx.currentTime + i * beepDelay);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * beepDelay + beepDuration);

    oscillator.start(ctx.currentTime + i * beepDelay);
    oscillator.stop(ctx.currentTime + i * beepDelay + beepDuration);
  }

  scheduleCleanup(ctx, 500);
}

export function playCompletionSound(): void {
  playSuccessSound();
}

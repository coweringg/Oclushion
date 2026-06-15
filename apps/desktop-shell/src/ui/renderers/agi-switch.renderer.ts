export type AgiSwitchState = {
  isActive: boolean;
};

export class AgiSwitchRenderer {
  public render(container: HTMLElement, state: AgiSwitchState): void {
    const activeClass = state.isActive ? "active" : "";
    
    container.innerHTML = `
      <div class="ocl-agi-switch-container">
        <span class="ocl-agi-label ${activeClass}">AGI MODE</span>
        <div class="ocl-agi-toggle ${activeClass}" id="agi-toggle-btn">
          <div class="ocl-agi-knob"></div>
        </div>
      </div>
    `;
  }
}

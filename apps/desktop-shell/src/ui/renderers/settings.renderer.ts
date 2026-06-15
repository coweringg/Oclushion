export type SettingsState = {
  isOfflineMode: boolean;
  localModels: string[];
  selectedLocalModel: string;
  openaiKey: string;
  anthropicKey: string;
  isOpen: boolean;
};

export class SettingsRenderer {
  public render(container: HTMLElement, state: SettingsState): void {
    if (!state.isOpen) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }

    container.style.display = "flex";
    
    container.innerHTML = `
      <style>
        .ocl-settings-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ocl-settings-modal {
          background: #0d0d12;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 500px;
          max-width: 90vw;
          color: #f8fafc;
          font-family: 'Inter', system-ui, sans-serif;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }

        .ocl-settings-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ocl-settings-title {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ocl-settings-close {
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 20px;
          cursor: pointer;
          transition: color 0.2s;
        }

        .ocl-settings-close:hover {
          color: #f8fafc;
        }

        .ocl-settings-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .ocl-settings-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .ocl-settings-section-title {
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #64748b;
          font-weight: 700;
        }

        .ocl-toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: ${state.isOfflineMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255, 255, 255, 0.02)'};
          border: 1px solid ${state.isOfflineMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.05)'};
          border-radius: 8px;
          transition: all 0.3s;
        }

        .ocl-toggle-info h4 {
          margin: 0 0 4px 0;
          font-size: 15px;
          color: ${state.isOfflineMode ? '#10b981' : '#f8fafc'};
        }

        .ocl-toggle-info p {
          margin: 0;
          font-size: 12px;
          color: #94a3b8;
        }

        .ocl-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .ocl-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .ocl-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #334155;
          transition: .4s;
          border-radius: 34px;
        }

        .ocl-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }

        input:checked + .ocl-slider {
          background-color: #10b981;
        }

        input:checked + .ocl-slider:before {
          transform: translateX(20px);
        }

        .ocl-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ocl-input-group label {
          font-size: 13px;
          color: #cbd5e1;
        }

        .ocl-input {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f8fafc;
          padding: 10px 12px;
          border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          outline: none;
          transition: border-color 0.2s;
        }

        .ocl-input:focus {
          border-color: #10b981;
        }

        .ocl-input:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        select.ocl-input {
          cursor: pointer;
          appearance: none;
        }

        .ocl-settings-footer {
          padding: 16px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: rgba(0,0,0,0.2);
        }

        .ocl-btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .ocl-btn-primary {
          background: #10b981;
          color: white;
        }

        .ocl-btn-primary:hover {
          background: #059669;
        }
      </style>

      <div class="ocl-settings-overlay">
        <div class="ocl-settings-modal">
          <div class="ocl-settings-header">
            <div class="ocl-settings-title">⚙️ Ajustes de IA</div>
            <button class="ocl-settings-close" id="ocl-btn-close-settings">&times;</button>
          </div>

          <div class="ocl-settings-body">
            
            <div class="ocl-settings-section">
              <div class="ocl-settings-section-title">Privacidad</div>
              <div class="ocl-toggle-row">
                <div class="ocl-toggle-info">
                  <h4>Paranoid Mode (Offline)</h4>
                  <p>Apaga la nube. Todo se procesa localmente con Ollama.</p>
                </div>
                <label class="ocl-switch">
                  <input type="checkbox" id="ocl-toggle-offline" ${state.isOfflineMode ? 'checked' : ''}>
                  <span class="ocl-slider"></span>
                </label>
              </div>
            </div>

            <div class="ocl-settings-section" style="${!state.isOfflineMode ? 'opacity: 0.4; pointer-events: none;' : ''}">
              <div class="ocl-settings-section-title">Modelos Locales</div>
              <div class="ocl-input-group">
                <label>Modelo de Ollama</label>
                <select class="ocl-input" id="ocl-select-model">
                  ${state.localModels.length === 0 ? '<option value="">No se encontraron modelos</option>' : ''}
                  ${state.localModels.map(m => `<option value="${m}" ${m === state.selectedLocalModel ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="ocl-settings-section" style="${state.isOfflineMode ? 'opacity: 0.4; pointer-events: none;' : ''}">
              <div class="ocl-settings-section-title">Bring Your Own Key (Nube)</div>
              <div class="ocl-input-group">
                <label>OpenAI API Key</label>
                <input type="password" class="ocl-input" id="ocl-input-openai" value="${state.openaiKey}" placeholder="sk-..." autocomplete="off">
              </div>
              <div class="ocl-input-group">
                <label>Anthropic API Key</label>
                <input type="password" class="ocl-input" id="ocl-input-anthropic" value="${state.anthropicKey}" placeholder="sk-ant-..." autocomplete="off">
              </div>
            </div>

          </div>

          <div class="ocl-settings-footer">
            <button class="ocl-btn ocl-btn-primary" id="ocl-btn-save-settings">Guardar Cambios</button>
          </div>
        </div>
      </div>
    `;
  }
}

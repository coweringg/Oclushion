export type SkillPublishState = {
  isOpen: boolean;
  privacy: "public" | "private";
  targetOrg: string | null;
  allowedPlans: {
    free: boolean;
    pro: boolean;
    enterprise: boolean;
  };
  availableOrgs: { id: string; name: string }[];
};

export class SkillPublishRenderer {
  public render(container: HTMLElement, state: SkillPublishState): void {
    if (!state.isOpen) {
      container.innerHTML = "";
      container.style.display = "none";
      return;
    }

    container.style.display = "flex";

    container.innerHTML = `
      <style>
        .ocl-publish-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .ocl-publish-modal {
          background: #0f1115;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          width: 540px;
          color: #f8fafc;
          box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.7);
          overflow: hidden;
        }

        .ocl-publish-header {
          padding: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
        }

        .ocl-publish-title {
          font-size: 18px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ocl-publish-close {
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 24px;
          cursor: pointer;
          transition: color 0.2s;
        }

        .ocl-publish-close:hover {
          color: #f8fafc;
        }

        .ocl-publish-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .ocl-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.3s;
        }

        .ocl-box:hover {
          border-color: rgba(255, 255, 255, 0.1);
        }

        .ocl-box-header {
          font-size: 14px;
          font-weight: 600;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ocl-box-desc {
          font-size: 12px;
          color: #94a3b8;
          line-height: 1.5;
        }

        .ocl-radio-group {
          display: flex;
          gap: 16px;
          margin-top: 8px;
        }

        .ocl-radio-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #cbd5e1;
          cursor: pointer;
        }

        .ocl-select {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f8fafc;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          width: 100%;
          cursor: pointer;
        }

        .ocl-checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 8px;
        }

        .ocl-checkbox-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .ocl-checkbox-label:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .ocl-checkbox-label.checked {
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.1);
        }

        .ocl-checkbox-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ocl-checkbox-title {
          font-size: 13px;
          font-weight: 600;
          color: #f8fafc;
        }

        .ocl-checkbox-subtitle {
          font-size: 11px;
          color: #94a3b8;
        }

        .ocl-publish-footer {
          padding: 20px 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          background: rgba(0, 0, 0, 0.2);
        }

        .ocl-btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .ocl-btn-secondary {
          background: transparent;
          color: #94a3b8;
        }

        .ocl-btn-secondary:hover {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.05);
        }

        .ocl-btn-primary {
          background: linear-gradient(135deg, #a855f7, #6366f1);
          color: white;
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
        }

        .ocl-btn-primary:hover {
          filter: brightness(1.1);
          box-shadow: 0 6px 16px rgba(168, 85, 247, 0.4);
        }
      </style>

      <div class="ocl-publish-overlay">
        <div class="ocl-publish-modal">
          
          <div class="ocl-publish-header">
            <div class="ocl-publish-title">
              <span>🚀</span> Publish Skill
            </div>
            <button class="ocl-publish-close" id="btn-close-publish">&times;</button>
          </div>

          <div class="ocl-publish-body">
            
            <div class="ocl-box">
              <div class="ocl-box-header">🔒 1. Privacidad</div>
              <div class="ocl-box-desc">Define si el Skill será visible para la comunidad o solo para ti.</div>
              <div class="ocl-radio-group">
                <label class="ocl-radio-label">
                  <input type="radio" name="privacy" value="public" ${state.privacy === 'public' ? 'checked' : ''}> Público
                </label>
                <label class="ocl-radio-label">
                  <input type="radio" name="privacy" value="private" ${state.privacy === 'private' ? 'checked' : ''}> Privado
                </label>
              </div>
            </div>

            <div class="ocl-box">
              <div class="ocl-box-header">🏢 2. Restricción de Organización</div>
              <div class="ocl-box-desc">Limita el acceso exclusivamente a los miembros de una comunidad de Discord o empresa Enterprise.</div>
              <select class="ocl-select" id="select-target-org" ${state.privacy === 'private' ? 'disabled' : ''}>
                <option value="">Cualquiera (Sin restricción de Organización)</option>
                ${state.availableOrgs.map(org => 
                  `<option value="${org.id}" ${state.targetOrg === org.id ? 'selected' : ''}>${org.name}</option>`
                ).join('')}
              </select>
            </div>

            <div class="ocl-box">
              <div class="ocl-box-header">💎 3. Restricción por Planes</div>
              <div class="ocl-box-desc">Selecciona qué niveles de suscripción pueden instalar este Skill.</div>
              <div class="ocl-checkbox-group">
                
                <label class="ocl-checkbox-label ${state.allowedPlans.free ? 'checked' : ''}">
                  <div class="ocl-checkbox-info">
                    <span class="ocl-checkbox-title">Free Plan</span>
                    <span class="ocl-checkbox-subtitle">Usuarios gratuitos</span>
                  </div>
                  <input type="checkbox" id="chk-plan-free" ${state.allowedPlans.free ? 'checked' : ''} style="display:none;">
                  <span style="font-size: 18px;">${state.allowedPlans.free ? '✅' : '⬜'}</span>
                </label>

                <label class="ocl-checkbox-label ${state.allowedPlans.pro ? 'checked' : ''}">
                  <div class="ocl-checkbox-info">
                    <span class="ocl-checkbox-title">Pro Plan</span>
                    <span class="ocl-checkbox-subtitle">Desarrolladores independientes</span>
                  </div>
                  <input type="checkbox" id="chk-plan-pro" ${state.allowedPlans.pro ? 'checked' : ''} style="display:none;">
                  <span style="font-size: 18px;">${state.allowedPlans.pro ? '✅' : '⬜'}</span>
                </label>

                <label class="ocl-checkbox-label ${state.allowedPlans.enterprise ? 'checked' : ''}">
                  <div class="ocl-checkbox-info">
                    <span class="ocl-checkbox-title">Enterprise Plan</span>
                    <span class="ocl-checkbox-subtitle">Equipos y corporaciones</span>
                  </div>
                  <input type="checkbox" id="chk-plan-enterprise" ${state.allowedPlans.enterprise ? 'checked' : ''} style="display:none;">
                  <span style="font-size: 18px;">${state.allowedPlans.enterprise ? '✅' : '⬜'}</span>
                </label>

              </div>
            </div>

          </div>

          <div class="ocl-publish-footer">
            <button class="ocl-btn ocl-btn-secondary" id="btn-cancel-publish">Cancelar</button>
            <button class="ocl-btn ocl-btn-primary" id="btn-submit-publish">Publicar Skill</button>
          </div>
        </div>
      </div>
    `;
  }
}

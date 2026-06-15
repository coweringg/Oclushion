import type { MarketplaceItem } from "../../marketplace/marketplace.types";

export type MarketplaceState = {
  activeTab: "community" | "organization" | "installed";
  activeCategory: string | null;
  items: MarketplaceItem[];
  installedIds: Set<string>;
  purchasedIds: Set<string>;
  searchQuery: string;
};

export class MarketplaceRenderer {
  public render(container: HTMLElement, state: MarketplaceState): void {
    const categories = ["all", "security", "design", "frontend", "backend", "ai", "game-development"];
    
    let displayItems = state.items;
    
    if (state.activeTab === "installed") {
      displayItems = displayItems.filter(item => state.installedIds.has(item.id));
    } else if (state.activeTab === "organization") {
      displayItems = displayItems.filter(item => item.organizationId !== undefined);
    } else {
      displayItems = displayItems.filter(item => item.organizationId === undefined);
    }

    if (state.activeCategory && state.activeCategory !== "all") {
      displayItems = displayItems.filter(item => item.category === state.activeCategory);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      displayItems = displayItems.filter(item => 
        item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
      );
    }

    container.innerHTML = `
      <style>
        .ocl-marketplace {
          display: flex;
          height: 100%;
          background: #0a0a0c;
          color: #e2e8f0;
          font-family: 'Inter', system-ui, sans-serif;
          overflow: hidden;
        }

        .ocl-sidebar {
          width: 260px;
          background: rgba(20, 20, 25, 0.7);
          backdrop-filter: blur(20px);
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .ocl-brand {
          font-size: 20px;
          font-weight: 700;
          background: linear-gradient(135deg, #a855f7, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: -0.5px;
        }

        .ocl-nav-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ocl-nav-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #64748b;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .ocl-nav-item {
          padding: 10px 14px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #94a3b8;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid transparent;
        }

        .ocl-nav-item:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #f8fafc;
        }

        .ocl-nav-item.active {
          background: rgba(168, 85, 247, 0.1);
          color: #d8b4fe;
          border-color: rgba(168, 85, 247, 0.2);
        }

        .ocl-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: 40px;
          background: radial-gradient(circle at top right, rgba(168, 85, 247, 0.05), transparent 400px);
        }

        .ocl-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 40px;
        }

        .ocl-title {
          font-size: 32px;
          font-weight: 700;
          letter-spacing: -1px;
          color: #ffffff;
        }

        .ocl-search {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 20px;
          border-radius: 100px;
          color: white;
          width: 300px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.3s ease;
        }

        .ocl-search:focus {
          border-color: rgba(168, 85, 247, 0.5);
        }

        .ocl-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
        }

        .ocl-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, border-color 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .ocl-card::before {
          content: "";
          position: absolute;
          top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.5), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .ocl-card:hover {
          transform: translateY(-4px);
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .ocl-card:hover::before {
          opacity: 1;
        }

        .ocl-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .ocl-card-title {
          font-size: 18px;
          font-weight: 600;
          color: #f1f5f9;
          margin: 0;
        }

        .ocl-card-author {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }

        .ocl-badge {
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 100px;
          background: rgba(168, 85, 247, 0.15);
          color: #d8b4fe;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .ocl-badge.enterprise {
          background: rgba(56, 189, 248, 0.15);
          color: #7dd3fc;
        }

        .ocl-card-desc {
          font-size: 14px;
          color: #94a3b8;
          line-height: 1.5;
          margin-bottom: 24px;
          flex: 1;
        }

        .ocl-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
        }

        .ocl-price {
          font-size: 18px;
          font-weight: 700;
          color: #e2e8f0;
        }

        .ocl-btn {
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .ocl-btn-primary {
          background: linear-gradient(135deg, #a855f7, #7c3aed);
          color: white;
          box-shadow: 0 4px 15px rgba(124, 58, 237, 0.3);
        }

        .ocl-btn-primary:hover {
          box-shadow: 0 6px 20px rgba(124, 58, 237, 0.5);
          transform: translateY(-1px);
        }

        .ocl-btn-installed {
          background: rgba(34, 197, 94, 0.1);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .ocl-btn-danger {
          background: transparent;
          color: #f87171;
          border: 1px solid rgba(248, 113, 113, 0.2);
        }
        
        .ocl-btn-danger:hover {
          background: rgba(248, 113, 113, 0.1);
        }
      </style>

      <div class="ocl-marketplace">
        <div class="ocl-sidebar">
          <div class="ocl-brand">Oclushion Store</div>

          <button class="ocl-btn ocl-btn-primary" id="btn-open-publish" style="width: 100%; padding: 12px; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px;">
            🚀 Publish Skill
          </button>
          
          <div class="ocl-nav-group">
            <div class="ocl-nav-label">Discover</div>
            <div class="ocl-nav-item ${state.activeTab === "community" ? "active" : ""}" data-tab="community">
              🌐 Community
            </div>
            <div class="ocl-nav-item ${state.activeTab === "organization" ? "active" : ""}" data-tab="organization">
              🏢 Organization
            </div>
            <div class="ocl-nav-item ${state.activeTab === "installed" ? "active" : ""}" data-tab="installed">
              ⬇️ Installed
            </div>
          </div>

          <div class="ocl-nav-group" style="margin-top: 16px;">
            <div class="ocl-nav-label">Categories</div>
            ${categories.map(cat => `
              <div class="ocl-nav-item ${state.activeCategory === cat ? "active" : ""}" data-category="${cat}">
                # ${cat.replace("-", " ")}
              </div>
            `).join("")}
          </div>
        </div>

        <div class="ocl-main">
          <div class="ocl-header">
            <div class="ocl-title">
              ${state.activeTab === 'community' ? 'Community Hub' : 
                state.activeTab === 'organization' ? 'Enterprise Registry' : 'Installed Skills'}
            </div>
            <input type="text" class="ocl-search" placeholder="Search skills, packs..." id="ocl-search-input" value="${state.searchQuery}">
          </div>

          <div class="ocl-grid">
            ${displayItems.map(item => {
              const isInstalled = state.installedIds.has(item.id);
              const isPurchased = state.purchasedIds.has(item.id);
              const needsPurchase = (item.priceUsd ?? 0) > 0 && !isPurchased;
              const isEnterprise = item.tier === 'enterprise' || item.allowedTiers?.includes('enterprise');
              
              let buttonHtml = '';
              if (isInstalled) {
                buttonHtml = `
                  <div style="display: flex; gap: 8px;">
                    <button class="ocl-btn ocl-btn-installed">Installed</button>
                    <button class="ocl-btn ocl-btn-danger" data-marketplace-action="uninstall-skill" data-skill-id="${item.id}">Remove</button>
                  </div>
                `;
              } else if (needsPurchase) {
                buttonHtml = `<button class="ocl-btn ocl-btn-primary" data-marketplace-action="purchase-skill" data-skill-id="${item.id}">Buy $${item.priceUsd}</button>`;
              } else {
                buttonHtml = `<button class="ocl-btn ocl-btn-primary" data-marketplace-action="install-skill" data-skill-id="${item.id}">Install</button>`;
              }

              return `
                <div class="ocl-card">
                  <div class="ocl-card-header">
                    <div>
                      <h3 class="ocl-card-title">${item.name}</h3>
                      <div class="ocl-card-author">by ${item.author ?? 'Oclushion'}</div>
                    </div>
                    ${isEnterprise ? `<div class="ocl-badge enterprise">ENT</div>` : `<div class="ocl-badge">${item.tier ?? 'FREE'}</div>`}
                  </div>
                  <div class="ocl-card-desc">
                    ${item.description}
                  </div>
                  <div class="ocl-card-footer">
                    <div class="ocl-price">${item.priceUsd === 0 || !item.priceUsd ? 'Free' : `$${item.priceUsd}`}</div>
                    ${buttonHtml}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
          
          ${displayItems.length === 0 ? `
            <div style="text-align: center; color: #64748b; margin-top: 60px;">
              No skills found for this criteria.
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
}

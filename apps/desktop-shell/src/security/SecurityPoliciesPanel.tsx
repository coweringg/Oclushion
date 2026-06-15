import { useState } from "react";

interface Policy {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  severity: "info" | "warning" | "blocking";
  config: Record<string, unknown>;
}

interface SecurityPoliciesPanelProps {
  organizationId: string;
  policies: Policy[];
  onUpdatePolicy: (policy: Policy) => void;
  onCreatePolicy: (policy: Omit<Policy, "id">) => void;
  onDeletePolicy: (id: string) => void;
}

export function SecurityPoliciesPanel({
  organizationId,
  policies,
  onUpdatePolicy,
  onCreatePolicy,
  onDeletePolicy,
}: SecurityPoliciesPanelProps) {
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newPolicy, setNewPolicy] = useState<Partial<Policy>>({
    name: "",
    category: "commands",
    enabled: true,
    severity: "warning",
    config: {},
  });

  const categories = [
    { id: "commands", name: "Commands", description: "Allowed/blocked commands" },
    { id: "network", name: "Network", description: "Allowed/blocked domains" },
    { id: "models", name: "Models", description: "Allowed models per tier" },
    { id: "credits", name: "Credits", description: "Max credits per day" },
    { id: "pii_handling", name: "PII Handling", description: "PII detection and handling" },
    { id: "god_mode", name: "God Mode", description: "God Mode permissions" },
    { id: "data_retention", name: "Data Retention", description: "Data retention policies" },
  ];

  const handleSave = () => {
    if (selectedPolicy) {
      onUpdatePolicy({ ...selectedPolicy, ...newPolicy } as Policy);
    } else {
      onCreatePolicy(newPolicy as Omit<Policy, "id">);
    }
    setIsEditing(false);
    setSelectedPolicy(null);
  };

  return (
    <div className="security-policies-panel">
      <div className="policies-sidebar">
        <h3>Security Policies</h3>
        <button onClick={() => { setSelectedPolicy(null); setIsEditing(true); }}>
          + New Policy
        </button>
        <ul>
          {policies.map((policy) => (
            <li
              key={policy.id}
              className={selectedPolicy?.id === policy.id ? "active" : ""}
              onClick={() => { setSelectedPolicy(policy); setIsEditing(false); }}
            >
              <span className={`status ${policy.enabled ? "enabled" : "disabled"}`}>
                {policy.enabled ? "●" : "○"}
              </span>
              <span className="name">{policy.name}</span>
              <span className={`severity ${policy.severity}`}>{policy.severity}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="policy-editor">
        {isEditing && (
          <div className="policy-form">
            <h4>{selectedPolicy ? "Edit Policy" : "New Policy"}</h4>
            <label>
              Name:
              <input
                type="text"
                value={newPolicy.name}
                onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
              />
            </label>
            <label>
              Category:
              <select
                value={newPolicy.category}
                onChange={(e) => setNewPolicy({ ...newPolicy, category: e.target.value })}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </label>
            <label>
              Severity:
              <select
                value={newPolicy.severity}
                onChange={(e) => setNewPolicy({ ...newPolicy, severity: e.target.value as "info" | "warning" | "blocking" })}
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="blocking">Blocking</option>
              </select>
            </label>
            <label>
              Enabled:
              <input
                type="checkbox"
                checked={newPolicy.enabled}
                onChange={(e) => setNewPolicy({ ...newPolicy, enabled: e.target.checked })}
              />
            </label>
            <div className="actions">
              <button onClick={handleSave}>Save</button>
              <button onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </div>
        )}

        {selectedPolicy && !isEditing && (
          <div className="policy-details">
            <h4>{selectedPolicy.name}</h4>
            <div className="metadata">
              <span>Category: {selectedPolicy.category}</span>
              <span>Severity: <span className={selectedPolicy.severity}>{selectedPolicy.severity}</span></span>
              <span>Status: {selectedPolicy.enabled ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="config">
              <h5>Configuration</h5>
              <pre>{JSON.stringify(selectedPolicy.config, null, 2)}</pre>
            </div>
            <div className="actions">
              <button onClick={() => { setIsEditing(true); setNewPolicy(selectedPolicy); }}>
                Edit
              </button>
              <button onClick={() => onDeletePolicy(selectedPolicy.id)} className="danger">
                Delete
              </button>
            </div>
          </div>
        )}

        {!selectedPolicy && !isEditing && (
          <div className="empty-state">
            Select a policy to view details or create a new one.
          </div>
        )}
      </div>
    </div>
  );
}

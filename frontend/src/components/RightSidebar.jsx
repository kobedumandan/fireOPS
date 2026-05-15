import { useState } from "react";
import "../styles/RightSidebar.css";

const TABS = ["Incident", "Timeline"];

export default function RightSidebar({ collapsed = false, onToggleCollapse }) {
  const [activeTab, setActiveTab] = useState("Incident");

  if (collapsed) {
    return (
      <button
        className="right-sidebar-float-btn"
        onClick={onToggleCollapse}
        title="Expand details panel"
      >
        ‹
      </button>
    );
  }

  return (
    <div className="sidebar-right">
      <div className="sidebar-tabs">
        <button
          className="sidebar-collapse-btn--right"
          onClick={onToggleCollapse}
          title="Collapse"
        >
          ›
        </button>
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`sidebar-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="detail-header">
        <div className="detail-tag">INC-2026-084 · ACTIVE</div>
        <div className="detail-title">Brgy. San Isidro</div>
        <div className="detail-status-row">
          <span className="detail-chip chip-fire">🔥 Critical</span>
          <span className="detail-chip chip-amber">⏱ 08:42 AM</span>
          <span className="detail-chip chip-blue">2 Units</span>
        </div>
      </div>

      <div className="detail-body">
        <div className="detail-row">
          <span className="detail-label">Address</span>
          <span className="detail-value">
            123 Maharlika St., San Isidro, QC
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Reported By</span>
          <span className="detail-value">BFP Hotline · 911</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Structure</span>
          <span className="detail-value">Residential, 2-storey</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Casualties</span>
          <span
            className="detail-value"
            style={{ color: "var(--accent-amber)" }}
          >
            Unconfirmed
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Alarm Level</span>
          <span
            className="detail-value"
            style={{ color: "var(--accent-fire)" }}
          >
            2nd Alarm
          </span>
        </div>

        <div className="detail-section-title">Assigned Units</div>

        <div className="assigned-unit">
          <div className="unit-avatar">JD</div>
          <div className="unit-info">
            <div className="unit-name">J. Dela Cruz</div>
            <div className="unit-status">En Route · IoT Active</div>
          </div>
          <div className="unit-eta">4 min</div>
        </div>

        <div className="assigned-unit">
          <div className="unit-avatar">MR</div>
          <div className="unit-info">
            <div className="unit-name">M. Reyes</div>
            <div className="unit-status">En Route · IoT Active</div>
          </div>
          <div className="unit-eta">6 min</div>
        </div>

        <div className="detail-section-title">GNN Routing</div>

        <div className="routing-panel">
          <div className="routing-title">GNN Route Active</div>
          <div className="routing-row">
            <span className="routing-row-label">Origin</span>
            <span className="routing-row-value">Station 1 (Proj. 4)</span>
          </div>
          <div className="routing-row">
            <span className="routing-row-label">Distance</span>
            <span className="routing-row-value">2.1 km</span>
          </div>
          <div className="routing-row">
            <span className="routing-row-label">Est. Travel</span>
            <span className="routing-row-value highlight">~4 min</span>
          </div>
          <div className="routing-row">
            <span className="routing-row-label">Via</span>
            <span className="routing-row-value">E. Rodriguez Ave.</span>
          </div>
          <div className="routing-row">
            <span className="routing-row-label">Confidence</span>
            <span className="routing-row-value highlight">94.2%</span>
          </div>
          <div className="routing-row">
            <span className="routing-row-label">Model</span>
            <span className="routing-row-value">GNN-RL v2.1</span>
          </div>
        </div>
      </div>

      <div className="detail-actions">
        <button className="btn-dispatch">▶ Dispatch Additional Unit</button>
        <button className="btn-secondary">↑ Escalate to 3rd Alarm</button>
        <button className="btn-secondary">✎ Edit Incident Details</button>
      </div>
    </div>
  );
}

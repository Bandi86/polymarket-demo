import type { TabId } from "@/components/TopDashboard";
import { TABS } from "@/components/dashboard";

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div style={{
      display: "flex",
      alignItems: "stretch",
      gap: "0.5rem",
      marginTop: "auto"
    }}>
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.5rem",
              borderRadius: "10px 10px 0 0",
              border: "none",
              background: isActive ? "var(--bg)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              fontSize: "0.875rem",
              transition: "all 0.2s",
              position: "relative",
              borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
            }}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
            {isActive && (
              <div style={{
                position: "absolute", bottom: -2, left: "10%", right: "10%", height: 2,
                boxShadow: "0 -4px 12px 2px var(--primary)", opacity: 0.5
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
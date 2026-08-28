import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/apiClient.js";
import GitHubIntegrationPanel from "../components/integrations/GitHubIntegrationPanel.jsx";

export const IntegrationMarketplaceHub = () => {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [filterType, setFilterType] = useState("ALL"); // ALL | CONNECTED | AVAILABLE
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const initializeMarketplace = async () => {
      try {
        const response = await apiClient.get("/api/integrations/marketplace");
        if (response.data.success) {
          setCatalog(response.data.integrations);
        } else {
          setErrorMessage("Could not load marketplace configurations.");
        }
      } catch {
        setErrorMessage(
          "A communication error occurred while syncing provider states.",
        );
      } finally {
        setIsLoading(false);
      }
    };
    initializeMarketplace();
  }, []);

  const filteredCatalog = catalog.filter((item) => {
    if (filterType === "CONNECTED") return item.isConnected;
    if (filterType === "AVAILABLE") return !item.isConnected;
    return true;
  });

  if (isLoading) {
    return (
      <div className="w-full max-w-5xl p-8 text-center text-xs font-semibold text-slate-400 tracking-wide uppercase animate-pulse">
        Polling real-time ecosystem synchronization matrices...
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-6 bg-white rounded-xl border border-slate-100 shadow-sm">
      {/* Structural Header Grid */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            🔌 Ecosystem Integrations Marketplace
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Discover, audit, and configure third-party application webhooks and
            context pipelines.
          </p>
        </div>

        {/* Tab Selection Filter Knobs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg text-xs font-bold shadow-inner">
          {["ALL", "CONNECTED", "AVAILABLE"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab === "ALL"
                ? "All Modules"
                : tab === "CONNECTED"
                  ? "Active"
                  : "Unconfigured"}
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <p className="text-xs font-medium text-rose-600 bg-rose-50 p-3 rounded-lg border border-rose-100">
          {errorMessage}
        </p>
      )}

      {/* Main Grid Render Loop */}
      {filteredCatalog.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
          <span className="text-3xl block mb-2">🔍</span>
          <p className="text-xs font-bold text-slate-700">
            No integration matrices match your filter criteria.
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Try widening your dashboard parameters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCatalog.map((app) => (
            <div
              key={app.id}
              className={`flex flex-col justify-between p-4 rounded-xl border transition-all ${
                app.isConnected
                  ? "border-slate-200 bg-white hover:shadow-md"
                  : "border-slate-100 bg-slate-50/40 opacity-90"
              }`}
            >
              <div className="space-y-2.5">
                {/* Meta Row (Category and Setup Priority Number Badge) */}
                <div className="flex items-center justify-between">
                  <span className="bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                    {app.category}
                  </span>
                  {!app.isConnected && (
                    <span
                      className="text-blue-700 bg-blue-50 font-semibold px-2 py-0.5 rounded text-[10px]"
                      title="Recommended system configuration sequence sequence"
                    >
                      Order Rank #{app.recommendationOrder}
                    </span>
                  )}
                </div>

                {/* Main Identity Information Block */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {app.name}
                    {app.isConnected && (
                      <span
                        className="text-xs text-emerald-600"
                        title="Connected successfully"
                      >
                        ✓
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-500 leading-normal mt-1 min-h-[48px] line-clamp-3">
                    {app.description}
                  </p>
                </div>
              </div>

              {/* Action and Pulse Metric Footer */}
              <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between text-[11px]">
                <div>
                  {app.isConnected ? (
                    <div className="space-y-0.5">
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                        Operational
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Sync:{" "}
                        {app.lastSyncedAt
                          ? new Date(app.lastSyncedAt).toLocaleDateString()
                          : "Continuous"}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic">
                      Not initialized
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => navigate(app.configurationRoute)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all text-xs focus:outline-none ${
                    app.isConnected
                      ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  }`}
                >
                  {app.isConnected ? "Configure" : "Setup Link"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* GitHub Integration Management Panel (#2237) */}
      <div className="pt-4 border-t border-slate-100">
        <GitHubIntegrationPanel />
      </div>
    </div>
  );
};

export default IntegrationMarketplaceHub;

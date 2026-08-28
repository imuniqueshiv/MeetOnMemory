import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Trash2,
  Power,
  PowerOff,
  Activity,
  Sliders,
  Edit2,
} from "lucide-react";
import * as api from "../services/automationRuleApi";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Navbar from "../components/Navbar.jsx";

/** Shared field styles — light + dark (Issue #1371). */
const FIELD_CLASS =
  "w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400";

const LABEL_CLASS =
  "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

const AutomationRules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [newRule, setNewRule] = useState({
    name: "",
    description: "",
    trigger: { event: "meeting.created", filters: {} },
    actions: [{ type: "slack", config: { channelId: "" } }],
  });

  // Confirmation modal state (#1369)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await api.fetchRules();
      setRules(data || []);
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to load automation rules",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id, currentStatus) => {
    try {
      await api.toggleRuleStatus(id, !currentStatus);
      toast.success(`Rule ${!currentStatus ? "enabled" : "disabled"}`);
      loadRules();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle rule");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.deleteRule(deleteTarget._id);
      toast.success("Rule deleted");
      setDeleteTarget(null);
      loadRules();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete rule");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditClick = (rule) => {
    setEditingRuleId(rule._id);
    setNewRule({
      name: rule.name || "",
      description: rule.description || "",
      trigger: rule.trigger || { event: "meeting.created", filters: {} },
      actions:
        rule.actions && rule.actions.length > 0
          ? rule.actions
          : [{ type: "slack", config: { channelId: "" } }],
    });
    setShowBuilder(true);
  };

  const handleCancelBuilder = () => {
    setShowBuilder(false);
    setEditingRuleId(null);
    setNewRule({
      name: "",
      description: "",
      trigger: { event: "meeting.created", filters: {} },
      actions: [{ type: "slack", config: { channelId: "" } }],
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingRuleId) {
        await api.updateRule(editingRuleId, newRule);
        toast.success("Rule updated successfully");
      } else {
        await api.createRule(newRule);
        toast.success("Rule created successfully");
      }
      handleCancelBuilder();
      loadRules();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          `Failed to ${editingRuleId ? "update" : "create"} rule`,
      );
    }
  };

  const handleFilterChange = (key, value) => {
    setNewRule((prev) => ({
      ...prev,
      trigger: {
        ...prev.trigger,
        filters: { ...prev.trigger.filters, [key]: value },
      },
    }));
  };

  const handleActionChange = (index, key, value) => {
    const updatedActions = [...newRule.actions];
    if (key === "type") {
      updatedActions[index] = { type: value, config: {} };
    } else {
      updatedActions[index].config = {
        ...updatedActions[index].config,
        [key]: value,
      };
    }
    setNewRule((prev) => ({ ...prev, actions: updatedActions }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors flex flex-col">
      <Navbar />
      <div className="container mx-auto px-4 pt-24 pb-20 max-w-6xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Automation Rules
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Automate your organization's workflows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (showBuilder) {
                handleCancelBuilder();
              } else {
                setShowBuilder(true);
              }
            }}
            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm cursor-pointer"
          >
            {showBuilder ? (
              "Cancel"
            ) : (
              <>
                <Plus size={18} className="mr-2" /> New Rule
              </>
            )}
          </button>
        </div>

        {showBuilder && (
          <div
            role="region"
            aria-label={
              editingRuleId ? "Edit Automation Rule" : "Create New Rule"
            }
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700"
          >
            <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-100">
              {editingRuleId ? "Edit Automation Rule" : "Create New Rule"}
            </h2>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={LABEL_CLASS}>Rule Name</label>
                  <input
                    type="text"
                    required
                    data-testid="rule-name-input"
                    className={FIELD_CLASS}
                    value={newRule.name}
                    onChange={(e) =>
                      setNewRule({ ...newRule, name: e.target.value })
                    }
                    placeholder="e.g. Notify Slack on new meeting"
                  />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Description</label>
                  <input
                    type="text"
                    data-testid="rule-description-input"
                    className={FIELD_CLASS}
                    value={newRule.description}
                    onChange={(e) =>
                      setNewRule({ ...newRule, description: e.target.value })
                    }
                    placeholder="Optional description"
                  />
                </div>
              </div>

              {/* Trigger Config */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                  <Activity
                    size={18}
                    className="mr-2 text-indigo-600 dark:text-indigo-400"
                  />{" "}
                  Trigger Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={LABEL_CLASS}>Event</label>
                    <select
                      className={FIELD_CLASS}
                      value={newRule.trigger.event}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          trigger: {
                            ...newRule.trigger,
                            event: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="meeting.created">Meeting Created</option>
                      <option value="meeting.summary_generated">
                        Summary Generated
                      </option>
                      <option value="action_item.created">
                        Action Item Created
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>
                      Filter by Tag (Optional)
                    </label>
                    <input
                      type="text"
                      className={FIELD_CLASS}
                      value={newRule.trigger.filters.tag || ""}
                      onChange={(e) =>
                        handleFilterChange("tag", e.target.value)
                      }
                      placeholder="e.g. executive"
                    />
                  </div>
                </div>
              </div>

              {/* Action Config */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
                  <Sliders
                    size={18}
                    className="mr-2 text-indigo-600 dark:text-indigo-400"
                  />{" "}
                  Actions
                </h3>
                {newRule.actions.map((action, idx) => (
                  <div
                    key={idx}
                    className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 mb-4 space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className={LABEL_CLASS}>Action Type</label>
                        <select
                          className={FIELD_CLASS}
                          value={action.type}
                          onChange={(e) =>
                            handleActionChange(idx, "type", e.target.value)
                          }
                        >
                          <option value="slack">Post to Slack</option>
                          <option value="webhook">Call Webhook</option>
                          <option value="email">Send Email</option>
                        </select>
                      </div>
                      {action.type === "slack" && (
                        <div>
                          <label className={LABEL_CLASS}>Channel ID</label>
                          <input
                            type="text"
                            required
                            className={FIELD_CLASS}
                            value={action.config.channelId || ""}
                            onChange={(e) =>
                              handleActionChange(
                                idx,
                                "channelId",
                                e.target.value,
                              )
                            }
                            placeholder="C12345678"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Make sure Slack is connected in{" "}
                            <a
                              href="/organizations"
                              className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-700"
                            >
                              Organization Settings &gt; Integrations
                            </a>
                            .
                          </p>
                        </div>
                      )}
                      {action.type === "webhook" && (
                        <div>
                          <label className={LABEL_CLASS}>Webhook URL</label>
                          <input
                            type="url"
                            required
                            className={FIELD_CLASS}
                            value={action.config.url || ""}
                            onChange={(e) =>
                              handleActionChange(idx, "url", e.target.value)
                            }
                            placeholder="https://api.example.com/webhook"
                          />
                        </div>
                      )}
                      {action.type === "email" && (
                        <div>
                          <label className={LABEL_CLASS}>Recipient Email</label>
                          <input
                            type="email"
                            required
                            className={FIELD_CLASS}
                            value={action.config.to || ""}
                            onChange={(e) =>
                              handleActionChange(idx, "to", e.target.value)
                            }
                            placeholder="user@example.com"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleCancelBuilder}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="save-rule-button"
                  className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer"
                >
                  {editingRuleId ? "Update Rule" : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rules List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Loading rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <Sliders className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              No automation rules yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1 mb-6">
              Get started by creating a new rule above.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div
                key={rule._id}
                data-testid="automation-rule-card"
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:shadow-md dark:hover:border-gray-600"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {rule.name}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        rule.isActive
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {rule.isActive ? "Active" : "Disabled"}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                      {rule.description}
                    </p>
                  )}

                  <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Trigger:
                      </span>{" "}
                      {rule.trigger?.event}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        Actions:
                      </span>{" "}
                      {rule.actions?.map((a) => a.type).join(", ")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleEditClick(rule)}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors cursor-pointer"
                    title="Edit Rule"
                    aria-label={`Edit rule ${rule.name}`}
                  >
                    <Edit2 size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggle(rule._id, rule.isActive)}
                    className={`p-2 rounded-lg transition-colors cursor-pointer ${
                      rule.isActive
                        ? "text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                        : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    title={rule.isActive ? "Disable Rule" : "Enable Rule"}
                  >
                    {rule.isActive ? (
                      <Power size={20} />
                    ) : (
                      <PowerOff size={20} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(rule)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
                    title="Delete Rule"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Confirmation Modal (#1369) */}
        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Automation Rule"
          message={`Are you sure you want to delete "${deleteTarget?.name || "this automation rule"}"? This action cannot be undone.`}
          confirmText="Delete Rule"
          variant="danger"
          isLoading={deleteLoading}
        />
      </div>
    </div>
  );
};

export default AutomationRules;

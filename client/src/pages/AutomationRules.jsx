import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Plus,
  Trash2,
  Power,
  PowerOff,
  Activity,
  Sliders,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import * as api from "../services/automationRuleApi";
import ConfirmModal from "../components/ConfirmModal.jsx";

const AutomationRules = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
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

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createRule(newRule);
      toast.success("Rule created successfully");
      setShowBuilder(false);
      setNewRule({
        name: "",
        description: "",
        trigger: { event: "meeting.created", filters: {} },
        actions: [{ type: "slack", config: { channelId: "" } }],
      });
      loadRules();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create rule");
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
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Automation Rules
          </h1>
          <p className="text-gray-500 mt-2">
            Automate your organization's workflows.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowBuilder(!showBuilder)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm cursor-pointer"
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8 border border-gray-100 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-200">
            Create New Rule
          </h2>
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                  value={newRule.name}
                  onChange={(e) =>
                    setNewRule({ ...newRule, name: e.target.value })
                  }
                  placeholder="e.g. Notify Slack on new meeting"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
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
              <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                <Activity size={18} className="mr-2 text-indigo-500" /> When
                this happens... (Trigger)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Event Type
                  </label>
                  <select
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                    value={newRule.trigger.event}
                    onChange={(e) =>
                      setNewRule({
                        ...newRule,
                        trigger: { ...newRule.trigger, event: e.target.value },
                      })
                    }
                  >
                    <option value="meeting.created">Meeting Created</option>
                    <option value="transcript.processed">
                      Transcript Processed
                    </option>
                    <option value="action_item.assigned">
                      Action Item Assigned
                    </option>
                  </select>
                </div>

                {newRule.trigger.event === "meeting.created" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Filter by Tag (Optional)
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                      placeholder="e.g. urgent"
                      onChange={(e) =>
                        handleFilterChange("tag", e.target.value)
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Actions Config */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center">
                <Sliders size={18} className="mr-2 text-indigo-500" /> Do
                this... (Actions)
              </h3>
              {newRule.actions.map((action, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 dark:bg-gray-750 p-4 rounded-lg"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Action Type
                    </label>
                    <select
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                      value={action.type}
                      onChange={(e) =>
                        handleActionChange(index, "type", e.target.value)
                      }
                    >
                      <option value="slack">Send Slack Notification</option>
                      <option value="email">Send Email</option>
                      <option value="webhook">Trigger Webhook</option>
                    </select>
                  </div>

                  {action.type === "slack" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Channel ID
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                        placeholder="e.g. #general"
                        value={action.config.channelId || ""}
                        onChange={(e) =>
                          handleActionChange(index, "channelId", e.target.value)
                        }
                      />
                    </div>
                  )}

                  {action.type === "email" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                        placeholder="user@example.com"
                        value={action.config.email || ""}
                        onChange={(e) =>
                          handleActionChange(index, "email", e.target.value)
                        }
                      />
                    </div>
                  )}

                  {action.type === "webhook" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Webhook URL
                      </label>
                      <input
                        type="url"
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                        placeholder="https://api.example.com/webhook"
                        value={action.config.url || ""}
                        onChange={(e) =>
                          handleActionChange(index, "url", e.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                className="px-4 py-2 border rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors cursor-pointer"
              >
                Save Rule
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules List */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading rules...</div>
      ) : rules.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-100 dark:border-gray-700">
          <Sliders className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            No automation rules yet
          </h3>
          <p className="text-gray-500 mt-1 mb-6">
            Get started by creating a new rule above.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div
              key={rule._id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all hover:shadow-md"
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
                  <p className="text-gray-500 text-sm mt-1">
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
                  onClick={() => handleToggle(rule._id, rule.isActive)}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    rule.isActive
                      ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                      : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  title={rule.isActive ? "Disable Rule" : "Enable Rule"}
                >
                  {rule.isActive ? <Power size={20} /> : <PowerOff size={20} />}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(rule)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer"
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
  );
};

export default AutomationRules;

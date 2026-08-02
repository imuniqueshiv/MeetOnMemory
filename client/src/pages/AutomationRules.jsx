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

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this rule?")) return;
    try {
      await api.deleteRule(id);
      toast.success("Rule deleted");
      loadRules();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete rule");
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
          onClick={() => setShowBuilder(!showBuilder)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors shadow-sm"
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
                  Trigger Event
                </label>
                <select
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                  value={newRule.trigger.event}
                  onChange={(e) =>
                    setNewRule({
                      ...newRule,
                      trigger: { event: e.target.value, filters: {} },
                    })
                  }
                >
                  <option value="meeting.created">Meeting Created</option>
                  <option value="mom.generated">Minutes Generated (MoM)</option>
                  <option value="actionItem.completed">
                    Action Item Completed
                  </option>
                  <option value="export.ready">Data Export Ready</option>
                </select>
              </div>
            </div>

            {newRule.trigger.event === "mom.generated" && (
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                  <Sliders size={16} className="mr-2" /> Conditions (Optional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Minimum Action Items
                    </label>
                    <input
                      type="number"
                      className="w-full px-3 py-1.5 border rounded focus:ring-1 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500"
                      onChange={(e) =>
                        handleFilterChange(
                          "minActionItems",
                          parseInt(e.target.value),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
                Action
              </h3>
              {newRule.actions.map((action, index) => (
                <div
                  key={index}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Action Type
                    </label>
                    <select
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500"
                      value={action.type}
                      onChange={(e) =>
                        handleActionChange(index, "type", e.target.value)
                      }
                    >
                      <option value="slack">Slack Message</option>
                      <option value="webhook">Webhook</option>
                      <option value="email">Email Notification</option>
                    </select>
                  </div>
                  <div>
                    {action.type === "slack" && (
                      <>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Slack Channel ID
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500"
                          value={action.config.channelId || ""}
                          onChange={(e) =>
                            handleActionChange(
                              index,
                              "channelId",
                              e.target.value,
                            )
                          }
                          placeholder="e.g. C0123ABCD"
                        />
                      </>
                    )}
                    {action.type === "webhook" && (
                      <>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Webhook Subscription ID
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500"
                          value={action.config.webhookId || ""}
                          onChange={(e) =>
                            handleActionChange(
                              index,
                              "webhookId",
                              e.target.value,
                            )
                          }
                          placeholder="Webhook ID"
                        />
                      </>
                    )}
                    {action.type === "email" && (
                      <>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          required
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-600 dark:border-gray-500"
                          value={action.config.email || ""}
                          onChange={(e) =>
                            handleActionChange(index, "email", e.target.value)
                          }
                        />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Save Rule
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {rules.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <Activity className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No rules configured
            </h3>
            <p className="text-gray-500">
              Create an automation rule to get started.
            </p>
          </div>
        )}

        {rules.map((rule) => (
          <div
            key={rule._id}
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border ${rule.enabled ? "border-indigo-100 dark:border-indigo-900" : "border-gray-200 dark:border-gray-700"} p-6 transition-all hover:shadow-md`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                  {rule.name}
                  {!rule.enabled && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                      Disabled
                    </span>
                  )}
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                  {rule.trigger.event}
                </span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleToggle(rule._id, rule.enabled)}
                  className={`p-2 rounded-lg transition-colors ${rule.enabled ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100"}`}
                  title={rule.enabled ? "Disable" : "Enable"}
                >
                  {rule.enabled ? <Power size={18} /> : <PowerOff size={18} />}
                </button>
                <button
                  onClick={() => handleDelete(rule._id)}
                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-sm text-gray-500">
              <div className="flex space-x-4">
                <span>Actions: {rule.actions.length}</span>
                <span>Executions: {rule.executionCount}</span>
              </div>
              {rule.lastExecutedAt && (
                <span>
                  Last run: {new Date(rule.lastExecutedAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AutomationRules;

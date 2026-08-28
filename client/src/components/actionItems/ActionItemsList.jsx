import React, { useEffect, useState } from "react";
import { useActionItems } from "../../hooks/useActionItems";
import ActionItemCard from "./ActionItemCard";
import ActionItemsExtractor from "../meetings/ActionItemsExtractor.jsx";
import { toast } from "react-toastify";
import {
  getTemplates,
  applyTemplateToMeeting,
} from "../../services/actionItemTemplateApi";
import { ClipboardList } from "lucide-react";

/**
 * @desc Kanban-style board displaying action items grouped by status.
 * Supports drag-and-drop (simplified here with buttons for status changes).
 */
const ActionItemsList = ({ meetingId }) => {
  const { items, isLoading, fetchItems, fetchMeetingItems, updateItem } =
    useActionItems();
  const [filter, setFilter] = useState("all");

  // Template Picker modal states
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);

  useEffect(() => {
    if (meetingId) {
      fetchMeetingItems(meetingId);
    } else {
      fetchItems({ status: filter !== "all" ? filter : undefined });
    }
  }, [meetingId, filter, fetchItems, fetchMeetingItems]);

  const columns = [
    { id: "pending", title: "To Do", color: "bg-gray-500" },
    { id: "in_progress", title: "In Progress", color: "bg-blue-500" },
    { id: "completed", title: "Done", color: "bg-green-500" },
    { id: "overdue", title: "Overdue", color: "bg-red-500" },
  ];

  const handleStatusChange = async (itemId, newStatus) => {
    await updateItem(itemId, { status: newStatus });
  };

  const openTemplateModal = async () => {
    setIsTemplateModalOpen(true);
    try {
      setLoadingTemplates(true);
      const data = await getTemplates();
      setTemplates(data || []);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      setApplyingTemplate(true);
      await applyTemplateToMeeting(selectedTemplate._id, meetingId);
      toast.success("Action item template applied successfully!");
      setIsTemplateModalOpen(false);
      setSelectedTemplate(null);
      fetchMeetingItems(meetingId);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to apply template");
    } finally {
      setApplyingTemplate(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"
          ></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        {!meetingId && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === "all" ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
            >
              All Tasks
            </button>
            {columns.map((col) => (
              <button
                key={col.id}
                onClick={() => setFilter(col.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${filter === col.id ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
              >
                {col.title}
              </button>
            ))}
          </div>
        )}
        {meetingId && (
          <div className="flex items-center gap-2">
            <ActionItemsExtractor
              meetingId={meetingId}
              onExtracted={() => fetchMeetingItems(meetingId)}
            />
            <button
              onClick={openTemplateModal}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm shadow-sm border-0 cursor-pointer"
              data-testid="apply-template-btn"
            >
              <ClipboardList size={16} />
              Apply Template
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {columns.map((column) => {
          const columnItems = items.filter((item) => {
            if (column.id === "pending") {
              return item.status === "pending" || item.status === "open";
            }
            if (column.id === "in_progress") {
              return (
                item.status === "in_progress" || item.status === "in-progress"
              );
            }
            if (column.id === "completed") {
              return item.status === "completed" || item.status === "resolved";
            }
            return item.status === column.id;
          });

          return (
            <div
              key={column.id}
              className="flex flex-col bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4 min-h-[400px]"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm uppercase tracking-wider">
                    {column.title}
                  </h3>
                </div>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded-full">
                  {columnItems.length}
                </span>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-1">
                {columnItems.length === 0 ? (
                  <div className="h-24 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
                    No tasks
                  </div>
                ) : (
                  columnItems.map((item) => (
                    <ActionItemCard
                      key={item._id}
                      item={item}
                      onStatusChange={handleStatusChange}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Item Template Picker Modal */}
      {isTemplateModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Select Action Item Template"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Apply Action Item Template
              </h3>
              <button
                onClick={() => {
                  setIsTemplateModalOpen(false);
                  setSelectedTemplate(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 border-0 bg-transparent text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 pr-1 space-y-4">
              {!selectedTemplate ? (
                <>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select a template to preview its tasks and apply them to
                    this meeting.
                  </p>

                  {loadingTemplates ? (
                    <div className="py-12 text-center text-sm text-gray-500 flex justify-center items-center gap-2">
                      <span className="w-4.5 h-4.5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                      Loading templates...
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="py-12 text-center text-sm text-gray-500">
                      No templates found. Go to Action Item Templates page to
                      create one.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {templates.map((tpl) => (
                        <div
                          key={tpl._id}
                          onClick={() => setSelectedTemplate(tpl)}
                          className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 cursor-pointer transition-all flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-sm text-gray-900 dark:text-white block">
                              {tpl.name}
                            </span>
                            {tpl.applicableMeetingTypes &&
                              tpl.applicableMeetingTypes.length > 0 && (
                                <span className="inline-block mt-1 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">
                                  {tpl.applicableMeetingTypes.join(", ")}
                                </span>
                              )}
                          </div>
                          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                            {tpl.items?.length || 0} task
                            {tpl.items?.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <button
                      onClick={() => setSelectedTemplate(null)}
                      className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mb-2 border-0 bg-transparent cursor-pointer p-0"
                    >
                      ← Back to template list
                    </button>
                    <h4 className="text-base font-bold text-gray-900 dark:text-white">
                      Preview: {selectedTemplate.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      The following action items will be generated and assigned
                      to this meeting's participants based on their roles.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {selectedTemplate.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-150 dark:border-gray-750 rounded-lg text-sm"
                      >
                        <div className="font-semibold text-gray-800 dark:text-gray-200">
                          {item.text}
                        </div>
                        {item.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {item.description}
                          </div>
                        )}
                        <div className="flex gap-4 mt-2 text-[11px] font-medium text-gray-400">
                          <span>
                            Owner Role:{" "}
                            <strong className="text-gray-600 dark:text-gray-300">
                              {item.defaultOwnerRole || "Unassigned"}
                            </strong>
                          </span>
                          <span>
                            Due in:{" "}
                            <strong className="text-gray-600 dark:text-gray-300">
                              {item.daysToComplete || 7} days
                            </strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => {
                  setIsTemplateModalOpen(false);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-0"
              >
                Cancel
              </button>
              {selectedTemplate && (
                <button
                  type="button"
                  onClick={handleApplyTemplate}
                  disabled={applyingTemplate}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm border-0 flex items-center gap-1.5"
                  data-testid="confirm-apply-btn"
                >
                  {applyingTemplate ? "Applying..." : "Apply to Meeting"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActionItemsList;

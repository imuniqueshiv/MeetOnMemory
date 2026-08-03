import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Plus,
  GripVertical,
  Trash2,
  Save,
  Play,
  ChevronLeft,
  Calendar,
} from "lucide-react";
import { toast } from "react-toastify";
import reportApi from "../services/reportApi";

const SECTION_TYPES = [
  { type: "ACTION_ITEMS", label: "Action Items Summary" },
  { type: "DECISION_LOG", label: "Decision Log" },
  { type: "ATTENDANCE_HEATMAP", label: "Attendance Heatmap" },
  { type: "SENTIMENT_TIMELINE", label: "Sentiment Timeline" },
  { type: "CUSTOM_TEXT", label: "Custom Text Block" },
];

const ReportBuilder = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState({
    name: "New Report Template",
    description: "",
    sections: [],
    defaultFilters: {
      dateRangeDays: 30,
      tags: [],
      meetingTypes: [],
    },
    isShared: false,
  });

  const [generatedReport, setGeneratedReport] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (templateId) {
      fetchTemplate();
    }
  }, [templateId, fetchTemplate]);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportApi.getTemplateById(templateId);
      setTemplate(res.data);
    } catch {
      toast.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  const handleSave = async () => {
    try {
      if (templateId) {
        await reportApi.updateTemplate(templateId, template);
        toast.success("Template updated!");
      } else {
        const res = await reportApi.createTemplate(template);
        toast.success("Template created!");
        navigate(`/reports/builder/${res.data._id}`, { replace: true });
      }
    } catch {
      toast.error("Failed to save template");
    }
  };

  const handleGenerate = async () => {
    if (!templateId) {
      toast.error("Please save the template first before generating.");
      return;
    }
    setGenerating(true);
    try {
      const res = await reportApi.generateReport(templateId);
      setGeneratedReport(res.data);
      toast.success("Report generated!");
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const addSection = (typeObj) => {
    const newSection = {
      _id: `temp_${Date.now()}`,
      type: typeObj.type,
      title: typeObj.label,
      order: template.sections.length,
      config:
        typeObj.type === "CUSTOM_TEXT"
          ? { text: "Enter custom text here" }
          : {},
    };
    setTemplate((prev) => ({
      ...prev,
      sections: [...prev.sections, newSection],
    }));
  };

  const removeSection = (index) => {
    setTemplate((prev) => {
      const newSections = [...prev.sections];
      newSections.splice(index, 1);
      return { ...prev, sections: newSections };
    });
  };

  const updateSectionTitle = (index, title) => {
    setTemplate((prev) => {
      const newSections = [...prev.sections];
      newSections[index].title = title;
      return { ...prev, sections: newSections };
    });
  };

  const updateSectionConfigText = (index, text) => {
    setTemplate((prev) => {
      const newSections = [...prev.sections];
      newSections[index].config = { ...newSections[index].config, text };
      return { ...prev, sections: newSections };
    });
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(template.sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const reordered = items.map((item, idx) => ({ ...item, order: idx }));
    setTemplate((prev) => ({ ...prev, sections: reordered }));
  };

  const renderPreviewSection = (section) => {
    if (!section.data)
      return <p className="text-gray-500 italic">No data returned.</p>;

    switch (section.type) {
      case "ACTION_ITEMS":
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                    Task
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                    Owner
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                    Meeting
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {section.data.map((item, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">
                      {item.text}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                      {item.owner}
                    </td>
                    <td className="px-4 py-2">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                      {item.meetingTitle}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case "ATTENDANCE_HEATMAP":
        return (
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={section.data}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <RechartsTooltip />
                <Bar
                  dataKey="meetingsAttended"
                  fill="#6366f1"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );

      case "SENTIMENT_TIMELINE":
        return (
          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={section.data}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        );

      case "DECISION_LOG":
        return (
          <ul className="space-y-3">
            {section.data.map((dec, i) => (
              <li
                key={i}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
              >
                <p className="text-gray-900 dark:text-white font-medium">
                  {dec.text}
                </p>
                <div className="text-sm text-gray-500 mt-1 flex justify-between">
                  <span>
                    {dec.status} - {dec.meetingTitle}
                  </span>
                  <span>{new Date(dec.meetingDate).toLocaleDateString()}</span>
                </div>
              </li>
            ))}
          </ul>
        );

      case "CUSTOM_TEXT":
        return (
          <p className="text-gray-700 dark:text-gray-300">
            {section.data.text}
          </p>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading template...</div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/reports")}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Report Builder
            </h1>
            <p className="text-sm text-gray-500">
              Create custom multi-meeting reports
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSave}
            className="flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Save size={16} className="mr-2" />
            Save Template
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <Play size={16} className="mr-2" />
            {generating ? "Generating..." : "Generate Preview"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Sidebar - Configuration */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Template Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) =>
                    setTemplate({ ...template, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-transparent dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={template.description}
                  onChange={(e) =>
                    setTemplate({ ...template, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-transparent dark:text-white"
                  rows={3}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isShared"
                  checked={template.isShared}
                  onChange={(e) =>
                    setTemplate({ ...template, isShared: e.target.checked })
                  }
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="isShared"
                  className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                >
                  Share with Organization
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Default Filters
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar size={14} className="inline mr-1" />
                Lookback Range (Days)
              </label>
              <input
                type="number"
                value={template.defaultFilters.dateRangeDays}
                onChange={(e) =>
                  setTemplate({
                    ...template,
                    defaultFilters: {
                      ...template.defaultFilters,
                      dateRangeDays: parseInt(e.target.value) || 30,
                    },
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-transparent dark:text-white"
                min={1}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Add Section
            </h2>
            <div className="space-y-2">
              {SECTION_TYPES.map((type) => (
                <button
                  key={type.type}
                  onClick={() => addSection(type)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  {type.label}
                  <Plus size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content - Template Canvas & Preview */}
        <div className="lg:col-span-3 space-y-6">
          {!generatedReport ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 min-h-[500px]">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                Template Canvas
              </h2>
              {template.sections.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                  <p className="text-gray-500 dark:text-gray-400">
                    Add sections from the left sidebar to build your report.
                  </p>
                </div>
              ) : (
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="sections">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-4"
                      >
                        {template.sections.map((section, index) => (
                          <Draggable
                            key={section._id || `idx_${index}`}
                            draggableId={section._id || `idx_${index}`}
                            index={index}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50 shadow-sm"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3 w-full">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical size={20} />
                                    </div>
                                    <input
                                      type="text"
                                      value={section.title}
                                      onChange={(e) =>
                                        updateSectionTitle(
                                          index,
                                          e.target.value,
                                        )
                                      }
                                      className="font-medium text-gray-900 dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none flex-grow max-w-md px-1 py-0.5"
                                    />
                                    <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full uppercase tracking-wider">
                                      {section.type.replace("_", " ")}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => removeSection(index)}
                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                                {section.type === "CUSTOM_TEXT" && (
                                  <div className="ml-8 mr-12">
                                    <textarea
                                      value={section.config?.text || ""}
                                      onChange={(e) =>
                                        updateSectionConfigText(
                                          index,
                                          e.target.value,
                                        )
                                      }
                                      className="w-full text-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                      rows={2}
                                      placeholder="Enter custom markdown or text..."
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
              <div className="flex justify-between items-start border-b border-gray-200 dark:border-gray-700 pb-6 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {generatedReport.templateName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    {generatedReport.description}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>
                    Generated:{" "}
                    {new Date(generatedReport.generatedAt).toLocaleString()}
                  </p>
                  <p>Based on {generatedReport.meetingCount} meetings</p>
                  <button
                    onClick={() => setGeneratedReport(null)}
                    className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Back to Edit Template
                  </button>
                </div>
              </div>

              <div className="space-y-12">
                {generatedReport.sections.map((section, idx) => (
                  <div key={idx} className="space-y-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-700 pb-2">
                      {section.title}
                    </h3>
                    <div className="text-gray-800 dark:text-gray-200">
                      {renderPreviewSection(section)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportBuilder;

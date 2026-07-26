import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { meetingTemplateApi } from "../../services";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Plus, Trash2, Edit2, Save, X } from "lucide-react";

const TemplateBuilder = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await meetingTemplateApi.getTemplates();
      if (res.data?.success) {
        setTemplates(res.data.templates);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch templates");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingTemplate({
      _id: "new",
      title: "New Template",
      agendaBlocks: [
        {
          title: "Topic 1",
          description: "",
          duration: 15,
          id: Date.now().toString(),
        },
      ],
    });
  };

  const handleEdit = (template) => {
    // Add unique IDs to agendaBlocks for dnd if they don't have them
    const blocksWithIds = template.agendaBlocks.map((b) => ({
      ...b,
      id: b._id || Date.now().toString() + Math.random(),
    }));
    setEditingTemplate({ ...template, agendaBlocks: blocksWithIds });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this template?"))
      return;
    try {
      await meetingTemplateApi.deleteTemplate(id);
      toast.success("Template deleted");
      fetchTemplates();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete template");
    }
  };

  const handleSave = async () => {
    if (!editingTemplate.title.trim()) {
      return toast.error("Template title is required");
    }

    const blocksToSave = editingTemplate.agendaBlocks.map((block) => {
      const newBlock = { ...block };
      delete newBlock.id;
      delete newBlock._id;
      return newBlock;
    });

    try {
      if (editingTemplate._id === "new") {
        await meetingTemplateApi.createTemplate({
          title: editingTemplate.title,
          agendaBlocks: blocksToSave,
        });
        toast.success("Template created");
      } else {
        await meetingTemplateApi.updateTemplate(editingTemplate._id, {
          title: editingTemplate.title,
          agendaBlocks: blocksToSave,
        });
        toast.success("Template updated");
      }
      setEditingTemplate(null);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save template");
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(editingTemplate.agendaBlocks);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setEditingTemplate({ ...editingTemplate, agendaBlocks: items });
  };

  const addBlock = () => {
    setEditingTemplate({
      ...editingTemplate,
      agendaBlocks: [
        ...editingTemplate.agendaBlocks,
        {
          title: "New Topic",
          description: "",
          duration: 15,
          id: Date.now().toString(),
        },
      ],
    });
  };

  const updateBlock = (index, field, value) => {
    const updatedBlocks = [...editingTemplate.agendaBlocks];
    updatedBlocks[index][field] = value;
    setEditingTemplate({ ...editingTemplate, agendaBlocks: updatedBlocks });
  };

  const removeBlock = (index) => {
    const updatedBlocks = [...editingTemplate.agendaBlocks];
    updatedBlocks.splice(index, 1);
    setEditingTemplate({ ...editingTemplate, agendaBlocks: updatedBlocks });
  };

  if (loading) {
    return <div className="text-center py-10">Loading templates...</div>;
  }

  if (editingTemplate) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <input
            type="text"
            className="text-xl font-bold bg-transparent border-b border-slate-300 dark:border-slate-700 focus:outline-hidden focus:border-blue-500 pb-1"
            value={editingTemplate.title}
            onChange={(e) =>
              setEditingTemplate({ ...editingTemplate, title: e.target.value })
            }
            placeholder="Template Title"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setEditingTemplate(null)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Template
            </button>
          </div>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="agenda-blocks">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="space-y-3"
              >
                {editingTemplate.agendaBlocks.map((block, index) => (
                  <Draggable
                    key={block.id}
                    draggableId={block.id}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex gap-4 group"
                      >
                        <div
                          {...provided.dragHandleProps}
                          className="mt-2 text-slate-400 cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={block.title}
                              onChange={(e) =>
                                updateBlock(index, "title", e.target.value)
                              }
                              placeholder="Topic Title"
                              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={block.duration || ""}
                                onChange={(e) =>
                                  updateBlock(
                                    index,
                                    "duration",
                                    parseInt(e.target.value) || null,
                                  )
                                }
                                placeholder="Min"
                                className="w-20 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500"
                              />
                              <span className="text-xs text-slate-500">
                                min
                              </span>
                            </div>
                          </div>
                          <textarea
                            value={block.description}
                            onChange={(e) =>
                              updateBlock(index, "description", e.target.value)
                            }
                            placeholder="Description (optional)"
                            rows="2"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:border-blue-500 resize-none"
                          />
                        </div>
                        <button
                          onClick={() => removeBlock(index)}
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity self-start mt-2"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <button
          onClick={addBlock}
          className="mt-4 w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-900 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Agenda Block
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Meeting Templates
        </h3>
        <button
          onClick={handleCreateNew}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Create Template
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-10 text-center shadow-sm">
          <p className="text-slate-500 dark:text-slate-400 mb-4">
            No templates found. Create one to get started!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template._id}
              className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                  {template.title}
                </h4>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleEdit(template)}
                    className="text-slate-400 hover:text-blue-500 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template._id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {template.agendaBlocks.length} block
                {template.agendaBlocks.length !== 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TemplateBuilder;

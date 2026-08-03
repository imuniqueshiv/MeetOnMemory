import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, X } from "lucide-react";

const AgendaSection = ({
  agendaItems,
  newAgenda,
  setNewAgenda,
  addAgendaItem,
  removeAgendaItem,
  reorderAgendaItem,
}) => {
  const [announcement, setAnnouncement] = useState("");
  const [draggedIndex, setDraggedIndex] = useState(null);

  const moveItem = (fromIndex, toIndex) => {
    const item = agendaItems[fromIndex];
    if (!item || toIndex < 0 || toIndex >= agendaItems.length) return;

    reorderAgendaItem(fromIndex, toIndex);
    setAnnouncement(
      `${item.text || item.title} moved to position ${toIndex + 1} of ${agendaItems.length}.`,
    );
  };

  return (
    <div className="mb-6">
      <label className="block mb-3 font-semibold text-gray-700">
        Meeting Agenda
      </label>
      <div className="flex gap-3 mb-3">
        <input
          type="text"
          value={newAgenda}
          onChange={(e) => setNewAgenda(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), addAgendaItem())
          }
          placeholder="Add agenda item..."
          className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
        />
        <button
          type="button"
          onClick={addAgendaItem}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          aria-label="Add agenda item"
        >
          <Plus size={18} />
        </button>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {agendaItems.length > 0 && (
        <ul className="space-y-2" aria-label="Meeting agenda items">
          {agendaItems.map((item, index) => (
            <li
              key={item.id || item._id || `${item.text}-${index}`}
              draggable
              onDragStart={() => setDraggedIndex(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedIndex !== null) moveItem(draggedIndex, index);
                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
              className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-transparent focus-within:border-blue-300"
            >
              <span
                className="text-gray-400 cursor-grab"
                aria-hidden="true"
                title="Drag to reorder"
              >
                <GripVertical size={18} />
              </span>

              <div className="flex-1 min-w-0 pr-2">
                <span className="text-sm font-medium block truncate">
                  {index + 1}. {item.text || item.title}
                </span>
                {item.description && (
                  <span className="text-xs text-gray-500 block truncate">
                    {item.description}
                  </span>
                )}
                {item.duration && (
                  <span className="text-xs text-blue-600 block">
                    {item.duration} min
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveItem(index, index - 1)}
                  disabled={index === 0}
                  className="p-1.5 rounded text-gray-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={`Move ${item.text || item.title} up`}
                >
                  <ArrowUp size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, index + 1)}
                  disabled={index === agendaItems.length - 1}
                  className="p-1.5 rounded text-gray-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={`Move ${item.text || item.title} down`}
                >
                  <ArrowDown size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => removeAgendaItem(item.id || item._id)}
                  className="p-1.5 rounded text-red-600 hover:bg-red-50"
                  aria-label={`Remove ${item.text || item.title}`}
                >
                  <X size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AgendaSection;

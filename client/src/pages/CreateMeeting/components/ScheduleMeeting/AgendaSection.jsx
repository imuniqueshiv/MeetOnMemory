import { Plus, X } from "lucide-react";

const AgendaSection = ({
  agendaItems,
  newAgenda,
  setNewAgenda,
  addAgendaItem,
  removeAgendaItem,
}) => {
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
          onKeyPress={(e) =>
            e.key === "Enter" && (e.preventDefault(), addAgendaItem())
          }
          placeholder="Add agenda item..."
          className="flex-grow px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none"
        />
        <button
          type="button"
          onClick={addAgendaItem}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
        </button>
      </div>

      {agendaItems.length > 0 && (
        <ul className="space-y-2">
          {agendaItems.map((item, index) => (
            <li
              key={item.id}
              className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-lg"
            >
              <div className="flex-1 min-w-0 pr-4">
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
              <button
                type="button"
                onClick={() => removeAgendaItem(item.id)}
                className="text-red-600 hover:text-red-800 shrink-0"
              >
                <X size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AgendaSection;

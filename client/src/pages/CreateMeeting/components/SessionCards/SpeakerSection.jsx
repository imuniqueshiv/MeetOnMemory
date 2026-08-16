import { Users } from "lucide-react";

const SpeakerSection = ({ sessionData, handleSessionChange }) => {
  return (
    <div className="mb-6 p-6 bg-purple-50 dark:bg-slate-700/50 border border-purple-200 dark:border-slate-600 rounded-lg">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Users size={20} className="text-purple-600 dark:text-purple-400" />{" "}
        Speaker Profile
      </h3>

      <div className="mb-4">
        <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
          Speaker Name
        </label>
        <input
          type="text"
          name="speaker"
          value={sessionData.speaker}
          onChange={handleSessionChange}
          placeholder="Dr. Jane Smith"
          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
        />
      </div>

      <div className="mb-4">
        <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
          Speaker Title/Position
        </label>
        <input
          type="text"
          name="speakerTitle"
          value={sessionData.speakerTitle}
          onChange={handleSessionChange}
          placeholder="Chief AI Researcher at XYZ Corp"
          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
        />
      </div>

      <div>
        <label className="block mb-2 font-medium text-gray-700 dark:text-gray-300">
          Speaker Bio
        </label>
        <textarea
          name="speakerBio"
          value={sessionData.speakerBio}
          onChange={handleSessionChange}
          placeholder="Brief bio and expertise..."
          rows="3"
          className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:ring-2 focus:ring-purple-400 outline-none"
        ></textarea>
      </div>
    </div>
  );
};

export default SpeakerSection;

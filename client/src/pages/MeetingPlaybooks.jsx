import React, { useState, useEffect } from "react";
import {
  fetchPlaybooks,
  generateAIPlaybook,
  deletePlaybook,
} from "../api/meetingPlaybookApi";
import { Plus, Bot, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

const MeetingPlaybooks = () => {
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [meetingType, setMeetingType] = useState("");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const loadPlaybooks = async () => {
    setLoading(true);
    try {
      const data = await fetchPlaybooks();
      setPlaybooks(data);
    } catch {
      toast.error("Failed to load playbooks");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async (e) => {
    e.preventDefault();
    if (!meetingType || !prompt) {
      toast.error("Please fill in all fields");
      return;
    }
    setGenerating(true);
    try {
      const newPlaybook = await generateAIPlaybook(prompt, meetingType);
      toast.success("Playbook generated successfully!");
      setPlaybooks([newPlaybook, ...playbooks]);
      setMeetingType("");
      setPrompt("");
    } catch {
      toast.error("Failed to generate playbook via AI");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deletePlaybook(id);
      toast.success("Playbook deleted");
      setPlaybooks(playbooks.filter((p) => p._id !== id));
    } catch {
      toast.error("Failed to delete playbook");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Meeting Playbooks</h2>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4">AI Generate Playbook</h3>
        <form onSubmit={handleGenerateAI} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Meeting Type (e.g. Sprint Retrospective, Post-Mortem)
            </label>
            <input
              type="text"
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              placeholder="Enter meeting type"
              value={meetingType}
              onChange={(e) => setMeetingType(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Prompt / Goals
            </label>
            <textarea
              className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
              rows="3"
              placeholder="Describe the meeting goals or desired steps..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Bot size={18} />
            {generating ? "Generating..." : "Generate Playbook"}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4">Available Playbooks</h3>
        {loading ? (
          <div className="text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playbooks.map((playbook) => (
              <div
                key={playbook._id}
                className="border dark:border-gray-700 rounded-lg p-4 relative"
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-lg pr-8">{playbook.name}</h4>
                  <button
                    onClick={() => handleDelete(playbook._id)}
                    className="text-red-500 hover:text-red-700 absolute top-4 right-4"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">
                  {playbook.description}
                </p>
                <div className="mt-4 text-sm font-medium">
                  Steps: {playbook.steps?.length || 0}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingPlaybooks;

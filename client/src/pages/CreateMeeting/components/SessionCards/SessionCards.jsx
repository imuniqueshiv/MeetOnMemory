import { Presentation, Loader2, Sparkles, Building2 } from "lucide-react";
import { Link } from "react-router-dom";
import SpeakerSection from "./SpeakerSection";
import SlideUploader from "./SlideUploader";
import VideoUploader from "./VideoUploader";
import GeneratedSessionCards from "./GeneratedSessionCards";

const SessionCards = ({ hookProps, onReuseSession }) => {
  const {
    sessionData,
    slideFiles,
    videoFile,
    generatedSessions,
    loading,
    handleSessionChange,
    handleSlideUpload,
    handleVideoUpload,
    removeSlideFile,
    handleDeleteSession,
    handleSessionSubmit,
  } = hookProps;

  return (
    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 shadow-lg rounded-2xl p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Presentation
            className="text-purple-600 dark:text-purple-400"
            size={28}
          />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Auto Session Card Generation
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload slides/videos from conferences and seminars - AI generates
              session cards with summaries, keywords, and speaker profiles
            </p>
          </div>
        </div>
        <Link
          to="/session-cards"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-semibold transition"
        >
          <Building2 size={16} />
          <span>Browse Org Gallery</span>
        </Link>
      </div>

      <form onSubmit={handleSessionSubmit}>
        {/* Event & Session Info */}
        <div className="mb-6">
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Event Name
          </label>
          <input
            type="text"
            name="eventName"
            value={sessionData.eventName}
            onChange={handleSessionChange}
            placeholder="e.g., TechCon 2025, Annual Research Symposium"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300">
            Session Title *
          </label>
          <input
            type="text"
            name="sessionTitle"
            value={sessionData.sessionTitle}
            onChange={handleSessionChange}
            placeholder="e.g., AI in Healthcare: Future Perspectives"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-400 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            required
          />
        </div>

        <SpeakerSection
          sessionData={sessionData}
          handleSessionChange={handleSessionChange}
        />

        <SlideUploader
          slideFiles={slideFiles}
          handleSlideUpload={handleSlideUpload}
          removeSlideFile={removeSlideFile}
        />

        <VideoUploader
          videoFile={videoFile}
          handleVideoUpload={handleVideoUpload}
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Generating Session Card...
            </>
          ) : (
            <>
              <Sparkles size={18} /> Generate Session Card
            </>
          )}
        </button>
      </form>

      <GeneratedSessionCards
        generatedSessions={generatedSessions}
        onDeleteSession={handleDeleteSession}
        onReuseSession={onReuseSession}
      />
    </div>
  );
};

export default SessionCards;

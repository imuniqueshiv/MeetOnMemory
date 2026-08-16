import { Tag, ExternalLink } from "lucide-react";

const GeneratedSessionCards = ({ generatedSessions }) => {
  if (generatedSessions.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        ✨ Generated Session Cards
      </h3>
      <div className="space-y-4">
        {generatedSessions.map((session, index) => (
          <div
            key={index}
            className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30 border border-purple-200 dark:border-purple-800 rounded-xl p-6"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                  {session.sessionTitle}
                </h4>
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {session.eventName}
                </p>
              </div>
              <span className="px-3 py-1 bg-purple-600 text-white text-xs rounded-full">
                Session
              </span>
            </div>

            {session.speaker && (
              <div className="mb-3 p-3 bg-white dark:bg-slate-700/50 rounded-lg">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {session.speaker}
                </p>
                {session.speakerTitle && (
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {session.speakerTitle}
                  </p>
                )}
              </div>
            )}

            <p className="text-sm text-gray-700 dark:text-slate-300 mb-3">
              {session.summary || "AI-generated summary will appear here..."}
            </p>

            {session.keywords && session.keywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {session.keywords.map((keyword, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs rounded-full flex items-center gap-1"
                  >
                    <Tag size={12} /> {keyword}
                  </span>
                ))}
              </div>
            )}

            {session.videoUrl && (
              <a
                href={session.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                <ExternalLink size={16} /> Watch Video
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeneratedSessionCards;

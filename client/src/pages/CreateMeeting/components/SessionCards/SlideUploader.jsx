import { FileText, X } from "lucide-react";

const SlideUploader = ({ slideFiles, handleSlideUpload, removeSlideFile }) => {
  return (
    <div className="mb-6">
      <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <FileText size={18} /> Upload Presentation Slides (PDF/PPT) *
      </label>
      <input
        type="file"
        multiple
        accept=".pdf,.ppt,.pptx"
        onChange={handleSlideUpload}
        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-purple-400 dark:text-slate-300"
      />
      {slideFiles.length > 0 && (
        <div className="mt-3 space-y-2">
          {slideFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 px-4 py-2 rounded-lg"
            >
              <span className="text-sm flex items-center gap-2 dark:text-slate-200">
                <FileText
                  size={16}
                  className="text-purple-600 dark:text-purple-400"
                />
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => removeSlideFile(index)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
        AI will extract text from slides and generate summary with keywords
      </p>
    </div>
  );
};

export default SlideUploader;

import { FileVideo, CheckCircle } from "lucide-react";

const VideoUploader = ({ videoFile, handleVideoUpload }) => {
  return (
    <div className="mb-6">
      <label className="block mb-2 font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <FileVideo size={18} /> Upload Session Video (Optional)
      </label>
      <input
        type="file"
        accept="video/*"
        onChange={handleVideoUpload}
        className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-purple-400 dark:text-slate-300"
      />
      {videoFile && (
        <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
          <CheckCircle size={16} /> {videoFile.name}
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
        AI will link video timestamps with slide content
      </p>
    </div>
  );
};

export default VideoUploader;

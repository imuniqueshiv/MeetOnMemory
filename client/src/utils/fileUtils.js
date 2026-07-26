export const allowedTypes = [
  "audio/wav",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/x-m4a",
  "audio/mp4",
  "audio/m4a",
];

export const allowedExtensions = ["wav", "mp3", "m4a", "mp4"];

export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const isValidAudioFile = (file) => {
  if (!file) return false;
  const fileExt = file.name.split(".").pop().toLowerCase();
  return (
    allowedTypes.includes(file.type) || allowedExtensions.includes(fileExt)
  );
};

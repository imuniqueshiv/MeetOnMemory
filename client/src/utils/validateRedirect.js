export const validateRedirect = (url, fallback = "/dashboard") => {
  if (!url || typeof url !== "string") {
    return fallback;
  }

  const trimmedUrl = url.trim();

  // Must start with '/' and must NOT start with '//'
  if (!trimmedUrl.startsWith("/") || trimmedUrl.startsWith("//")) {
    return fallback;
  }

  try {
    // If URL parses successfully without a base, it's an absolute URL
    new URL(trimmedUrl);
    return fallback;
  } catch {
    // A relative URL throws a TypeError, which means it is an internal path
    return trimmedUrl;
  }
};

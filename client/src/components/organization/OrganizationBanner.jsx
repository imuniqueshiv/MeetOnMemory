import React, { useState, useEffect } from "react";
import { sanitizeImageUrl } from "../../utils/imageUrl";

/**
 * Wide organization banner with gradient placeholder when unset/broken.
 * URL-based today; same prop will accept future upload CDN URLs.
 */
const OrganizationBanner = ({
  src = "",
  name = "",
  className = "",
  heightClass = "h-40 sm:h-48",
}) => {
  const [failed, setFailed] = useState(false);
  const safeSrc = sanitizeImageUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [safeSrc]);

  const showImage = Boolean(safeSrc) && !failed;

  return (
    <div
      className={`relative w-full overflow-hidden ${heightClass} ${
        showImage
          ? "bg-slate-200 dark:bg-gray-700"
          : "bg-linear-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700"
      } ${className}`}
      role="img"
      aria-label={
        showImage
          ? `${name || "Organization"} banner`
          : `${name || "Organization"} banner placeholder`
      }
    >
      {showImage && (
        <img
          src={safeSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
};

export default OrganizationBanner;

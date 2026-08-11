import React, { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import { sanitizeImageUrl } from "../../utils/imageUrl";

/**
 * Square organization logo with graceful placeholder fallback.
 * Accepts a URL string (upload CDN URLs work the same as external URLs).
 */
const OrganizationLogo = ({
  src = "",
  name = "",
  size = "md",
  className = "",
  alt,
}) => {
  const [failed, setFailed] = useState(false);
  const safeSrc = sanitizeImageUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [safeSrc]);

  const sizeClasses = {
    sm: "h-10 w-10 text-sm rounded-lg",
    md: "h-12 w-12 text-base rounded-xl",
    lg: "h-14 w-14 text-lg rounded-2xl",
    xl: "h-32 w-32 text-4xl rounded-2xl",
  };

  const classes = sizeClasses[size] || sizeClasses.md;
  const showImage = Boolean(safeSrc) && !failed;
  const initial = name?.charAt(0)?.toUpperCase() || "O";

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-linear-to-br from-blue-600 to-indigo-600 text-white font-bold shadow-md shadow-blue-600/20 ${classes} ${className}`}
      aria-hidden={showImage ? undefined : true}
    >
      {showImage ? (
        <img
          src={safeSrc}
          alt={alt || `${name || "Organization"} logo`}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : name ? (
        <span>{initial}</span>
      ) : (
        <Building2 className="h-[45%] w-[45%] text-white" aria-hidden="true" />
      )}
    </div>
  );
};

export default OrganizationLogo;

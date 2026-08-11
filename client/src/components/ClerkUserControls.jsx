import React from "react";
import { useClerk } from "@clerk/clerk-react";

/** Opens Clerk's hosted UserProfile (password, email, MFA, connected accounts) */
export const ClerkManageAccountButton = ({ className, children }) => {
  const { openUserProfile } = useClerk();

  return (
    <button
      type="button"
      onClick={() => openUserProfile()}
      className={className}
    >
      {children}
    </button>
  );
};

export default ClerkManageAccountButton;

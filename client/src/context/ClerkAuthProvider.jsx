import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import ClerkTokenSync from "../components/ClerkTokenSync.jsx";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const ClerkAuthProvider = ({ children }) => {
  if (clerkPubKey && clerkPubKey.trim().length > 0) {
    return (
      <ClerkProvider publishableKey={clerkPubKey}>
        <ClerkTokenSync />
        {children}
      </ClerkProvider>
    );
  }

  return <>{children}</>;
};

export default ClerkAuthProvider;

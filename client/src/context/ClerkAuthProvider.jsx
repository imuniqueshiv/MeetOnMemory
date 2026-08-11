import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import {
  meetOnMemoryClerkAppearance,
  meetOnMemoryClerkLocalization,
} from "../config/clerkAppearance.js";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const ClerkAuthProvider = ({ children }) => {
  if (clerkPubKey && clerkPubKey.trim().length > 0) {
    return (
      <ClerkProvider
        publishableKey={clerkPubKey}
        appearance={meetOnMemoryClerkAppearance}
        localization={meetOnMemoryClerkLocalization}
        afterSignOutUrl="/"
        signInUrl="/login"
        signUpUrl="/signup"
      >
        {children}
      </ClerkProvider>
    );
  }

  return <>{children}</>;
};

export default ClerkAuthProvider;

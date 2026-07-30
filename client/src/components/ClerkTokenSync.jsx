import { useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { setClerkTokenGetter } from "../services/apiClient.js";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const ClerkTokenSync = () => {
  if (!clerkPubKey || clerkPubKey.trim().length === 0) {
    return null;
  }

  return <ClerkTokenSyncInner />;
};

const ClerkTokenSyncInner = () => {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    if (getToken) {
      setClerkTokenGetter(async () => {
        try {
          return await getToken();
        } catch {
          return null;
        }
      });
    }
  }, [getToken, isSignedIn]);

  return null;
};

export default ClerkTokenSync;

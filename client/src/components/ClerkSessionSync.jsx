import { useContext, useEffect, useRef, useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { setClerkTokenGetter } from "../services/apiClient.js";
import AppContent from "../context/AppContent.js";
import { authApi } from "../services";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const MAX_BOOTSTRAP_ATTEMPTS = 4;

export const CLERK_SIGNOUT_EVENT = "meetonmemory:request-clerk-signout";

/**
 * Bridges Clerk session ↔ MeetOnMemory AppContext.
 * Registers the Bearer token getter and bootstraps the Mongo user after sign-in.
 */
export const ClerkSessionSync = () => {
  if (!clerkPubKey || clerkPubKey.trim().length === 0) {
    return null;
  }

  return <ClerkSessionSyncInner />;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ClerkSessionSyncInner = () => {
  const { getToken, isSignedIn, isLoaded, userId } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const {
    initializeAuth,
    isLoggedin,
    setIsLoggedin,
    setUserData,
    setLoading,
    userData,
    getUserData,
  } = useContext(AppContent);

  const syncingRef = useRef(false);
  const syncedForUserRef = useRef(null);
  const attemptsRef = useRef(0);
  const isLoggedinRef = useRef(isLoggedin);
  const getTokenRef = useRef(getToken);
  const profileRef = useRef({ email: null, name: null, image: null });
  const [retryTick, setRetryTick] = useState(0);

  getTokenRef.current = getToken;

  useEffect(() => {
    isLoggedinRef.current = isLoggedin;
  }, [isLoggedin]);

  useEffect(() => {
    profileRef.current = {
      email:
        user?.primaryEmailAddress?.emailAddress ||
        user?.emailAddresses?.[0]?.emailAddress ||
        null,
      name: user?.fullName || user?.firstName || null,
      image: user?.imageUrl || null,
    };
  }, [user]);

  // If Mongo was provisioned with a placeholder email before Clerk profile loaded,
  // sync again once the real email is available and refresh AppContext userData.
  useEffect(() => {
    if (!isLoggedin || !userId) return;

    const clerkEmail =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      null;
    if (!clerkEmail) return;

    const mongoEmail = userData?.email;
    const needsEmailPatch =
      !mongoEmail ||
      mongoEmail.endsWith("@clerk.placeholder") ||
      /^user_[A-Za-z0-9]+(@|$)/.test(mongoEmail);

    if (!needsEmailPatch || mongoEmail === clerkEmail) return;

    let cancelled = false;
    (async () => {
      try {
        await authApi.syncClerkUser({
          clerkUserId: userId,
          email: clerkEmail,
          name: user?.fullName || user?.firstName || undefined,
          profilePic: user?.imageUrl || undefined,
        });
        if (!cancelled) await getUserData();
      } catch {
        // Non-fatal; Navbar still falls back to Clerk email for display
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedin, userId, user, userData?.email, getUserData]);

  // Register the token getter once. Always call the latest getToken via ref.
  // Clearing the getter whenever `getToken` identity changed left a window where
  // Axios ran with clerkTokenGetter=null → no Authorization header on is-auth.
  useEffect(() => {
    setClerkTokenGetter(async () => {
      try {
        const tokenFn = getTokenRef.current;
        if (typeof tokenFn !== "function") return null;
        return await tokenFn();
      } catch {
        return null;
      }
    });

    return () => setClerkTokenGetter(null);
  }, []);

  useEffect(() => {
    const onSignOutRequest = () => {
      signOut({ redirectUrl: "/" }).catch(() => {});
    };
    window.addEventListener(CLERK_SIGNOUT_EVENT, onSignOutRequest);
    return () =>
      window.removeEventListener(CLERK_SIGNOUT_EVENT, onSignOutRequest);
  }, [signOut]);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;
    let retryTimer;

    const clearAppSession = async () => {
      setUserData(null);
      localStorage.removeItem("userData");
      setIsLoggedin(false);
      try {
        await authApi.logout();
      } catch {
        // Best-effort cookie clear
      }
    };

    const finishLoading = () => {
      if (!cancelled) setLoading(false);
    };

    const syncSession = async () => {
      if (cancelled) return;

      if (!isSignedIn) {
        syncedForUserRef.current = null;
        attemptsRef.current = 0;
        if (isLoggedinRef.current) {
          await clearAppSession();
        }
        finishLoading();
        return;
      }

      if (syncedForUserRef.current === userId && isLoggedinRef.current) {
        finishLoading();
        return;
      }

      if (syncingRef.current) return;
      syncingRef.current = true;
      setLoading(true);

      try {
        // Wait briefly for Clerk to mint a session JWT after redirect.
        let token = null;
        for (let i = 0; i < 8; i += 1) {
          try {
            const tokenFn = getTokenRef.current;
            token = typeof tokenFn === "function" ? await tokenFn() : null;
          } catch {
            token = null;
          }
          if (token || cancelled) break;
          await wait(75 * (i + 1));
        }

        if (cancelled) return;

        if (!token) {
          throw new Error("Clerk session token not ready");
        }

        // Pass Bearer explicitly so bootstrap cannot race a cleared getter.
        const authorization = `Bearer ${token}`;
        const requestConfig = { headers: { Authorization: authorization } };

        const profile = profileRef.current;
        try {
          await authApi.syncClerkUser(
            {
              clerkUserId: userId || undefined,
              email: profile.email || undefined,
              name: profile.name || undefined,
              profilePic: profile.image || undefined,
            },
            requestConfig,
          );
        } catch {
          // userAuth middleware also provisions; initializeAuth may still succeed
        }

        if (cancelled) return;

        const mongoUser = await initializeAuth({ authorization });
        if (mongoUser && userId) {
          syncedForUserRef.current = userId;
          attemptsRef.current = 0;
          finishLoading();
          return;
        }

        throw new Error("Mongo bootstrap failed");
      } catch (err) {
        console.error("ClerkSessionSync bootstrap error:", err);
        syncedForUserRef.current = null;

        if (!cancelled && attemptsRef.current < MAX_BOOTSTRAP_ATTEMPTS) {
          attemptsRef.current += 1;
          const delay = 250 * attemptsRef.current;
          retryTimer = setTimeout(() => {
            if (!cancelled) setRetryTick((tick) => tick + 1);
          }, delay);
          return;
        }

        finishLoading();
      } finally {
        syncingRef.current = false;
      }
    };

    syncSession();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    isLoaded,
    isSignedIn,
    userId,
    retryTick,
    initializeAuth,
    setIsLoggedin,
    setUserData,
    setLoading,
  ]);

  return null;
};

export default ClerkSessionSync;

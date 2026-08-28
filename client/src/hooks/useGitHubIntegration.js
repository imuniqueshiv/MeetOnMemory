// client/src/hooks/useGitHubIntegration.js
import { useState, useEffect, useCallback } from "react";
import apiClient from "../services/apiClient.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

/**
 * Custom React hook for managing GitHub Integration.
 * Provides status fetching, OAuth initiation, repo listing, repo picker update,
 * webhook event logs, and disconnect actions.
 */
export const useGitHubIntegration = (organizationId = "") => {
  const [isConnected, setIsConnected] = useState(false);
  const [repositoryFullName, setRepositoryFullName] = useState("");
  const [githubUser, setGithubUser] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch current GitHub integration status.
   */
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/github/status", {
        params: organizationId ? { organizationId } : {},
      });

      if (response.data?.success) {
        setIsConnected(
          Boolean(response.data.data?.isConnected ?? response.data.isConnected),
        );
        setRepositoryFullName(
          response.data.data?.repositoryFullName ||
            response.data.repositoryFullName ||
            "",
        );
        setGithubUser(
          response.data.data?.githubUser || response.data.githubUser || null,
        );
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error("Error checking GitHub status:", err);
      setError(err.response?.data?.message || "Failed to check GitHub status.");
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  /**
   * Initiate GitHub OAuth connection.
   */
  const connectGitHub = useCallback(() => {
    const params = new URLSearchParams();
    if (organizationId) {
      params.append("organizationId", organizationId);
    }
    const connectUrl = `${BACKEND_URL}/api/github/connect${
      params.toString() ? `?${params.toString()}` : ""
    }`;
    window.location.href = connectUrl;
  }, [organizationId]);

  /**
   * Disconnect GitHub integration.
   */
  const disconnectGitHub = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post("/api/github/disconnect", {
        organizationId,
      });
      if (response.data?.success) {
        setIsConnected(false);
        setRepositoryFullName("");
        setGithubUser(null);
        setRepositories([]);
        setWebhookEvents([]);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error disconnecting GitHub:", err);
      setError(err.response?.data?.message || "Failed to disconnect GitHub.");
      return false;
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  /**
   * Fetch connected repositories.
   */
  const fetchRepos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/api/github/repos", {
        params: organizationId ? { organizationId } : {},
      });
      if (response.data?.success) {
        const repos =
          response.data.data?.repositories || response.data.repositories || [];
        setRepositories(repos);
        return repos;
      }
      return [];
    } catch (err) {
      console.error("Error fetching GitHub repos:", err);
      setError(err.response?.data?.message || "Failed to fetch repositories.");
      return [];
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  /**
   * Fetch recent webhook events.
   */
  const fetchWebhookEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const response = await apiClient.get("/api/github/webhook-events", {
        params: organizationId ? { organizationId } : {},
      });
      if (response.data?.success) {
        const events = response.data.data?.events || response.data.events || [];
        setWebhookEvents(events);
        return events;
      }
      return [];
    } catch (err) {
      console.error("Error fetching webhook events:", err);
      return [];
    } finally {
      setEventsLoading(false);
    }
  }, [organizationId]);

  /**
   * Update active configured repository.
   */
  const updateConfiguredRepo = useCallback(
    async (repoFullName) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post("/api/github/repository", {
          organizationId,
          repositoryFullName: repoFullName,
        });
        if (response.data?.success) {
          setRepositoryFullName(repoFullName);
          return true;
        }
        return false;
      } catch (err) {
        console.error("Error updating GitHub repository:", err);
        setError(
          err.response?.data?.message ||
            "Failed to update repository configuration.",
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (isConnected) {
      fetchRepos();
      fetchWebhookEvents();
    }
  }, [isConnected, fetchRepos, fetchWebhookEvents]);

  return {
    isConnected,
    repositoryFullName,
    githubUser,
    repositories,
    webhookEvents,
    loading,
    eventsLoading,
    error,
    fetchStatus,
    connectGitHub,
    disconnectGitHub,
    fetchRepos,
    fetchWebhookEvents,
    updateConfiguredRepo,
  };
};

export default useGitHubIntegration;

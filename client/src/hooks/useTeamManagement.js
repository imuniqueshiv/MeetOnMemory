import { useState, useCallback, useEffect, useContext } from "react";
import { organizationApi, invitationApi } from "../services";
import { toast } from "react-toastify";
import AppContent from "../context/AppContent";

export const useTeamManagement = (activeTab) => {
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [error, setError] = useState(null);

  const { userData } = useContext(AppContent);
  const isAdmin = userData?.role === "admin" || userData?.role === "owner";

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await organizationApi.getMembers();

      if (data.success) {
        setMembers(data.members);
      } else {
        setError(data.message || "Failed to fetch members");
      }
    } catch (err) {
      console.error("Error fetching members:", err);
      setError("Failed to fetch members. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInvitations = useCallback(async () => {
    if (!userData?.organization) return;
    const orgId = userData.organization._id || userData.organization;
    try {
      setInvitesLoading(true);
      const { data } = await invitationApi.getOrganizationInvitations(orgId);
      if (data.success) {
        setInvitations(data.invitations || []);
      }
    } catch (err) {
      console.error("Error fetching invitations:", err);
    } finally {
      setInvitesLoading(false);
    }
  }, [userData]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (activeTab === "invitations" && isAdmin) {
      fetchInvitations();
    }
  }, [activeTab, fetchInvitations, isAdmin]);

  const handleSendInvite = async (inviteData, onSuccess) => {
    const orgId = userData?.organization?._id || userData?.organization;
    if (!orgId) {
      toast.error("No active organization selected");
      return;
    }

    try {
      const { data } = await invitationApi.createInvitation({
        organizationId: orgId,
        ...inviteData,
      });

      if (data.success) {
        toast.success("Invitation sent successfully!");
        if (activeTab === "invitations") {
          fetchInvitations();
        }
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error("Error sending invitation:", err);
      toast.error(err.response?.data?.message || "Failed to send invitation");
      throw err;
    }
  };

  const handleResendInvite = async (id) => {
    try {
      const { data } = await invitationApi.resendInvitation(id);
      if (data.success) {
        toast.success("Invitation resent successfully!");
        fetchInvitations();
      }
    } catch (err) {
      console.error("Error resending invitation:", err);
      toast.error(err.response?.data?.message || "Failed to resend invitation");
    }
  };

  const handleCancelInvite = async (id) => {
    try {
      const { data } = await invitationApi.revokeInvitation(id);
      if (data.success) {
        toast.success("Invitation cancelled successfully!");
        fetchInvitations();
      }
    } catch (err) {
      console.error("Error cancelling invitation:", err);
      toast.error(err.response?.data?.message || "Failed to cancel invitation");
    }
  };

  const handleExpireInvite = async (id) => {
    try {
      const { data } = await invitationApi.expireInvitation(id);
      if (data.success) {
        toast.success("Invitation expired successfully!");
        fetchInvitations();
      }
    } catch (err) {
      console.error("Error expiring invitation:", err);
      toast.error(err.response?.data?.message || "Failed to expire invitation");
    }
  };

  return {
    members,
    invitations,
    loading,
    invitesLoading,
    error,
    isAdmin,
    fetchMembers,
    fetchInvitations,
    handleSendInvite,
    handleResendInvite,
    handleCancelInvite,
    handleExpireInvite,
  };
};

export default useTeamManagement;

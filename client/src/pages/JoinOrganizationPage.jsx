// client/src/pages/JoinOrganizationPage.jsx
import React, { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppContent from "../context/AppContent";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import { organizationApi, invitationApi } from "../services";
import { Building2, Search, ArrowRight, Users, Mail, Check, X, AlertTriangle } from "lucide-react";

const JoinOrganizationPage = () => {
  const { getUserData, setUserData } = useContext(AppContent);
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [orgList, setOrgList] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Invitation handling state
  const [inviteDetails, setInviteDetails] = useState(null);
  const [inviteError, setInviteError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (token) {
      // Handle invitation flow
      const fetchInvitation = async () => {
        try {
          setLoading(true);
          const { data } = await invitationApi.getInvitationByToken(token);
          if (data.success) {
            setInviteDetails(data.invitation);
          } else {
            setInviteError(data.message || "Invalid invitation");
          }
        } catch (err) {
          console.error("Error loading invitation:", err);
          setInviteError(err.response?.data?.message || "Invalid or expired invitation");
        } finally {
          setLoading(false);
        }
      };
      fetchInvitation();
    } else {
      // Regular join list flow
      const fetchOrgs = async () => {
        try {
          const { data } = await organizationApi.getAllOrganizations();
          if (data.success) setOrgList(data.organizations);
        } catch {
          toast.error("Failed to load organizations");
        } finally {
          setLoading(false);
        }
      };
      fetchOrgs();
    }
  }, [token]);

  const handleJoin = async (orgId) => {
    try {
      const { data } = await organizationApi.joinOrganization({
        organizationId: orgId,
      });

      if (data.success) {
        toast.success("Joined organization successfully!");
        const updatedUser = await getUserData();
        if (updatedUser) {
          setUserData(updatedUser);
          localStorage.setItem("userData", JSON.stringify(updatedUser));
        }
        navigate("/organizations");
      } else {
        toast.error(data.message);
      }
    } catch {
      toast.error("Failed to join organization");
    }
  };

  const handleAcceptInvite = async () => {
    if (!token) return;
    try {
      setActionLoading(true);
      const { data } = await invitationApi.acceptInvitation(token);
      if (data.success) {
        toast.success("Invitation accepted! Welcome to the organization.");
        const updatedUser = await getUserData();
        if (updatedUser) {
          setUserData(updatedUser);
          localStorage.setItem("userData", JSON.stringify(updatedUser));
        }
        // Force fully reload or navigate to trigger switcher updates
        window.location.href = "/dashboard";
      } else {
        toast.error(data.message || "Failed to accept invitation");
      }
    } catch (err) {
      console.error("Error accepting invitation:", err);
      toast.error(err.response?.data?.message || "Failed to accept invitation");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineInvite = async () => {
    if (!token) return;
    try {
      setActionLoading(true);
      const { data } = await invitationApi.rejectInvitation(token);
      if (data.success) {
        toast.info("Invitation declined.");
        navigate("/organizations");
      } else {
        toast.error(data.message || "Failed to decline invitation");
      }
    } catch (err) {
      console.error("Error declining invitation:", err);
      toast.error(err.response?.data?.message || "Failed to decline invitation");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {token ? (
            /* Invitation Flow rendering */
            <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-xl overflow-hidden mt-12">
              {loading ? (
                <div className="p-12 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 dark:border-slate-700 border-t-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500 dark:text-gray-400">Verifying invitation link...</p>
                </div>
              ) : inviteError ? (
                <div className="p-8 text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 mb-2">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invitation Invalid</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {inviteError}
                  </p>
                  <div className="pt-4">
                    <button
                      onClick={() => navigate("/organizations")}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md shadow-blue-600/10 cursor-pointer"
                    >
                      Go to Organization Hub
                    </button>
                  </div>
                </div>
              ) : inviteDetails ? (
                <div className="p-8 space-y-6">
                  {/* Organization Logo/Header */}
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30 flex items-center justify-center mx-auto mb-4 overflow-hidden shrink-0">
                      {inviteDetails.organization?.logo ? (
                        <img
                          src={inviteDetails.organization.logo}
                          alt={inviteDetails.organization.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-10 h-10 text-blue-600" />
                      )}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Invitation to Join
                    </h2>
                    <p className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-1">
                      {inviteDetails.organization?.name}
                    </p>
                  </div>

                  <hr className="border-gray-100 dark:border-gray-700" />

                  {/* Inviter Info */}
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-2 border border-gray-100/40 dark:border-gray-700/40">
                    <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-bold">
                      Invited By
                    </p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {inviteDetails.invitedBy?.name} ({inviteDetails.invitedBy?.email})
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Role offered: <span className="font-bold text-blue-600 dark:text-blue-400 capitalize">{inviteDetails.role}</span>
                    </p>
                  </div>

                  {/* Message */}
                  {inviteDetails.message && (
                    <div className="bg-blue-50/30 dark:bg-blue-950/10 border-l-4 border-blue-500 p-4 rounded-r-xl">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">Personal Message</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                        "{inviteDetails.message}"
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-4 pt-2">
                    <button
                      onClick={handleDeclineInvite}
                      disabled={actionLoading}
                      className="flex-1 py-3 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300 rounded-xl font-semibold transition-all cursor-pointer text-sm"
                    >
                      Decline
                    </button>
                    <button
                      onClick={handleAcceptInvite}
                      disabled={actionLoading}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-md shadow-blue-600/10 cursor-pointer text-sm flex items-center justify-center gap-1.5"
                    >
                      {actionLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Accept & Join
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            /* Regular Browse Flow */
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg">
                  <Search className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  {t("organizations.browse")}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  {t("organizations.browseDesc")}
                </p>
              </div>

              {/* Organization List */}
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="bg-white dark:bg-gray-800 rounded-2xl h-40 animate-pulse"
                    />
                  ))}
                </div>
              ) : orgList.length === 0 ? (
                <div className="text-center py-16">
                  <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {t("organizations.noOrgsAvailable")}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {t("organizations.noOrgsAvailableDesc")}
                  </p>
                  <button
                    onClick={() => navigate("/create-organization")}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all cursor-pointer"
                  >
                    {t("organizations.create")}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {orgList.map((org) => (
                    <div
                      key={org._id}
                      className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-between hover:shadow-xl transition-all duration-300"
                    >
                      <div>
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100/50 dark:border-blue-800/30 flex items-center justify-center mb-4 overflow-hidden shrink-0">
                          {org.logo ? (
                            <img
                              src={org.logo}
                              alt={org.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="w-6 h-6 text-blue-600" />
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 truncate">
                          {org.name}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-4">
                          {org.description || t("organizations.noDescription")}
                        </p>
                      </div>
                      <button
                        onClick={() => handleJoin(org._id)}
                        className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-gray-750 dark:hover:bg-gray-700 dark:text-blue-400 rounded-2xl font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Join Organization
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinOrganizationPage;

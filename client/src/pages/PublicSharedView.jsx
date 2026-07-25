import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { publicSharedApi } from "../services";
import {
  Shield,
  Lock,
  FileText,
  Video,
  Calendar,
  MapPin,
  Clock,
  Users,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const PublicSharedView = () => {
  const { hash } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");

  const [resource, setResource] = useState(null);

  useEffect(() => {
    fetchResource();
  }, [hash]);

  const fetchResource = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await publicSharedApi.getPublicResource(hash);
      if (data.success) {
        setResource(data);
      }
    } catch (err) {
      if (
        err.response?.status === 401 &&
        err.response?.data?.requiresPasscode
      ) {
        setRequiresPasscode(true);
      } else {
        setError(
          err.response?.data?.message || "Failed to load shared resource",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!passcode) {
      setPasscodeError("Passcode is required");
      return;
    }

    try {
      setVerifying(true);
      setPasscodeError("");
      const { data } = await publicSharedApi.verifyPasscode(hash, { passcode });
      if (data.success) {
        setRequiresPasscode(false);
        fetchResource();
      }
    } catch (err) {
      setPasscodeError(err.response?.data?.message || "Invalid passcode");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (requiresPasscode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Protected Resource
            </h2>
            <p className="text-gray-600 text-sm">
              Please enter the passcode to view this shared resource.
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {passcodeError && (
                <p className="mt-2 text-sm text-red-600">{passcodeError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={verifying}
              className="w-full bg-indigo-600 text-white font-medium py-3 rounded-lg hover:bg-indigo-700 transition disabled:opacity-70"
            >
              {verifying ? "Verifying..." : "Access Resource"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!resource) return null;

  const { resourceType, data } = resource;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Bar */}
        <div className="flex items-center gap-2 mb-8 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full inline-flex border border-indigo-100">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">
            Shared via MeetOnMemory (Read-Only)
          </span>
        </div>

        {resourceType === "Meeting" ? (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                  <Video className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    {data.title}
                  </h1>
                  <p className="text-gray-600 text-lg">{data.description}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100 my-6">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <span className="text-sm">
                    {new Date(data.date).toLocaleDateString()}
                  </span>
                </div>
                {data.time && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-sm">{data.time}</span>
                  </div>
                )}
                {data.location && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span className="text-sm">{data.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span className="text-sm">
                    {data.participants?.length || 0} Participants
                  </span>
                </div>
              </div>

              {data.summary && (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    Meeting Summary
                  </h3>
                  <div className="prose max-w-none text-gray-700">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {data.summary}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {data.structuredMoM && (
                <div className="mt-8 space-y-6">
                  {data.structuredMoM.decisions &&
                    data.structuredMoM.decisions.length > 0 && (
                      <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                        <h3 className="text-lg font-semibold text-green-900 mb-4">
                          Key Decisions
                        </h3>
                        <ul className="list-disc pl-5 space-y-2 text-green-800">
                          {data.structuredMoM.decisions.map((desc, idx) => (
                            <li key={idx}>{desc}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {data.structuredMoM.action_items &&
                    data.structuredMoM.action_items.length > 0 && (
                      <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                        <h3 className="text-lg font-semibold text-amber-900 mb-4">
                          Action Items
                        </h3>
                        <ul className="space-y-3">
                          {data.structuredMoM.action_items.map((item, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-3 bg-white p-3 rounded-lg border border-amber-200"
                            >
                              <div className="flex-1 text-gray-800">
                                {item.task}
                              </div>
                              {item.assignee && (
                                <div className="text-xs font-medium bg-amber-100 text-amber-800 px-2 py-1 rounded">
                                  {item.assignee}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-purple-100 text-purple-600 rounded-lg shrink-0">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">
                  {data.name}
                </h1>
                <p className="text-gray-500 font-medium">
                  Version {data.version}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Policy Summary
              </h3>
              {data.summary ? (
                <div className="prose max-w-none text-gray-700 bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {data.summary}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-500 italic">
                  No summary available for this policy.
                </p>
              )}
            </div>

            {data.key_changes && data.key_changes.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Key Elements
                </h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  {data.key_changes.map((change, idx) => (
                    <li key={idx}>{change}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PublicSharedView;

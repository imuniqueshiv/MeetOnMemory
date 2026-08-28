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
  Paperclip,
  Scissors,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import VenueMapPreview from "../components/meetings/VenueMapPreview";

const PublicSharedView = () => {
  const { hash } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [requiresPasscode, setRequiresPasscode] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [passcodeError, setPasscodeError] = useState("");

  const [resource, setResource] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    fetchResource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const fetchResource = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await publicSharedApi.getPublicResource(hash);
      if (data.success) {
        setResource(data);
        setActiveTab("overview");
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md w-full text-center">
          <Shield className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (requiresPasscode) {
    const passcodeHelpId = "shared-link-passcode-help";
    const passcodeErrorId = "shared-link-passcode-error";
    const describedBy = passcodeError
      ? `${passcodeHelpId} ${passcodeErrorId}`
      : passcodeHelpId;

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock
                className="w-8 h-8 text-indigo-600 dark:text-indigo-400"
                aria-hidden="true"
              />
            </div>
            <h1
              id="shared-link-passcode-heading"
              className="text-xl font-semibold text-gray-900 dark:text-white mb-2"
            >
              Protected Resource
            </h1>
            <p
              id={passcodeHelpId}
              className="text-gray-600 dark:text-gray-300 text-sm"
            >
              Please enter the passcode to view this shared resource.
            </p>
          </div>

          <form
            onSubmit={handleVerify}
            className="space-y-4"
            aria-labelledby="shared-link-passcode-heading"
            noValidate
          >
            <div>
              <label
                htmlFor="shared-link-passcode"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2"
              >
                Passcode
              </label>
              <input
                id="shared-link-passcode"
                name="passcode"
                type="password"
                autoComplete="current-password"
                inputMode="text"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                aria-required="true"
                aria-invalid={passcodeError ? "true" : "false"}
                aria-describedby={describedBy}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
              />
              {passcodeError && (
                <p
                  id={passcodeErrorId}
                  role="alert"
                  className="mt-2 text-sm text-red-600 dark:text-red-400"
                >
                  {passcodeError}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={verifying}
              aria-busy={verifying ? "true" : "false"}
              className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition disabled:opacity-70"
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

  const meetingTabs = [
    { id: "overview", label: "Overview" },
    ...(data.includedSections?.transcript && data.transcriptExcerpt?.length
      ? [{ id: "transcript", label: "Transcript" }]
      : []),
    ...(data.includedSections?.attachments && data.attachments?.length
      ? [{ id: "attachments", label: "Attachments" }]
      : []),
    ...(data.includedSections?.clips && data.clips?.length
      ? [{ id: "clips", label: "Clips" }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Bar */}
        <div className="flex items-center gap-2 mb-8 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-4 py-2 rounded-full inline-flex border border-indigo-100 dark:border-indigo-800/50">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">
            Shared via MeetOnMemory (Read-Only)
          </span>
        </div>

        {resourceType === "Meeting" ? (
          <div className="space-y-6">
            {meetingTabs.length > 1 && (
              <div
                className="flex flex-wrap gap-2"
                role="tablist"
                aria-label="Shared meeting sections"
              >
                {meetingTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer ${
                      activeTab === tab.id
                        ? "bg-indigo-600 text-white"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                  <Video className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {data.title}
                  </h1>
                  <p className="text-gray-600 dark:text-gray-300 text-lg">
                    {data.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 py-6 border-y border-gray-100 dark:border-gray-700 my-6">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-400" />
                  <span className="text-sm">
                    {new Date(data.date).toLocaleDateString()}
                  </span>
                </div>
                {data.time && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <Clock className="w-5 h-5 text-gray-400 dark:text-gray-400" />
                    <span className="text-sm">{data.time}</span>
                  </div>
                )}
                {data.location && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <MapPin className="w-5 h-5 text-gray-400 dark:text-gray-400" />
                    <span className="text-sm">{data.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                  <Users className="w-5 h-5 text-gray-400 dark:text-gray-400" />
                  <span className="text-sm">
                    {data.participants?.length || 0} Participants
                  </span>
                </div>
              </div>

              {activeTab === "overview" && (
                <>
                  {(data.venue || data.venueCoordinates) && (
                    <div className="mb-6">
                      <VenueMapPreview
                        venue={data.venue || data.location}
                        coordinates={data.venueCoordinates}
                      />
                    </div>
                  )}

                  {data.summary && (
                    <div className="mt-8">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                        Meeting Summary
                      </h3>
                      <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
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
                          <div className="bg-green-50 dark:bg-green-950/30 rounded-xl p-6 border border-green-100 dark:border-green-800/40">
                            <h3 className="text-lg font-semibold text-green-900 dark:text-green-300 mb-4">
                              Key Decisions
                            </h3>
                            <ul className="list-disc pl-5 space-y-2 text-green-800 dark:text-green-200">
                              {data.structuredMoM.decisions.map((desc, idx) => (
                                <li key={idx}>{desc}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                      {data.structuredMoM.action_items &&
                        data.structuredMoM.action_items.length > 0 && (
                          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-6 border border-amber-100 dark:border-amber-800/40">
                            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300 mb-4">
                              Action Items
                            </h3>
                            <ul className="space-y-3">
                              {data.structuredMoM.action_items.map(
                                (item, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-3 bg-white dark:bg-gray-800 p-3 rounded-lg border border-amber-200 dark:border-amber-800/60"
                                  >
                                    <div className="flex-1 text-gray-800 dark:text-gray-200">
                                      {item.task}
                                    </div>
                                    {item.assignee && (
                                      <div className="text-xs font-medium bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-2 py-1 rounded">
                                        {item.assignee}
                                      </div>
                                    )}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                    </div>
                  )}
                </>
              )}

              {activeTab === "transcript" && data.transcriptExcerpt && (
                <div
                  className="mt-4 space-y-3"
                  data-testid="shared-transcript-section"
                >
                  {data.transcriptExcerpt.map((segment, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-100 dark:border-gray-700 rounded-lg p-3"
                    >
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                        {segment.speaker}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {segment.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "attachments" && data.attachments && (
                <ul
                  className="mt-4 space-y-3"
                  data-testid="shared-attachments-section"
                >
                  {data.attachments.map((file) => (
                    <li
                      key={file._id}
                      className="flex items-center gap-3 border border-gray-100 dark:border-gray-700 rounded-lg p-3"
                    >
                      <Paperclip className="w-4 h-4 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {file.mimeType} · {Math.round(file.fileSize / 1024)}{" "}
                          KB
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {activeTab === "clips" && data.clips && (
                <div
                  className="mt-4 space-y-4"
                  data-testid="shared-clips-section"
                >
                  {data.clips.map((clip) => (
                    <div
                      key={clip._id}
                      className="border border-gray-100 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Scissors className="w-4 h-4 text-indigo-500" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {clip.title}
                        </h4>
                      </div>
                      {clip.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                          {clip.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {clip.startTime}s – {clip.endTime}s
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-lg shrink-0">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                  {data.name}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  Version {data.version}
                </p>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Policy Summary
              </h3>
              {data.summary ? (
                <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-xl border border-gray-100 dark:border-gray-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {data.summary}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 italic">
                  No summary available for this policy.
                </p>
              )}
            </div>

            {data.key_changes && data.key_changes.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Key Elements
                </h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
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

import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Building,
  Video,
  Cpu,
  Search,
  BarChart3,
  CheckCircle2,
  UploadCloud,
  Play,
  FileText,
  RotateCcw,
  Sparkles,
  Users,
  SearchIcon,
  ChevronRight,
  Plus,
  Send,
  Loader2,
  FileCheck,
} from "lucide-react";

const HowItWorks = () => {
  const { t, i18n } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [resetNonce, setResetNonce] = useState(0);
  const [simulationState, setSimulationState] = useState({
    orgName: "",
    orgCreated: false,
    orgMembers: ["Alex Smith", "Emma Johnson"],
    newMember: "",
    uploadProgress: 0,
    uploading: false,
    uploadDone: false,
    transcribing: false,
    transcriptionText: [],
    aiSummary: null,
    searchQuery: "",
    searchFinished: false,
    searchResults: [],
    reportGenerated: false,
    generatingReport: false,
  });

  const scrollContainerRef = useRef(null);

  // Steps definition
  const steps = [
    {
      id: 0,
      number: "01",
      title: t("howItWorks.step1Title"),
      description: t("howItWorks.step1Desc"),
      icon: Building,
      color: "from-blue-500 to-cyan-500",
      accent: "text-blue-600",
      bgAccent: "bg-blue-50",
      shadow: "shadow-blue-500/10",
    },
    {
      id: 1,
      number: "02",
      title: t("howItWorks.step2Title"),
      description: t("howItWorks.step2Desc"),
      icon: Video,
      color: "from-indigo-500 to-purple-500",
      accent: "text-indigo-600",
      bgAccent: "bg-indigo-50",
      shadow: "shadow-indigo-500/10",
    },
    {
      id: 2,
      number: "03",
      title: t("howItWorks.step3Title"),
      description: t("howItWorks.step3Desc"),
      icon: Cpu,
      color: "from-violet-500 to-fuchsia-500",
      accent: "text-violet-600",
      bgAccent: "bg-violet-50",
      shadow: "shadow-violet-500/10",
    },
    {
      id: 3,
      number: "04",
      title: t("howItWorks.step4Title"),
      description: t("howItWorks.step4Desc"),
      icon: Search,
      color: "from-fuchsia-500 to-pink-500",
      accent: "text-fuchsia-600",
      bgAccent: "bg-fuchsia-50",
      shadow: "shadow-fuchsia-500/10",
    },
    {
      id: 4,
      number: "05",
      title: t("howItWorks.step5Title"),
      description: t("howItWorks.step5Desc"),
      icon: BarChart3,
      color: "from-pink-500 to-rose-500",
      accent: "text-pink-600",
      bgAccent: "bg-rose-50",
      shadow: "shadow-pink-500/10",
    },
  ];

  // Auto-run simulation sequences based on active step selection
  useEffect(() => {
    // Reset specific simulation steps when switching tabs
    if (activeStep === 0) {
      // Step 1 defaults
      setSimulationState((prev) => ({
        ...prev,
        orgName: "Acme Corp",
        orgCreated: false,
        orgMembers: ["Alex Smith", "Emma Johnson"],
      }));
    } else if (activeStep === 1) {
      // Step 2 upload simulation
      setSimulationState((prev) => ({
        ...prev,
        uploadProgress: 0,
        uploading: true,
        uploadDone: false,
      }));
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        if (progress >= 100) {
          clearInterval(interval);
          setSimulationState((prev) => ({
            ...prev,
            uploadProgress: 100,
            uploading: false,
            uploadDone: true,
          }));
        } else {
          setSimulationState((prev) => ({ ...prev, uploadProgress: progress }));
        }
      }, 200);
      return () => clearInterval(interval);
    } else if (activeStep === 2) {
      // Step 3 transcription simulation
      setSimulationState((prev) => ({
        ...prev,
        transcribing: true,
        transcriptionText: [],
        aiSummary: null,
      }));

      const isHindi = i18n.language === "hi";

      const enTrans = [
        "[00:04] Emma: Welcome everyone to our Q3 Strategic Review. Let's discuss the product roadmap.",
        "[00:15] Alex: We should prioritize the integration of semantic search. Users want instant Q&A.",
        "[00:27] Emma: Agreed. Let's set the launch target for late August. John will take the lead on backend integrations.",
        "[00:40] Alex: Excellent. I will sync with marketing to announce it.",
      ];

      const hiTrans = [
        "[00:04] एम्मा: हमारी Q3 रणनीतिक समीक्षा में आप सभी का स्वागत है। आइए उत्पाद रोडमैप पर चर्चा करें।",
        "[00:15] एलेक्स: हमें सिमेंटिक खोज के एकीकरण को प्राथमिकता देनी चाहिए। उपयोगकर्ता तत्काल प्रश्नोत्तर चाहते हैं।",
        "[00:27] एम्मा: सहमत हूँ। आइए अगस्त के अंत के लिए लॉन्च लक्ष्य निर्धारित करें। जॉन बैकएंड एकीकरण का नेतृत्व करेंगे।",
        "[00:40] एलेक्स: उत्कृष्ट। मैं घोषणा करने के लिए विपणन के साथ समन्वय करूँगा।",
      ];

      const fullTrans = isHindi ? hiTrans : enTrans;

      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex < fullTrans.length) {
          setSimulationState((prev) => ({
            ...prev,
            transcriptionText: [
              ...prev.transcriptionText,
              fullTrans[currentIndex],
            ],
          }));
          currentIndex++;
        } else {
          clearInterval(interval);
          setSimulationState((prev) => ({
            ...prev,
            transcribing: false,
            aiSummary: {
              title: isHindi ? "उत्पाद रणनीति और रोडमैप सिंक" : "Product Strategy & Roadmap Sync",
              summary: isHindi
                ? "टीम ने अगस्त के अंत में लक्षित रिलीज तिथि के साथ सिमेंटिक खोज कार्यक्षमता को प्राथमिकता देने पर सहमति व्यक्त की।"
                : "The team aligned on prioritizing semantic search functionality with a target release date in late August.",
              decisions: isHindi
                ? [
                    "अगस्त के अंत में रिलीज के लिए सिमेंटिक खोज सुविधा को प्राथमिकता दें।",
                    "जॉन बैकएंड एकीकरण का नेतृत्व करेंगे।",
                  ]
                : [
                    "Prioritize semantic search feature for late August release.",
                    "John leads backend integration.",
                  ],
              actionItems: isHindi
                ? [
                    { task: "सिमेंटिक खोज एपीआई स्कीमा का मसौदा तैयार करें", owner: "जॉन" },
                    { task: "घोषणा अभियान तैयार करें", owner: "एलेक्स" },
                  ]
                : [
                    { task: "Draft semantic search API schema", owner: "John" },
                    { task: "Prepare announcement campaign", owner: "Alex" },
                  ],
            },
          }));
        }
      }, 800);
      return () => clearInterval(interval);
    } else if (activeStep === 3) {
      // Step 4 semantic search simulation
      setSimulationState((prev) => ({
        ...prev,
        searchQuery: "",
        searchFinished: false,
        searchResults: [],
      }));

      const isHindi = i18n.language === "hi";
      const queryStr = isHindi ? "सिमेंटिक खोज कब लॉन्च हो रही है?" : "When is semantic search launching?";
      let charIdx = 0;
      let resultTimeout;
      const typingInterval = setInterval(() => {
        if (charIdx < queryStr.length) {
          const nextChar = queryStr[charIdx];
          setSimulationState((prev) => ({
            ...prev,
            searchQuery: prev.searchQuery + nextChar,
          }));
          charIdx++;
        } else {
          clearInterval(typingInterval);
          resultTimeout = setTimeout(() => {
            setSimulationState((prev) => ({
              ...prev,
              searchFinished: true,
              searchResults: isHindi
                ? [
                    {
                      title: "Q3 रणनीतिक समीक्षा",
                      date: "जुलाई 2, 2026",
                      snippet:
                        "एम्मा: सहमत हूँ। आइए अगस्त के अंत के लिए लॉन्च लक्ष्य निर्धारित करें।",
                      matchScore: 98,
                    },
                    {
                      title: "साप्ताहिक सिंक",
                      date: "जून 25, 2026",
                      snippet:
                        "हमने अगले महीने सिमेंटिक खोज एकीकरण के लिए नियोजन चरण शुरू करने पर चर्चा की।",
                      matchScore: 84,
                    },
                  ]
                : [
                    {
                      title: "Q3 Strategic Review",
                      date: "July 2, 2026",
                      snippet:
                        "Emma: Agreed. Let's set the launch target for late August.",
                      matchScore: 98,
                    },
                    {
                      title: "Weekly Sync",
                      date: "June 25, 2026",
                      snippet:
                        "We discussed starting the planning phase for semantic search integration next month.",
                      matchScore: 84,
                    },
                  ],
            }));
          }, 400);
        }
      }, 70);
      return () => {
        clearInterval(typingInterval);
        clearTimeout(resultTimeout);
      };
    } else if (activeStep === 4) {
      // Step 5 reports simulation
      setSimulationState((prev) => ({
        ...prev,
        reportGenerated: false,
        generatingReport: false,
      }));
    }
  }, [activeStep, resetNonce, i18n.language]);

  // Restart simulation helper
  const restartSimulation = () => {
    setResetNonce((n) => n + 1);
  };

  return (
    <section
      id="how-it-works"
      className="py-24 bg-linear-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200/50 dark:border-blue-800 uppercase">
            <Sparkles className="w-3.5 h-3.5" /> {t("howItWorks.coreWorkflow")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white mt-4 mb-6 leading-tight">
            {t("howItWorks.howWorksPrefix")}
            <span className="bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              MeetOnMemory
            </span>
            {t("howItWorks.howWorksSuffix")}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
            {t("howItWorks.howWorksDesc")}
          </p>
        </div>

        {/* Workflow Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Sequential Stepper Cards */}
          <div
            className="lg:col-span-5 flex flex-col gap-6 relative"
            ref={scrollContainerRef}
          >
            {/* Visual connector line in background (desktop only) */}
            <div className="absolute left-[34px] top-6 bottom-6 w-0.5 border-l-2 border-dashed border-gray-200 dark:border-slate-800 hidden lg:block -z-10" />

            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isActive = activeStep === idx;

              return (
                <div
                  key={step.id}
                  onClick={() => setActiveStep(idx)}
                  className={`group relative flex gap-6 items-start p-5 rounded-2xl cursor-pointer border transition-all duration-300 ${
                    isActive
                      ? "bg-white dark:bg-slate-800 border-blue-200 dark:border-blue-900 shadow-xl shadow-blue-100/30 dark:shadow-none scale-[1.02]"
                      : "bg-white/50 dark:bg-slate-900/40 border-gray-100 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 hover:border-gray-200 dark:hover:border-slate-700 hover:shadow-lg"
                  }`}
                >
                  {/* Icon & Number Badge */}
                  <div className="relative flex-shrink-0 z-10">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${step.color} text-white shadow-md transition-transform duration-300 group-hover:scale-110`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    {/* Floating Step Number */}
                    <span className="absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-gray-400">
                      {step.number}
                    </span>
                  </div>

                  {/* Card content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3
                        className={`text-lg font-bold transition-colors ${isActive ? "text-gray-900 dark:text-white" : "text-gray-800 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400"}`}
                      >
                        {step.title}
                      </h3>
                      {isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 animate-pulse">
                          {t("howItWorks.liveDemo")}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm leading-relaxed transition-colors ${isActive ? "text-gray-600 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"}`}
                    >
                      {step.description}
                    </p>
                  </div>

                  {/* Active Border Glow */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-2xl border-2 border-blue-600 pointer-events-none opacity-20" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Interactive Sandbox Display (Sticky) */}
          <div className="lg:col-span-7 lg:sticky lg:top-24">
            <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-gray-200/60 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-blue-50/50 dark:shadow-none min-h-[460px] flex flex-col justify-between">
              {/* Header inside Showcase Card */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800 mb-6">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg bg-gradient-to-br ${steps[activeStep].color} text-white`}
                  >
                    {React.createElement(steps[activeStep].icon, {
                      className: "w-5 h-5",
                    })}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                      {t("howItWorks.interactiveSandbox")}
                    </p>
                    <h4 className="text-base font-bold text-gray-800 dark:text-gray-200">
                      {steps[activeStep].title} {t("howItWorks.simulation")}
                    </h4>
                  </div>
                </div>

                <button
                  onClick={restartSimulation}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg transition-colors border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900"
                  title={t("howItWorks.reset")}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t("howItWorks.reset")}</span>
                </button>
              </div>

              {/* SIMULATION AREA */}
              <div className="flex-1 flex flex-col justify-center">
                {/* -------------------- STEP 1: CREATE ORGANIZATION -------------------- */}
                {activeStep === 0 && (
                  <div className="max-w-md mx-auto w-full bg-slate-50 dark:bg-slate-950/40 border border-gray-100 dark:border-slate-800/60 rounded-2xl p-5 shadow-inner">
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" /> {t("howItWorks.createWorkspace")}
                    </h5>

                    {!simulationState.orgCreated ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            {t("howItWorks.orgName")}
                          </label>
                          <input
                            type="text"
                            value={simulationState.orgName}
                            onChange={(e) =>
                              setSimulationState((prev) => ({
                                ...prev,
                                orgName: e.target.value,
                              }))
                            }
                            className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
                            placeholder={t("howItWorks.enterOrgName")}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                            {t("howItWorks.addMembers")}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={simulationState.newMember}
                              onChange={(e) =>
                                setSimulationState((prev) => ({
                                  ...prev,
                                  newMember: e.target.value,
                                }))
                              }
                              className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500"
                              placeholder={t("howItWorks.egMember")}
                              onKeyDown={(e) => {
                                if (
                                  e.key === "Enter" &&
                                  simulationState.newMember.trim()
                                ) {
                                  setSimulationState((prev) => ({
                                    ...prev,
                                    orgMembers: [
                                      ...prev.orgMembers,
                                      prev.newMember.trim(),
                                    ],
                                    newMember: "",
                                  }));
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                if (simulationState.newMember.trim()) {
                                  setSimulationState((prev) => ({
                                    ...prev,
                                    orgMembers: [
                                      ...prev.orgMembers,
                                      prev.newMember.trim(),
                                    ],
                                    newMember: "",
                                  }));
                                }
                              }}
                              className="px-3 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Listed Members */}
                        <div className="flex flex-wrap gap-1.5 py-1">
                          {simulationState.orgMembers.map((member, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-200/60 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
                            >
                              {member}
                            </span>
                          ))}
                        </div>

                        <button
                          onClick={() =>
                            setSimulationState((prev) => ({
                              ...prev,
                              orgCreated: true,
                            }))
                          }
                          disabled={!simulationState.orgName.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-semibold transition-colors shadow-md shadow-blue-500/15"
                        >
                          {t("howItWorks.createOrgBtn")}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center py-6 space-y-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <h6 className="font-bold text-gray-800 dark:text-gray-200 text-base">
                            {t("howItWorks.orgCreated")}
                          </h6>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t("howItWorks.welcomeOrg")}{" "}
                            <strong className="text-blue-600">
                              {simulationState.orgName}
                            </strong>
                            .
                          </p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-lg p-2 text-xs font-semibold text-gray-600 dark:text-gray-300 max-w-xs mx-auto truncate select-all cursor-pointer">
                          https://meetonmemory.com/join/invite-
                          {Math.random().toString(36).substring(2, 7)}
                        </div>
                        <button
                          onClick={() =>
                            setSimulationState((prev) => ({
                              ...prev,
                              orgCreated: false,
                            }))
                          }
                          className="text-xs text-blue-600 font-bold hover:underline"
                        >
                          {t("howItWorks.resetTry")}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------- STEP 2: UPLOAD MEETING -------------------- */}
                {activeStep === 1 && (
                  <div className="max-w-md mx-auto w-full">
                    <div className="border-2 border-dashed border-gray-200/80 dark:border-slate-800 rounded-2xl p-6 bg-slate-50 dark:bg-slate-950/40 text-center flex flex-col items-center justify-center min-h-[220px] transition-all hover:bg-slate-50/50 dark:hover:bg-slate-950/20">
                      {!simulationState.uploadDone ? (
                        <>
                          <div
                            className={`p-4 rounded-full bg-blue-50 text-blue-600 mb-3 ${simulationState.uploading ? "animate-pulse" : ""}`}
                          >
                            <UploadCloud className="w-8 h-8" />
                          </div>

                          {simulationState.uploading ? (
                            <div className="w-full space-y-2">
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {t("howItWorks.uploadingFile")}
                              </p>
                              <div className="w-full bg-gray-200 dark:bg-slate-800 rounded-full h-2 max-w-xs mx-auto overflow-hidden">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                                  style={{
                                    width: `${simulationState.uploadProgress}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-bold text-gray-500">
                                {simulationState.uploadProgress}% completed
                              </span>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                                {t("howItWorks.uploadMeetingFile")}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
                                {t("howItWorks.uploadDesc")}
                              </p>
                              <button
                                onClick={restartSimulation}
                                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-gray-700 dark:text-gray-300 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-50 dark:hover:bg-slate-800 shadow-sm"
                              >
                                {t("howItWorks.selectFile")}
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="space-y-4 w-full">
                          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-sm">
                            <CheckCircle2 className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                              Q3_Strategic_Review.mp4
                            </p>
                            <p className="text-xs text-emerald-600 font-semibold mt-0.5">
                              {t("howItWorks.uploadCompleted")}
                            </p>
                          </div>
                          <div className="flex gap-2 max-w-xs mx-auto justify-center">
                            <span className="px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                              {t("howItWorks.readyProcessing")}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* -------------------- STEP 3: AI PROCESSING -------------------- */}
                {activeStep === 2 && (
                  <div className="w-full max-w-lg mx-auto bg-slate-900 rounded-2xl p-5 font-mono text-xs text-gray-300 shadow-xl border border-slate-800 max-h-[300px] overflow-y-auto flex flex-col gap-4">
                    {/* Code Header Bar */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] font-bold text-slate-500 ml-1.5">
                          {t("howItWorks.aiEngineStream")}
                        </span>
                      </div>

                      {simulationState.transcribing ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-violet-400">
                          <Loader2 className="w-3 h-3 animate-spin" />{" "}
                          {t("howItWorks.processingAudio")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <Sparkles className="w-3 h-3" /> {t("howItWorks.synthesisDone")}
                        </span>
                      )}
                    </div>

                    {/* Speech stream output */}
                    <div className="space-y-2 flex-1">
                      {simulationState.transcriptionText.map((line, i) => (
                        <div
                          key={i}
                          className="text-[11px] leading-relaxed text-slate-300 border-l-2 border-violet-500 pl-2"
                        >
                          {line}
                        </div>
                      ))}

                      {simulationState.transcribing && (
                        <div className="flex gap-1 items-center text-slate-500 animate-pulse text-[11px] pl-2 border-l-2 border-slate-700">
                          <span>{t("howItWorks.scanningWaveforms")}</span>
                          <span className="flex gap-0.5">
                            <span className="h-1.5 w-1 bg-slate-500 rounded animate-bounce" />
                            <span className="h-1.5 w-1 bg-slate-500 rounded animate-bounce [animation-delay:0.2s]" />
                            <span className="h-1.5 w-1 bg-slate-500 rounded animate-bounce [animation-delay:0.4s]" />
                          </span>
                        </div>
                      )}
                    </div>

                    {/* AI Structured summary block */}
                    {simulationState.aiSummary && (
                      <div className="bg-slate-800/80 border border-violet-500/30 rounded-xl p-4 mt-2 space-y-3 text-[11px] text-slate-200">
                        <div className="flex items-center gap-1.5 text-violet-400 font-bold">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {t("howItWorks.generatedInsights")}:{" "}
                            {simulationState.aiSummary.title}
                          </span>
                        </div>

                        <p className="text-slate-300 text-xs italic leading-relaxed">
                          "{simulationState.aiSummary.summary}"
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-700/50">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                              {t("howItWorks.decisions")}
                            </span>
                            <ul className="list-disc list-inside mt-1 space-y-1 text-slate-300">
                              {simulationState.aiSummary.decisions.map(
                                (dec, idx) => (
                                  <li key={idx} className="truncate">
                                    {dec}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                              {t("howItWorks.actionItems")}
                            </span>
                            <ul className="mt-1 space-y-1 text-slate-300">
                              {simulationState.aiSummary.actionItems.map(
                                (act, idx) => (
                                  <li
                                    key={idx}
                                    className="flex justify-between items-center gap-2 bg-slate-900/50 p-1 px-1.5 rounded"
                                  >
                                    <span className="truncate">{act.task}</span>
                                    <span className="text-[9px] font-bold px-1 py-0.5 bg-violet-950 text-violet-300 rounded border border-violet-800/40 capitalize">
                                      {act.owner}
                                    </span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------- STEP 4: SEARCH KNOWLEDGE -------------------- */}
                {activeStep === 3 && (
                  <div className="max-w-md mx-auto w-full space-y-4">
                    {/* Search Field */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <SearchIcon className="w-4 h-4" />
                      </div>
                      <div className="w-full bg-slate-50 dark:bg-slate-950/40 border border-gray-200 dark:border-slate-800 rounded-xl pl-9 pr-20 py-2.5 text-sm text-gray-800 dark:text-gray-200 flex items-center min-h-[42px] relative">
                        {simulationState.searchQuery}
                        {/* Cursor blinking */}
                        <span className="inline-block w-0.5 h-4 bg-blue-600 animate-pulse ml-0.5" />

                        <div className="absolute right-2 top-1.5">
                          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-semibold rounded-md">
                            Semantic Q&A
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Results Container */}
                    <div className="min-h-[160px] space-y-3">
                      {!simulationState.searchFinished ? (
                        <div className="text-center py-8 text-gray-400 text-xs italic">
                          {t("howItWorks.typeQuery")}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          <p className="text-[11px] font-bold text-gray-500">
                            {simulationState.searchResults.length} {t("howItWorks.matchingResults")}:
                          </p>
                          {simulationState.searchResults.map((result, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-50 dark:bg-slate-950/40 border border-gray-100 dark:border-slate-800/60 p-3.5 rounded-xl flex justify-between items-start gap-4 hover:border-gray-200 dark:hover:border-slate-800 transition-colors"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h6 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                    {result.title}
                                  </h6>
                                  <span className="text-[9px] text-gray-400 font-medium">
                                    {result.date}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                                  "{result.snippet}"
                                </p>
                              </div>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900 flex-shrink-0">
                                {result.matchScore}% {t("howItWorks.matchScore")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* -------------------- STEP 5: GENERATE REPORTS -------------------- */}
                {activeStep === 4 && (
                  <div className="max-w-md mx-auto w-full space-y-5 bg-slate-50 dark:bg-slate-950/40 border border-gray-100 dark:border-slate-800/60 rounded-2xl p-5 shadow-inner">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200/60 dark:border-slate-800">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                        {t("howItWorks.analyticsBriefing")}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {t("howItWorks.currentMonth")}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-2.5 rounded-xl text-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">
                          {t("howItWorks.meetings")}
                        </span>
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          42
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-2.5 rounded-xl text-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">
                          {t("howItWorks.hours")}
                        </span>
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          84h
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 p-2.5 rounded-xl text-center">
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">
                          {t("howItWorks.decisions")}
                        </span>
                        <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                          12
                        </span>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block">
                        {t("howItWorks.recentAiBriefings")}
                      </span>
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-350 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer">
                        <span className="flex items-center gap-1.5 font-medium">
                          <FileText className="w-3.5 h-3.5 text-rose-500" />
                          Executive_Product_Report_Q3.pdf
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">
                          2.4 MB
                        </span>
                      </div>
                    </div>

                    {!simulationState.reportGenerated ? (
                      <button
                        onClick={() => {
                          setSimulationState((prev) => ({
                            ...prev,
                            generatingReport: true,
                          }));
                          setTimeout(() => {
                            setSimulationState((prev) => ({
                              ...prev,
                              generatingReport: false,
                              reportGenerated: true,
                            }));
                          }, 1200);
                        }}
                        disabled={simulationState.generatingReport}
                        className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-all shadow-md shadow-rose-500/10 flex items-center justify-center gap-2"
                      >
                        {simulationState.generatingReport ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t("howItWorks.compilingData")}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            {t("howItWorks.generateReportBtn")}
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-350 text-xs font-semibold">
                          <div className="p-1 rounded-full bg-emerald-100 text-emerald-600">
                            <FileCheck className="w-4 h-4" />
                          </div>
                          <span>{t("howItWorks.reportCompiled")}</span>
                        </div>
                        <button
                          onClick={() =>
                            setSimulationState((prev) => ({
                              ...prev,
                              reportGenerated: false,
                            }))
                          }
                          className="text-[10px] text-emerald-700 hover:underline font-bold"
                        >
                          {t("howItWorks.generateAnother")}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Progress Stepper indicator under showcase */}
              <div className="pt-6 border-t border-gray-100 dark:border-slate-800 flex justify-between items-center text-xs text-gray-500 mt-6 flex-wrap gap-2">
                <span>{t("howItWorks.stepCount", { step: steps[activeStep].number })}</span>

                <div className="flex gap-1">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveStep(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        activeStep === i
                          ? `w-6 bg-gradient-to-r ${steps[i].color}`
                          : "w-2 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700"
                      }`}
                      aria-label={`Go to step ${i + 1}`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setActiveStep((activeStep + 1) % 5)}
                  className="font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5 group/btn"
                >
                  {t("howItWorks.nextStep")}
                  <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

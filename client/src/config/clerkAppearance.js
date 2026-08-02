/**
 * Shared Clerk appearance config aligned with MeetOnMemory's dark auth surfaces.
 * Prefer Clerk's appearance API over CSS overrides of Clerk internals.
 *
 * Email-first: phone identifier UI is explicitly hidden. Clerk Dashboard must
 * also disable Phone as a sign-up/sign-in factor for full removal.
 */
export const meetOnMemoryClerkAppearance = {
  variables: {
    colorPrimary: "#6366f1",
    colorDanger: "#ef4444",
    colorSuccess: "#22c55e",
    colorWarning: "#f59e0b",
    colorText: "#f1f5f9",
    colorTextSecondary: "#94a3b8",
    colorTextOnPrimaryBackground: "#ffffff",
    colorBackground: "#0f172a",
    colorInputBackground: "rgba(30, 41, 59, 0.4)",
    colorInputText: "#f1f5f9",
    colorNeutral: "#64748b",
    borderRadius: "0.75rem",
    fontFamily: "inherit",
    fontFamilyButtons: "inherit",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    card: "bg-transparent shadow-none border-0 w-full",
    headerTitle: "text-white text-2xl font-bold tracking-tight",
    headerSubtitle: "text-slate-400 text-sm",
    socialButtonsBlockButton:
      "bg-slate-800/60 border border-slate-600/40 text-slate-100 hover:bg-slate-800 rounded-xl",
    socialButtonsBlockButtonText: "text-slate-100 font-medium",
    dividerLine: "bg-slate-700/40",
    dividerText: "text-slate-500",
    formFieldLabel:
      "text-slate-400 text-xs font-semibold uppercase tracking-wider",
    formFieldInput:
      "bg-slate-800/40 border border-slate-600/40 text-slate-100 rounded-xl placeholder:text-slate-600 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/20",
    formButtonPrimary:
      "bg-gradient-to-r from-indigo-500 to-indigo-900 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40",
    footerActionLink: "text-indigo-400 hover:text-indigo-300 font-semibold",
    identityPreviewEditButton: "text-indigo-400",
    formFieldAction: "text-indigo-400 hover:text-indigo-300",
    alternateMethodsBlockButton:
      "bg-slate-800/60 border border-slate-600/40 text-slate-100 rounded-xl",
    // Email verification OTP (keep). Phone SMS OTP UI is hidden below.
    otpCodeFieldInput:
      "bg-slate-800/40 border border-slate-600/40 text-slate-100 rounded-lg",
    alertText: "text-slate-300",
    formFieldErrorText: "text-red-400",
    footer: "bg-transparent",
    footerActionText: "text-slate-400",

    // Hide every phone-auth surface Clerk may still render from instance config
    formFieldRow__phoneNumber: { display: "none" },
    formFieldLabel__phoneNumber: { display: "none" },
    formFieldInput__phoneNumber: { display: "none" },
    formFieldHintText__phoneNumber: { display: "none" },
    formFieldErrorText__phoneNumber: { display: "none" },
    formFieldSuccessText__phoneNumber: { display: "none" },
    formFieldAction__phoneNumber: { display: "none" },
    formFieldInputShowPasswordButton__phoneNumber: { display: "none" },
    phoneInputBox: { display: "none" },
    formField__phoneNumber: { display: "none" },
    identityPreviewEditButton__phoneNumber: { display: "none" },
  },
  layout: {
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    termsPageUrl: "/terms",
    privacyPageUrl: "/privacy",
    showOptionalFields: false,
  },
  options: {
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    termsPageUrl: "/terms",
    privacyPageUrl: "/privacy",
    showOptionalFields: false,
  },
};

/**
 * Localization overrides that remove phone-auth copy / "Use phone" actions.
 * Does not change MeetOnMemory visual branding.
 */
export const meetOnMemoryClerkLocalization = {
  formFieldLabel__phoneNumber: "",
  formFieldInputPlaceholder__phoneNumber: "",
  formFieldHintText__phoneNumber: "",
  signIn: {
    start: {
      actionLink__use_phone: "",
      subtitle__phone: "",
      title__phone: "",
    },
    phoneCode: {
      title: "",
      subtitle: "",
    },
  },
  signUp: {
    start: {
      actionLink__use_phone: "",
      subtitle__phone: "",
      title__phone: "",
    },
    phoneCode: {
      title: "",
      subtitle: "",
    },
  },
};

/** Prefill / suppress phone identifier so Clerk starts on email */
export const meetOnMemoryClerkInitialValues = {
  phoneNumber: null,
};

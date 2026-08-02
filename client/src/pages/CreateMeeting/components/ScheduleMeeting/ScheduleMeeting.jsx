import { Calendar, Loader2, Send, FileText } from "lucide-react";
import MeetingInformationForm from "./MeetingInformationForm";
import ParticipantsSection from "./ParticipantsSection";
import AgendaSection from "./AgendaSection";
import AttachmentSection from "./AttachmentSection";
import CalendarNotice from "./CalendarNotice";
import DraftRecoveryBanner from "./DraftRecoveryBanner";
import SmartAgendaGenerator from "../../../../components/meetings/SmartAgendaGenerator";

const ScheduleMeeting = ({ hookProps, loadingDuplicate = false }) => {
  const {
    scheduleData,
    setScheduleData,
    participants,
    newParticipant,
    setNewParticipant,
    agendaItems,
    newAgenda,
    setNewAgenda,
    attachments,
    loading,
    templates,
    selectedTemplateId,
    handleTemplateSelect,
    handleScheduleChange,
    addParticipant,
    removeParticipant,
    addAgendaItem,
    removeAgendaItem,
    reorderAgendaItem,
    handleAttachmentUpload,
    removeAttachment,
    handleScheduleSubmit,
    recoverableDraft,
    lastSavedAt,
    draftStatus,
    restoreDraft,
    discardDraft,
    aiSummaryTemplates,
    selectedAiSummaryTemplateId,
    setSelectedAiSummaryTemplateId,
  } = hookProps;

  return (
    <div className="bg-white shadow-lg rounded-2xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <Calendar className="text-blue-600" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Schedule Meeting</h2>
          <p className="text-sm text-gray-600">
            Create and manage meeting schedules with automatic calendar
            integration
          </p>
        </div>
      </div>

      {loadingDuplicate && (
        <div
          className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800"
          role="status"
        >
          Loading reusable meeting details...
        </div>
      )}

      <form onSubmit={handleScheduleSubmit}>
        <DraftRecoveryBanner
          savedAt={recoverableDraft?.savedAt}
          lastSavedAt={lastSavedAt}
          status={draftStatus}
          onRestore={restoreDraft}
          onDiscard={discardDraft}
        />
        <MeetingInformationForm
          scheduleData={scheduleData}
          setScheduleData={setScheduleData}
          handleScheduleChange={handleScheduleChange}
        />

        <ParticipantsSection
          participants={participants}
          newParticipant={newParticipant}
          setNewParticipant={setNewParticipant}
          addParticipant={addParticipant}
          removeParticipant={removeParticipant}
        />

        {templates && templates.length > 0 && (
          <div className="mb-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <label className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-2">
              <FileText size={16} /> Load Meeting Template
            </label>
            <select
              value={selectedTemplateId}
              onChange={handleTemplateSelect}
              className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-400 outline-none text-sm text-gray-700"
            >
              <option value="">
                -- Select a template to populate agenda --
              </option>
              {templates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.title} ({t.agendaBlocks?.length || 0} items)
                </option>
              ))}
            </select>
          </div>
        )}

        {aiSummaryTemplates && aiSummaryTemplates.length > 0 && (
          <div className="mb-6 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
            <label className="flex items-center gap-2 text-sm font-semibold text-indigo-900 mb-2">
              <FileText size={16} /> AI Summary Instructions
            </label>
            <select
              value={selectedAiSummaryTemplateId || ""}
              onChange={(e) => setSelectedAiSummaryTemplateId(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none text-sm text-gray-700"
            >
              <option value="">-- Standard Summary Format --</option>
              {aiSummaryTemplates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name} {t.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
            <p className="text-xs text-indigo-700 mt-2">
              Custom instructions allow you to dictate exactly how the AI will
              write the MoM (e.g. Sales BANT, Sprint Retro).
            </p>
          </div>
        )}

        <AgendaSection
          agendaItems={agendaItems}
          newAgenda={newAgenda}
          setNewAgenda={setNewAgenda}
          addAgendaItem={addAgendaItem}
          removeAgendaItem={removeAgendaItem}
          reorderAgendaItem={reorderAgendaItem}
        />

        <AttachmentSection
          attachments={attachments}
          handleAttachmentUpload={handleAttachmentUpload}
          removeAttachment={removeAttachment}
        />

        <CalendarNotice />

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || loadingDuplicate}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Scheduling & Syncing Calendars...
            </>
          ) : (
            <>
              <Send size={18} /> Schedule Meeting & Send Invites
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default ScheduleMeeting;

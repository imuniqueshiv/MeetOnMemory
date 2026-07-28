import { Calendar, Loader2, Send, FileText } from "lucide-react";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { knowledgeApi } from "../../../../services/knowledgeApi";
import MeetingInformationForm from "./MeetingInformationForm";
import ParticipantsSection from "./ParticipantsSection";
import AgendaSection from "./AgendaSection";
import AttachmentSection from "./AttachmentSection";
import CalendarNotice from "./CalendarNotice";

const ScheduleMeeting = ({ hookProps }) => {
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
    handleAttachmentUpload,
    removeAttachment,
    handleScheduleSubmit,
  } = hookProps;

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const actionItemsParam = searchParams.get("sourceActionItems");
    if (actionItemsParam) {
      const ids = actionItemsParam.split(",");
      const fetchPreFillData = async () => {
        try {
          const res = await knowledgeApi.getActionItems("all");
          if (res.data?.success) {
            const selectedItems = res.data.actionItems.filter((item) =>
              ids.includes(item.id || item._id)
            );

            if (selectedItems.length > 0) {
              // Pre-fill Title
              const firstSourceMeeting = selectedItems.find(
                (item) => item.sourceMeetingId
              )?.sourceMeetingId;
              const title = firstSourceMeeting?.title
                ? `Follow-up: ${firstSourceMeeting.title}`
                : "Follow-up Meeting";

              setScheduleData((prev) => ({
                ...prev,
                title,
                sourceActionItemIds: ids,
              }));

              // Pre-fill Agenda Items
              const newAgendaItems = selectedItems.map((item) => ({
                text: item.text,
                description: item.owner ? `Owner: ${item.owner}` : "",
                duration: null,
                id: Date.now().toString() + Math.random(),
              }));
              hookProps.setAgendaItems(newAgendaItems);
            }
          }
        } catch (error) {
          console.error("Failed to fetch action items for pre-fill:", error);
        }
      };
      fetchPreFillData();
    }
  }, [searchParams, setScheduleData, hookProps]);

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

      <form onSubmit={handleScheduleSubmit}>
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

        <AgendaSection
          agendaItems={agendaItems}
          newAgenda={newAgenda}
          setNewAgenda={setNewAgenda}
          addAgendaItem={addAgendaItem}
          removeAgendaItem={removeAgendaItem}
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
          disabled={loading}
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

import { Video } from "lucide-react";
import LiveParticipants from "./LiveParticipants";
import LiveMeetingInfo from "./LiveMeetingInfo";
import RecordingDialog from "./RecordingDialog";

const LiveMeeting = ({ hookProps }) => {
  const {
    liveParticipants,
    newLiveParticipant,
    setNewLiveParticipant,
    showRecordingDialog,
    addLiveParticipant,
    removeLiveParticipant,
    handleStartLiveMeeting,
    handleRecordingChoice,
  } = hookProps;

  return (
    <div className="bg-white shadow-lg rounded-2xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <Video className="text-indigo-600" size={28} />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Start Live Meeting
          </h2>
          <p className="text-sm text-gray-600">
            Add participants and start a live meeting with optional AI
            transcription
          </p>
        </div>
      </div>

      <LiveParticipants
        liveParticipants={liveParticipants}
        newLiveParticipant={newLiveParticipant}
        setNewLiveParticipant={setNewLiveParticipant}
        addLiveParticipant={addLiveParticipant}
        removeLiveParticipant={removeLiveParticipant}
      />

      <LiveMeetingInfo />

      {/* Start Meeting Button */}
      <button
        type="button"
        onClick={handleStartLiveMeeting}
        disabled={liveParticipants.length === 0}
        className={`w-full px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold transition flex items-center justify-center gap-2 shadow-md hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-indigo-700`}
      >
        <Video size={18} /> 🚀 Start Live Meeting
      </button>

      {showRecordingDialog && (
        <RecordingDialog handleRecordingChoice={handleRecordingChoice} />
      )}
    </div>
  );
};

export default LiveMeeting;

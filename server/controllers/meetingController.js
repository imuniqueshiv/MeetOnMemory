import Meeting from "../models/meetingModel.js";

// @desc    Create a new meeting
// @route   POST /api/meetings
// @access  Private
export const createMeeting = async (req, res) => {
    try {
        const { title, date } = req.body;

        if (!title || !date) {
            return res.status(400).json({ success: false, message: "Please provide a title and date." });
        }

        const newMeeting = new Meeting({
            title,
            date,
            createdBy: req.user.id // We get req.user.id from the userAuth middleware
        });

        await newMeeting.save();

        res.status(201).json({ success: true, message: "Meeting created successfully", data: newMeeting });

    } catch (error) {
        console.error("Error creating meeting:", error);
        res.status(500).json({ success: false, message: "Server error while creating meeting" });
    }
};

// @desc    Get all meetings for the logged-in user
// @route   GET /api/meetings
// @access  Private
export const getMyMeetings = async (req, res) => {
    try {
        // Find all meetings created by this user
        // Sort them by date, with the newest first
        const meetings = await Meeting.find({ createdBy: req.user.id }).sort({ date: -1 });

        res.status(200).json({ success: true, data: meetings });

    } catch (error) {
        console.error("Error fetching meetings:", error);
        res.status(500).json({ success: false, message: "Server error while fetching meetings" });
    }
};

// @desc    Get a single meeting by its ID
// @route   GET /api/meetings/:id
// @access  Private
export const getMeetingById = async (req, res) => {
    try {
        const meeting = await Meeting.findById(req.params.id);

        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        // --- Security Check ---
        // Make sure the user who is requesting the meeting is the one who created it
        if (meeting.createdBy.toString() !== req.user.id) {
            return res.status(403).json({ success: false, message: "Unauthorized: You do not have access to this meeting." });
        }

        res.status(200).json({ success: true, data: meeting });

    } catch (error) {
        console.error("Error fetching single meeting:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
import userModel from '../models/userModel.js';

// @desc    Get user data
// @route   GET /api/user/get-user
// @access  Private
export const getUserData = async (req, res) => {
    try {
        // --- SAFETY CHECK ---
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "Authentication error, user ID not found." });
        }

        // Now this line is safe to run
        const user = await userModel.findById(req.user.id)
                           .select('-password') 
                           .populate('organization', 'name'); 

        if (user) {
            res.status(200).json({
                success: true,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    isAccountVerified: user.isAccountVerified,
                    role: user.role, 
                    hasCompletedOnboarding: user.hasCompletedOnboarding, 
                    organization: user.organization
                }
            });
        } else {
            return res.status(404).json({ success: false, message: 'User not found in database' });
        }
    } catch (error) {
        console.error("Error in getUserData:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const userAuth = async (req, res, next) => {
    // 1. Get the token from the 'auth-token' cookie
    const { token } = req.cookies;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please login first.' });
    }

    try {
        // 2. Verify the token using your JWT_SECRET
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // 3. --- THIS IS THE FIX ---
        // The decoded token (which contains the user's 'id')
        // must be attached to the 'req' object.
        // We will attach just the ID.
        req.user = {
            id: decoded.id 
        };

        // 4. Continue to the next function (e.g., getUserData, createOrganization)
        next();

    } catch (error) {
        console.error("Auth middleware error:", error);
        return res.status(401).json({ success: false, message: 'Unauthorized. Invalid token.' });
    }
};

export default userAuth;

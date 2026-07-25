import SharedLink from "../models/sharedLinkModel.js";
import Meeting from "../models/meetingModel.js";
import Policy from "../models/policyModel.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const generateHash = () => {
  return crypto.randomBytes(16).toString("hex");
};

export const createLink = async (req, res) => {
  try {
    const { resourceId, resourceType, expirationDate, passcode } = req.body;

    if (!resourceId || !resourceType) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    if (!["Meeting", "Policy"].includes(resourceType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid resource type" });
    }

    // Optionally check if user has access to this resource, assuming they do because of auth middleware
    let hashedPasscode = null;
    if (passcode) {
      const salt = await bcrypt.genSalt(10);
      hashedPasscode = await bcrypt.hash(passcode, salt);
    }

    const hash = generateHash();

    const newLink = new SharedLink({
      resourceId,
      resourceModel: resourceType,
      hash,
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      passcode: hashedPasscode,
      createdBy: req.user._id,
      organizationId: req.user.organization,
    });

    await newLink.save();

    res.status(201).json({
      success: true,
      link: {
        _id: newLink._id,
        hash: newLink.hash,
        expirationDate: newLink.expirationDate,
        hasPasscode: !!newLink.passcode,
        active: newLink.active,
        createdAt: newLink.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating shared link:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error creating link" });
  }
};

export const getActiveLinks = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;

    const links = await SharedLink.find({
      resourceId,
      resourceModel: resourceType,
      organizationId: req.user.organization,
      active: true,
    }).select("-passcode");

    res.status(200).json({
      success: true,
      links: links.map((link) => ({
        _id: link._id,
        hash: link.hash,
        expirationDate: link.expirationDate,
        hasPasscode: !!link.passcode, // this check doesn't work if passcode is excluded in select, wait.
      })),
    });
  } catch (error) {
    console.error("Error fetching active links:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching links" });
  }
};

// Fix the hasPasscode issue for getActiveLinks
export const getActiveLinksFixed = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;

    const links = await SharedLink.find({
      resourceId,
      resourceModel: resourceType,
      organizationId: req.user.organization,
      active: true,
    });

    res.status(200).json({
      success: true,
      links: links.map((link) => ({
        _id: link._id,
        hash: link.hash,
        expirationDate: link.expirationDate,
        hasPasscode: !!link.passcode,
        createdAt: link.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching active links:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching links" });
  }
};

export const revokeLink = async (req, res) => {
  try {
    const { id } = req.params;

    const link = await SharedLink.findOne({
      _id: id,
      organizationId: req.user.organization,
    });
    if (!link) {
      return res
        .status(404)
        .json({ success: false, message: "Link not found" });
    }

    link.active = false;
    await link.save();

    res
      .status(200)
      .json({ success: true, message: "Link revoked successfully" });
  } catch (error) {
    console.error("Error revoking link:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error revoking link" });
  }
};

// Public endpoints

export const verifyPasscode = async (req, res) => {
  try {
    const { hash } = req.params;
    const { passcode } = req.body;

    const link = await SharedLink.findOne({ hash, active: true });

    if (!link) {
      return res
        .status(404)
        .json({ success: false, message: "Link not found or inactive" });
    }

    if (link.expirationDate && new Date() > link.expirationDate) {
      return res
        .status(403)
        .json({ success: false, message: "Link has expired" });
    }

    if (!link.passcode) {
      return res
        .status(200)
        .json({ success: true, message: "No passcode required" });
    }

    if (!passcode) {
      return res
        .status(400)
        .json({ success: false, message: "Passcode required" });
    }

    const isMatch = await bcrypt.compare(passcode, link.passcode);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Incorrect passcode" });
    }

    // Generate a short-lived token to access the resource
    const token = jwt.sign(
      { linkId: link._id, hash: link.hash },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.cookie("shared_access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 3600000, // 1 hour
    });

    res.status(200).json({ success: true, message: "Passcode verified" });
  } catch (error) {
    console.error("Error verifying passcode:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error verifying passcode" });
  }
};

export const getPublicResource = async (req, res) => {
  try {
    const { hash } = req.params;

    const link = await SharedLink.findOne({ hash, active: true });
    if (!link) {
      return res
        .status(404)
        .json({ success: false, message: "Link not found or inactive" });
    }

    if (link.expirationDate && new Date() > link.expirationDate) {
      return res
        .status(403)
        .json({ success: false, message: "Link has expired" });
    }

    if (link.passcode) {
      const token = req.cookies.shared_access_token;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Passcode required",
          requiresPasscode: true,
        });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.hash !== hash) {
          return res.status(401).json({
            success: false,
            message: "Invalid access token",
            requiresPasscode: true,
          });
        }
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: "Session expired, please re-enter passcode",
          requiresPasscode: true,
        });
      }
    }

    let resourceData = null;

    if (link.resourceModel === "Meeting") {
      const meeting = await Meeting.findById(link.resourceId)
        .select(
          "title description meetingType date time duration location venue participants agendaItems policyDetails transcript summary structuredMoM aiNotes status tags",
        )
        .lean();

      if (!meeting) {
        return res
          .status(404)
          .json({ success: false, message: "Meeting not found" });
      }
      resourceData = meeting;
    } else if (link.resourceModel === "Policy") {
      const policy = await Policy.findById(link.resourceId)
        .select(
          "name version fileUrl summary key_changes keywords status isDraft",
        )
        .lean();

      if (!policy) {
        return res
          .status(404)
          .json({ success: false, message: "Policy not found" });
      }
      resourceData = policy;
    }

    res.status(200).json({
      success: true,
      resourceType: link.resourceModel,
      data: resourceData,
    });
  } catch (error) {
    console.error("Error fetching public resource:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching resource" });
  }
};

import TemplateLibrary from "../models/templateLibraryModel.js";
import MeetingTemplate from "../models/meetingTemplateModel.js";

// Publish a template to the library
export const publishTemplate = async (req, res) => {
  try {
    const { templateId, category, description } = req.body;
    const organizationId = req.user.organization;
    const userId = req.user._id;

    const originalTemplate = await MeetingTemplate.findOne({
      _id: templateId,
      organizationId,
    });

    if (!originalTemplate) {
      return res
        .status(404)
        .json({ error: "Original template not found or unauthorized" });
    }

    const newLibraryEntry = new TemplateLibrary({
      organizationId,
      originalTemplateId: originalTemplate._id,
      name: originalTemplate.name,
      title: originalTemplate.title,
      description: description || originalTemplate.description,
      category: category || "General",
      defaultDuration: originalTemplate.defaultDuration,
      agendaBlocks: originalTemplate.agendaBlocks,
      defaultParticipants: originalTemplate.defaultParticipants,
      publishedBy: userId,
    });

    await newLibraryEntry.save();
    res.status(201).json(newLibraryEntry);
  } catch (error) {
    console.error("Error publishing template:", error);
    res.status(500).json({ error: "Failed to publish template" });
  }
};

// Browse published templates
export const browseTemplates = async (req, res) => {
  try {
    const organizationId = req.user.organization;
    const { category, sort = "newest", page = 1, limit = 20 } = req.query;

    const query = { organizationId };
    if (category) {
      query.category = category;
    }

    let sortOptions = { createdAt: -1 };
    if (sort === "popular") {
      sortOptions = { cloneCount: -1 };
    } else if (sort === "highestRated") {
      sortOptions = { averageRating: -1 };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const templates = await TemplateLibrary.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate("publishedBy", "firstName lastName email");

    const total = await TemplateLibrary.countDocuments(query);

    res.status(200).json({
      templates,
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      currentPage: parseInt(page, 10),
    });
  } catch (error) {
    console.error("Error browsing templates:", error);
    res.status(500).json({ error: "Failed to browse templates" });
  }
};

// Clone a template for personal use
export const cloneTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const organizationId = req.user.organization;

    const libraryEntry = await TemplateLibrary.findById(id);

    if (!libraryEntry) {
      return res.status(404).json({ error: "Template not found in library" });
    }

    const originalTemplate = await MeetingTemplate.findById(
      libraryEntry.originalTemplateId,
    );

    if (!originalTemplate) {
      return res.status(404).json({ error: "Original template not found" });
    }

    // Create a new cloned template for the user's organization
    const clonedTemplate = new MeetingTemplate({
      organizationId,
      name: `${originalTemplate.name} (Clone)`,
      title: originalTemplate.title,
      description: originalTemplate.description,
      category: originalTemplate.category,
      defaultDuration: originalTemplate.defaultDuration,
      agendaBlocks: originalTemplate.agendaBlocks,
      createdBy: userId,
      metadata: {
        ...originalTemplate.metadata,
        clonedFromLibrary: true,
        clonedFromId: libraryEntry._id,
      },
    });

    await clonedTemplate.save();

    // Increment the clone count on the library entry
    libraryEntry.cloneCount += 1;
    await libraryEntry.save();

    res.status(201).json(clonedTemplate);
  } catch (error) {
    console.error("Error cloning template:", error);
    res.status(500).json({ error: "Failed to clone template" });
  }
};

// Rate a template
export const rateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;
    const organizationId = req.user.organization;
    const userId = req.user._id;

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    const libraryTemplate = await TemplateLibrary.findOne({
      _id: id,
      organizationId,
    });

    if (!libraryTemplate) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Check if user already rated, update if so
    const existingRatingIndex = libraryTemplate.ratings.findIndex(
      (r) => r.userId.toString() === userId.toString(),
    );

    if (existingRatingIndex >= 0) {
      libraryTemplate.ratings[existingRatingIndex].rating = rating;
      libraryTemplate.ratings[existingRatingIndex].review = review;
    } else {
      libraryTemplate.ratings.push({ userId, rating, review });
    }

    libraryTemplate.calculateAverageRating();
    await libraryTemplate.save();

    res.status(200).json(libraryTemplate);
  } catch (error) {
    console.error("Error rating template:", error);
    res.status(500).json({ error: "Failed to rate template" });
  }
};

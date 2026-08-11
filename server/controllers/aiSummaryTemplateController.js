import AiSummaryTemplate from "../models/aiSummaryTemplateModel.js";

// @desc    Create a new AI summary template
// @route   POST /api/ai-summary-templates
// @access  Private
export const createTemplate = async (req, res) => {
  try {
    const { name, description, customInstructions, expectedFormat, isDefault } =
      req.body;

    if (!name) {
      return res.status(400).json({ message: "Template name is required" });
    }

    if (isDefault) {
      // Unset existing default for the organization
      await AiSummaryTemplate.updateMany(
        { organization: req.user.organization },
        { isDefault: false },
      );
    }

    const template = new AiSummaryTemplate({
      organization: req.user.organization,
      name,
      description,
      customInstructions,
      expectedFormat,
      isDefault: isDefault || false,
      createdBy: req.user._id,
    });

    const savedTemplate = await template.save();
    res.status(201).json(savedTemplate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all AI summary templates for the organization
// @route   GET /api/ai-summary-templates
// @access  Private
export const getTemplates = async (req, res) => {
  try {
    const templates = await AiSummaryTemplate.find({
      organization: req.user.organization,
    }).sort({ createdAt: -1 });

    res.json(templates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get a single template by ID
// @route   GET /api/ai-summary-templates/:id
// @access  Private
export const getTemplateById = async (req, res) => {
  try {
    const template = await AiSummaryTemplate.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    res.json(template);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a template
// @route   PUT /api/ai-summary-templates/:id
// @access  Private
export const updateTemplate = async (req, res) => {
  try {
    const { name, description, customInstructions, expectedFormat, isDefault } =
      req.body;

    const template = await AiSummaryTemplate.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (isDefault && !template.isDefault) {
      await AiSummaryTemplate.updateMany(
        { organization: req.user.organization },
        { isDefault: false },
      );
    }

    template.name = name || template.name;
    template.description =
      description !== undefined ? description : template.description;
    template.customInstructions =
      customInstructions !== undefined
        ? customInstructions
        : template.customInstructions;
    template.expectedFormat = expectedFormat || template.expectedFormat;

    if (isDefault !== undefined) {
      template.isDefault = isDefault;
    }

    const updatedTemplate = await template.save();
    res.json(updatedTemplate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a template
// @route   DELETE /api/ai-summary-templates/:id
// @access  Private
export const deleteTemplate = async (req, res) => {
  try {
    const template = await AiSummaryTemplate.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    await template.deleteOne();
    res.json({ message: "Template removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set template as default
// @route   PUT /api/ai-summary-templates/:id/default
// @access  Private
export const setDefaultTemplate = async (req, res) => {
  try {
    const template = await AiSummaryTemplate.findOne({
      _id: req.params.id,
      organization: req.user.organization,
    });

    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    // Unset others
    await AiSummaryTemplate.updateMany(
      { organization: req.user.organization },
      { isDefault: false },
    );

    // Set this as default
    template.isDefault = true;
    await template.save();

    res.json({ message: "Default template updated successfully", template });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

import { generateMoMDetailed } from "../services/GenerativeAIService.js";

// @desc    Test template prompt against dummy transcript
// @route   POST /api/ai-summary-templates/test
// @access  Private
export const testTemplate = async (req, res) => {
  try {
    const { customInstructions } = req.body;

    if (!customInstructions) {
      return res
        .status(400)
        .json({ message: "customInstructions is required for testing" });
    }

    const dummyTranscript = `
Speaker 1: Hi everyone, let's start the Q3 review meeting. How are the sales numbers looking?
Speaker 2: We hit 120% of our quota in North America. However, Europe is lagging behind due to some supply chain delays.
Speaker 1: Understood. Let's make sure we allocate more budget to the logistics team in Europe to resolve this.
Speaker 2: Agreed. I will sync with the logistics head by Friday to map out a plan.
Speaker 1: Great. Anything else?
Speaker 2: No, that covers it.
    `;

    const { mom } = await generateMoMDetailed(
      dummyTranscript,
      new Date().toISOString().split("T")[0],
      "Q3 Review Meeting (Dummy)",
      customInstructions,
    );

    res.json(mom);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

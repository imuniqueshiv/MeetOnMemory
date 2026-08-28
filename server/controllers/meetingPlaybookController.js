import * as playbookService from "../services/meetingPlaybookService.js";

export const createPlaybook = async (req, res) => {
  try {
    const playbook = await playbookService.createPlaybook({
      ...req.body,
      createdBy: req.user._id, // Assuming req.user is populated by auth middleware
    });
    res.status(201).json(playbook);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getPlaybooks = async (req, res) => {
  try {
    const playbooks = await playbookService.getPlaybooks();
    res.status(200).json(playbooks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPlaybook = async (req, res) => {
  try {
    const playbook = await playbookService.getPlaybookById(req.params.id);
    res.status(200).json(playbook);
  } catch (error) {
    if (error.message === "Playbook not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const updatePlaybook = async (req, res) => {
  try {
    const playbook = await playbookService.updatePlaybook(
      req.params.id,
      req.body,
    );
    res.status(200).json(playbook);
  } catch (error) {
    if (error.message === "Playbook not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(400).json({ error: error.message });
  }
};

export const deletePlaybook = async (req, res) => {
  try {
    await playbookService.deletePlaybook(req.params.id);
    res.status(204).send();
  } catch (error) {
    if (error.message === "Playbook not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

export const generateAIPlaybook = async (req, res) => {
  try {
    const { prompt, meetingType } = req.body;
    if (!prompt || !meetingType) {
      return res
        .status(400)
        .json({ error: "prompt and meetingType are required" });
    }
    const playbook = await playbookService.generatePlaybookFromAI(
      prompt,
      meetingType,
      req.user._id,
    );
    res.status(201).json(playbook);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

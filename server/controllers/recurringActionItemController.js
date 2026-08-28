import RecurringActionItem from "../models/recurringActionItemModel.js";
import { generateInstances } from "../services/recurringActionItemService.js";

export const getRecurringActionItems = async (req, res) => {
  try {
    const items = await RecurringActionItem.find({
      organization: req.user.organization,
    })
      .populate("assignee", "firstName lastName email")
      .populate("meetingSeriesId", "name title"); // assuming meetingSeries has a title or name
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRecurringActionItemById = async (req, res) => {
  try {
    const item = await RecurringActionItem.findById(req.params.id)
      .populate("assignee", "firstName lastName email")
      .populate("meetingSeriesId", "name title");
    if (!item) return res.status(404).json({ error: "Not found" });
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createRecurringActionItem = async (req, res) => {
  try {
    const newItem = new RecurringActionItem({
      ...req.body,
      organization: req.user.organization,
      owner: req.user.firstName + " " + req.user.lastName,
    });
    const savedItem = await newItem.save();

    // Generate instances right away for upcoming meetings
    await generateInstances(savedItem._id, 7);

    res.status(201).json(savedItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateRecurringActionItem = async (req, res) => {
  try {
    const updatedItem = await RecurringActionItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );
    if (!updatedItem) return res.status(404).json({ error: "Not found" });
    res.status(200).json(updatedItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteRecurringActionItem = async (req, res) => {
  try {
    const deletedItem = await RecurringActionItem.findByIdAndDelete(
      req.params.id,
    );
    if (!deletedItem) return res.status(404).json({ error: "Not found" });
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

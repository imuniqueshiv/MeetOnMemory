import Meeting from "../models/meetingModel.js";
import SavedFilter from "../models/savedFilterModel.js";

class SavedFilterService {
  /**
   * Translates a filter object into a Mongoose query object for Meetings
   * @param {Object} filters The filter criteria
   * @param {String} orgId The organization ID
   * @returns {Object} Mongoose query object
   */
  buildQuery(filters, orgId) {
    const query = { organization: orgId, deletedAt: null };

    if (!filters) return query;

    // Search query
    if (filters.searchQuery && filters.searchQuery.trim() !== "") {
      const searchRegex = new RegExp(filters.searchQuery.trim(), "i");
      query.$or = [
        { title: searchRegex },
        { summary: searchRegex },
        { transcript: searchRegex },
        { tags: searchRegex },
      ];
    }

    // Status
    if (filters.status && filters.status !== "all") {
      query.status = filters.status;
    }

    // Meeting Type
    if (filters.meetingType && filters.meetingType !== "all") {
      query.meetingType = filters.meetingType;
    }

    // Date Range
    if (filters.dateRange && filters.dateRange !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let startDate = null;

      switch (filters.dateRange) {
        case "today":
          startDate = today;
          break;
        case "week":
          startDate = new Date(today);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate = new Date(today);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "year":
          startDate = new Date(today);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      if (startDate) {
        // Handle both date field and fallback to createdAt
        query.$or = query.$or || [];
        if (query.$or.length === 0) {
          query.$or = [
            { date: { $gte: startDate } },
            { date: null, createdAt: { $gte: startDate } },
          ];
        } else {
          // If $or already exists (e.g. from searchQuery), we need $and
          const dateCondition = {
            $or: [
              { date: { $gte: startDate } },
              { date: null, createdAt: { $gte: startDate } },
            ],
          };

          if (!query.$and) query.$and = [];
          query.$and.push(dateCondition);
        }
      }
    }

    return query;
  }

  /**
   * Refreshes match counts for all pinned filters of a user in an org
   * @param {String} userId The user ID
   * @param {String} orgId The organization ID
   */
  async refreshMatchCounts(userId, orgId) {
    const pinnedFilters = await SavedFilter.find({
      organization: orgId,
      $or: [{ user: userId }, { isShared: true }],
      isPinned: true,
    });

    for (const filter of pinnedFilters) {
      const query = this.buildQuery(filter.filters, orgId);
      const count = await Meeting.countDocuments(query);

      if (filter.matchCount !== count) {
        filter.matchCount = count;
        await filter.save();
      }
    }
  }
}

export default new SavedFilterService();

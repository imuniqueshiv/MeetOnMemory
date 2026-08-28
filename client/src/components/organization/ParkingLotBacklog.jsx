import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { parkingLotApi } from "../../services";
import { Lightbulb, Trash2 } from "lucide-react";
import { toast } from "react-toastify";

const ParkingLotBacklog = ({ organizationId }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await parkingLotApi.getOrganizationParkingLot(
        organizationId,
        { status: "pending" },
      );
      if (data.success) {
        setItems(data.data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch parking lot items", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) {
      fetchItems();
    }
  }, [organizationId, fetchItems]);

  const handleDiscard = async (id) => {
    try {
      const { data } = await parkingLotApi.updateTopicStatus(id, {
        status: "discarded",
      });
      if (data.success) {
        toast.success("Item discarded.");
        fetchItems();
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to discard item.");
    }
  };

  if (loading) {
    return (
      <div className="p-4 border rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        Loading parking lot...
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="text-yellow-500" size={20} />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Parking Lot Backlog
          </h3>
        </div>
        {organizationId ? (
          <Link
            to="/parking-lot"
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            View all
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No pending items in the parking lot.
        </p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item._id}
              className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700 flex flex-col gap-2"
            >
              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                {item.topic}
              </p>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="truncate max-w-[120px]">
                    Added by: {item.submittedBy?.name || "Unknown"}
                  </span>
                  <span>•</span>
                  <span className="truncate max-w-[120px]">
                    From: {item.sourceMeetingId?.title || "Meeting"}
                  </span>
                </div>
                <button
                  onClick={() => handleDiscard(item._id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  title="Discard Topic"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ParkingLotBacklog;

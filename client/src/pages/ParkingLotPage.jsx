import React, { useState, useEffect, useContext, useCallback } from 'react'
import { Link } from 'react-router-dom'
import AppContent from '../context/AppContent.js'
import { parkingLotApi, meetingApi } from '../services'
import Navbar from '../components/Navbar.jsx'
import {
  Lightbulb,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Trash2,
  ExternalLink,
  UserCheck,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'react-toastify'

const ParkingLotPage = () => {
  const { userData } = useContext(AppContent)
  const [items, setItems] = useState([])
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [bulkAssigning, setBulkAssigning] = useState(false)

  // Filters state
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMeetingFilter, setSelectedMeetingFilter] = useState('all')

  // Selection for bulk ops
  const [selectedItemIds, setSelectedItemIds] = useState([])
  const [targetMeetingId, setTargetMeetingId] = useState('')

  const orgId = userData?.organization?._id || userData?.organization

  const fetchParkingLotItems = useCallback(async () => {
    if (!orgId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const params = {}
      if (statusFilter !== 'all') {
        params.status = statusFilter
      }

      const { data } = await parkingLotApi.getOrganizationParkingLot(orgId, params)

      if (data.success) {
        setItems(data.data.items || [])
      } else {
        setItems([])
      }
    } catch (err) {
      console.error('Failed to load parking lot backlog:', err)
      setError(
        err.response?.data?.message || 'Failed to load parking lot items for your organization.',
      )
      toast.error('Failed to load parking lot items.')
    } finally {
      setLoading(false)
    }
  }, [orgId, statusFilter])

  const fetchOrgMeetings = useCallback(async () => {
    if (!orgId) return
    try {
      const { data } = await meetingApi.getMeetings({ limit: 100 })
      if (data.success) {
        setMeetings(data.meetings || data.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch meetings for assignment:', err)
    }
  }, [orgId])

  useEffect(() => {
    fetchParkingLotItems()
    fetchOrgMeetings()
  }, [fetchParkingLotItems, fetchOrgMeetings])

  // Handle single item status update
  const handleUpdateStatus = async (id, newStatus, scheduledForMeetingId = null) => {
    try {
      setUpdatingId(id)
      const payload = { status: newStatus }
      if (scheduledForMeetingId) {
        payload.scheduledForMeetingId = scheduledForMeetingId
      }

      const { data } = await parkingLotApi.updateTopicStatus(id, payload)
      if (data.success) {
        toast.success(`Topic marked as ${newStatus}`)
        fetchParkingLotItems()
      }
    } catch (err) {
      console.error('Error updating topic status:', err)
      toast.error(err.response?.data?.message || 'Failed to update topic status')
    } finally {
      setUpdatingId(null)
    }
  }

  // Handle bulk assignment to a meeting
  const handleBulkAssign = async () => {
    if (selectedItemIds.length === 0) {
      toast.error('Please select at least one topic to assign.')
      return
    }
    if (!targetMeetingId) {
      toast.error('Please select a target meeting for assignment.')
      return
    }

    try {
      setBulkAssigning(true)
      const { data } = await parkingLotApi.assignTopics({
        topicIds: selectedItemIds,
        meetingId: targetMeetingId,
      })

      if (data.success) {
        toast.success(`Successfully assigned ${selectedItemIds.length} topics to meeting!`)
        setSelectedItemIds([])
        setTargetMeetingId('')
        fetchParkingLotItems()
      }
    } catch (err) {
      console.error('Error assigning topics in bulk:', err)
      toast.error(err.response?.data?.message || 'Failed to assign topics.')
    } finally {
      setBulkAssigning(false)
    }
  }

  const toggleSelectItem = (id) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const toggleSelectAll = () => {
    if (selectedItemIds.length === filteredItems.length) {
      setSelectedItemIds([])
    } else {
      setSelectedItemIds(filteredItems.map((item) => item._id))
    }
  }

  // Filter items locally by search query and meeting filter
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.submittedBy?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sourceMeetingId?.title?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesMeeting =
      selectedMeetingFilter === 'all' ||
      item.sourceMeetingId?._id === selectedMeetingFilter ||
      item.sourceMeetingId === selectedMeetingFilter

    return matchesSearch && matchesMeeting
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-200 flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl text-yellow-600 dark:text-yellow-400">
              <Lightbulb size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Parking Lot Backlog
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Organization-wide backlog of deferred topics, ideas, and unscheduled discussions
              </p>
            </div>
          </div>

          <button
            onClick={fetchParkingLotItems}
            className="flex items-center px-4 py-2 border border-gray-300 dark:border-gray-700 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm"
          >
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search topics, submitters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <Filter size={18} className="text-gray-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="discarded">Discarded</option>
              </select>
            </div>

            {/* Source Meeting Filter */}
            <div className="flex items-center space-x-2">
              <Calendar size={18} className="text-gray-400 shrink-0" />
              <select
                value={selectedMeetingFilter}
                onChange={(e) => setSelectedMeetingFilter(e.target.value)}
                className="w-full py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Source Meetings</option>
                {meetings.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Selection Counter */}
            <div className="flex items-center justify-between sm:justify-end text-sm text-gray-500 dark:text-gray-400 px-2">
              <span>Total Items: {filteredItems.length}</span>
              {selectedItemIds.length > 0 && (
                <span className="font-semibold text-blue-600 dark:text-blue-400 ml-2">
                  ({selectedItemIds.length} selected)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bulk Action Controls */}
        {selectedItemIds.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <UserCheck className="text-blue-600 dark:text-blue-400" size={20} />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Bulk Action: Assign {selectedItemIds.length} topic(s) to a meeting
              </span>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <select
                value={targetMeetingId}
                onChange={(e) => setTargetMeetingId(e.target.value)}
                className="py-1.5 px-3 border border-blue-300 dark:border-blue-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select target meeting...</option>
                {meetings.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.title}
                  </option>
                ))}
              </select>

              <button
                onClick={handleBulkAssign}
                disabled={bulkAssigning || !targetMeetingId}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors shrink-0"
              >
                {bulkAssigning ? 'Assigning...' : 'Assign Topics'}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading parking lot backlog...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-2">
              Error Loading Backlog
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mb-6">{error}</p>
            <button
              onClick={fetchParkingLotItems}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm transition-colors"
            >
              Retry Loading
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredItems.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
              No parking lot items found
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No deferred topics match your current search and filter criteria.
            </p>
          </div>
        )}

        {/* Items List */}
        {!loading && !error && filteredItems.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
              <label className="flex items-center space-x-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    selectedItemIds.length > 0 && selectedItemIds.length === filteredItems.length
                  }
                  onChange={toggleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>Select All Visible</span>
              </label>

              <span className="text-xs text-gray-500 dark:text-gray-400">
                Showing {filteredItems.length} items
              </span>
            </div>

            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredItems.map((item) => (
                <div
                  key={item._id}
                  className={`p-4 sm:p-5 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    selectedItemIds.includes(item._id)
                      ? 'bg-blue-50/50 dark:bg-blue-900/10'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
                  }`}
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item._id)}
                      onChange={() => toggleSelectItem(item._id)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0"
                    />

                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                        <span className="text-base font-semibold text-gray-900 dark:text-white">
                          {item.topic}
                        </span>

                        {/* Status Badge */}
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${
                            item.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : item.status === 'scheduled'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>

                      {/* Source Meeting & Submitter Details */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>Submitted by: {item.submittedBy?.name || 'Unknown'}</span>

                        {item.sourceMeetingId && (
                          <div className="flex items-center space-x-1">
                            <span>From meeting:</span>
                            <Link
                              to={`/meetings/${item.sourceMeetingId._id || item.sourceMeetingId}`}
                              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center inline-flex font-medium"
                            >
                              <span>{item.sourceMeetingId.title || 'View Meeting'}</span>
                              <ExternalLink size={12} className="ml-1" />
                            </Link>
                          </div>
                        )}

                        {item.scheduledForMeetingId && (
                          <div className="flex items-center space-x-1">
                            <span>Scheduled for:</span>
                            <Link
                              to={`/meetings/${item.scheduledForMeetingId._id || item.scheduledForMeetingId}`}
                              className="text-green-600 dark:text-green-400 hover:underline flex items-center inline-flex font-medium"
                            >
                              <span>
                                {item.scheduledForMeetingId.title || 'View Scheduled Meeting'}
                              </span>
                              <ExternalLink size={12} className="ml-1" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                    {item.status !== 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(item._id, 'pending')}
                        disabled={updatingId === item._id}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
                        title="Mark as Pending"
                      >
                        <Clock size={14} className="mr-1 text-yellow-500" />
                        Reopen
                      </button>
                    )}

                    {item.status !== 'scheduled' && (
                      <button
                        onClick={() => handleUpdateStatus(item._id, 'scheduled')}
                        disabled={updatingId === item._id}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
                        title="Mark as Scheduled"
                      >
                        <CheckCircle size={14} className="mr-1 text-green-500" />
                        Schedule
                      </button>
                    )}

                    {item.status !== 'discarded' && (
                      <button
                        onClick={() => handleUpdateStatus(item._id, 'discarded')}
                        disabled={updatingId === item._id}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center"
                        title="Discard Topic"
                      >
                        <Trash2 size={14} className="mr-1 text-red-500" />
                        Discard
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ParkingLotPage

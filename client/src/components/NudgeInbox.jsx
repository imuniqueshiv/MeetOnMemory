import React, { useCallback, useEffect, useState } from 'react'
import { getMyNudges, updateNudgeStatus } from '../api/meetingNudgeApi'
import { Link } from 'react-router-dom'

const NudgeInbox = ({ organizationId }) => {
  const [nudges, setNudges] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchNudges = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getMyNudges(organizationId)
      setNudges(data)
    } catch (err) {
      console.error('Failed to fetch nudges', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchNudges()
  }, [fetchNudges])

  const handleDismiss = async (id) => {
    try {
      await updateNudgeStatus(id, 'DISMISSED')
      setNudges((prev) => prev.filter((n) => n._id !== id))
    } catch (err) {
      console.error('Failed to dismiss nudge', err)
    }
  }

  const handleActedOn = async (id) => {
    try {
      await updateNudgeStatus(id, 'ACTED_ON')
      setNudges((prev) => prev.filter((n) => n._id !== id))
    } catch (err) {
      console.error('Failed to act on nudge', err)
    }
  }

  if (loading) return <div className="p-4 text-gray-500">Loading nudges...</div>

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-red-100 dark:border-red-900/50 overflow-hidden mb-6">
        <div className="p-4 text-center">
          <p className="text-red-600 dark:text-red-400">Unable to load meeting nudges.</p>
          <button
            onClick={fetchNudges}
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!nudges.length) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-indigo-100 dark:border-indigo-900/50 overflow-hidden mb-6">
      <div className="bg-indigo-50 dark:bg-indigo-900/30 px-4 py-3 border-b border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
        <h3 className="font-semibold text-indigo-800 dark:text-indigo-300 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            ></path>
          </svg>
          Preparation Nudges
        </h3>
        <span className="bg-indigo-600 text-white text-xs px-2 py-1 rounded-full font-bold">
          {nudges.length} pending
        </span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {nudges.map((nudge) => (
          <div
            key={nudge._id}
            className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <Link
                  to={`/meeting/${nudge.meetingId?._id}`}
                  className="font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  {nudge.meetingId?.title || 'Upcoming Meeting'}
                </Link>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  {nudge.nudgeType === 'UNRESOLVED_ACTION_ITEMS' &&
                    `You have ${nudge.context?.count} unresolved action items to complete.`}
                  {nudge.nudgeType === 'AGENDA_REVIEW' &&
                    'Review the agenda to prepare for this meeting.'}
                  {nudge.nudgeType === 'GENERAL_PREP' &&
                    'Your readiness score is low. Check meeting details to catch up.'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex space-x-2">
              <button
                onClick={() => handleActedOn(nudge._id)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                Mark as Done
              </button>
              <button
                onClick={() => handleDismiss(nudge._id)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NudgeInbox

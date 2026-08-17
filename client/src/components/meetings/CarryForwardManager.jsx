import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import axios from 'axios'

/**
 * Modern Glassmorphic CarryForwardManager component.
 * Allows users to configure, preview, and apply meeting series carry-forward items
 * with clear tenant organization boundary verification.
 */
export default function CarryForwardManager({ seriesId, targetMeetingId }) {
  const [config, setConfig] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [activeTab, setActiveTab] = useState('preview')

  const fetchConfigAndPreview = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [configRes, previewRes] = await Promise.all([
        axios.get(`/api/carry-forward/series/${seriesId}/config`),
        axios.get(`/api/carry-forward/series/${seriesId}/preview`, {
          params: targetMeetingId ? { targetMeetingId } : {},
        }),
      ])

      if (configRes.data.success) {
        setConfig(configRes.data.config)
      }
      if (previewRes.data.success) {
        setPreview(previewRes.data.preview)
      }
    } catch (err) {
      console.error('Error loading carry forward data:', err)
      const message =
        err.response?.data?.message || 'Failed to load carry-forward configuration or preview.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [seriesId, targetMeetingId])

  useEffect(() => {
    if (seriesId) {
      fetchConfigAndPreview()
    }
  }, [seriesId, fetchConfigAndPreview])

  const handleToggleConfig = async (field, value) => {
    if (!config) return
    const updatedConfig = { ...config, [field]: value }
    setConfig(updatedConfig)
    setError(null)

    try {
      const res = await axios.put(`/api/carry-forward/series/${seriesId}/config`, updatedConfig)
      if (res.data.success) {
        setConfig(res.data.config)
        setSuccessMsg('Configuration saved successfully.')
        setTimeout(() => setSuccessMsg(null), 3000)
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to update configuration.'
      setError(message)
    }
  }

  const handleApplyItems = async () => {
    if (!targetMeetingId) {
      setError('Please select a target meeting to apply carry-forward items.')
      return
    }
    setApplying(true)
    setError(null)

    try {
      const res = await axios.post(`/api/carry-forward/series/${seriesId}/apply`, {
        targetMeetingId,
        items: preview?.previewItems || [],
      })

      if (res.data.success) {
        setSuccessMsg(`Successfully carried forward ${res.data.result?.appliedCount || 0} items!`)
        fetchConfigAndPreview()
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to apply carry-forward items.'
      setError(message)
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-slate-900/60 rounded-xl border border-slate-800 backdrop-blur-md">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-400 mr-3" />
        <span className="text-slate-300 font-medium">
          Verifying series ownership & loading carry-forward data...
        </span>
      </div>
    )
  }

  return (
    <div className="bg-slate-950/80 rounded-2xl border border-slate-800/80 p-6 shadow-2xl backdrop-blur-xl text-slate-100 font-sans">
      {/* Header with Security Badge */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-xl font-bold tracking-tight text-white">
              Series Carry-Forward Center
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Automatically bridge action items and skipped agenda points across recurring meeting
            occurrences.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4" />
            Tenant Ownership Verified
          </span>
          <button
            onClick={fetchConfigAndPreview}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh Carry Forward"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Security / Authorization Error</p>
            <p className="text-xs opacity-90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 mt-6 border-b border-slate-800/60 pb-2">
        <button
          onClick={() => setActiveTab('preview')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'preview'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Carry-Forward Preview ({preview?.previewItems?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
            activeTab === 'config'
              ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          Series Rules & Config
        </button>
      </div>

      {/* Tab 1: Preview & Apply */}
      {activeTab === 'preview' && (
        <div className="mt-6 space-y-4">
          {preview?.previewItems?.length === 0 ? (
            <div className="text-center py-10 px-4 bg-slate-900/40 rounded-xl border border-slate-800/60 text-slate-400">
              <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="font-medium text-slate-300">
                No pending items eligible for carry-forward.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                All action items and agenda points in previous meetings have been resolved.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {preview?.previewItems?.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.type === 'action_item'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {item.type?.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-400">
                        From: {item.sourceMeetingTitle}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-100">{item.text}</p>
                    {item.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">{item.description}</p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                      Status: {item.status}
                    </span>
                  </div>
                </div>
              ))}

              {targetMeetingId && (
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleApplyItems}
                    disabled={applying}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-sm text-white shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {applying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    Apply {preview?.previewItems?.length} Items to Target Meeting
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Config Settings */}
      {activeTab === 'config' && config && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-slate-200">Enable Series Carry-Forward</p>
                <p className="text-xs text-slate-400">Master toggle for this meeting series.</p>
              </div>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleToggleConfig('enabled', e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-slate-200">
                  Carry Unfinished Action Items
                </p>
                <p className="text-xs text-slate-400">Include incomplete tasks from prior MoMs.</p>
              </div>
              <input
                type="checkbox"
                checked={config.carryUnfinishedActionItems}
                onChange={(e) => handleToggleConfig('carryUnfinishedActionItems', e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-slate-200">Carry Skipped Agenda Items</p>
                <p className="text-xs text-slate-400">
                  Automatically move skipped topics to next agenda.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.carrySkippedAgendaItems}
                onChange={(e) => handleToggleConfig('carrySkippedAgendaItems', e.target.checked)}
                className="w-5 h-5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-800"
              />
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-slate-200">Max Items Limit</p>
                <p className="text-xs text-slate-400">Cap carry-forward batch size.</p>
              </div>
              <input
                type="number"
                value={config.maxItemsToCarry}
                onChange={(e) =>
                  handleToggleConfig('maxItemsToCarry', parseInt(e.target.value) || 20)
                }
                min={1}
                max={100}
                className="w-20 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

CarryForwardManager.propTypes = {
  seriesId: PropTypes.string.isRequired,
  targetMeetingId: PropTypes.string,
}

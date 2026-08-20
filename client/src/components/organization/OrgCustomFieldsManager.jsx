import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sliders,
  Type,
  Hash,
  ListFilter,
  Calendar as CalendarIcon,
  CheckSquare,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'react-toastify'
import { customFieldApi } from '../../api/customFieldApi.js'

const FIELD_TYPES = [
  { label: 'Text', value: 'text', icon: Type, description: 'Single-line string field' },
  { label: 'Number', value: 'number', icon: Hash, description: 'Numeric value' },
  {
    label: 'Dropdown',
    value: 'dropdown',
    icon: ListFilter,
    description: 'Select from predefined list',
  },
  { label: 'Date', value: 'date', icon: CalendarIcon, description: 'Date picker selection' },
  {
    label: 'Checkbox',
    value: 'checkbox',
    icon: CheckSquare,
    description: 'Boolean true/false toggle',
  },
]

const OrgCustomFieldsManager = ({ orgId, canEdit = true }) => {
  const [definitions, setDefinitions] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [fieldForm, setFieldForm] = useState({
    name: '',
    type: 'text',
    required: false,
    active: true,
    optionsInput: '',
  })

  const loadDefinitions = useCallback(async () => {
    if (!orgId) return
    try {
      setLoading(true)
      setError(null)
      const res = await customFieldApi.getDefinitions(orgId)
      setDefinitions(res.data || [])
    } catch (err) {
      console.error('Failed to load organization custom fields', err)
      setError('Unable to load custom field definitions.')
      toast.error('Failed to load custom fields')
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    loadDefinitions()
  }, [loadDefinitions])

  const resetForm = () => {
    setFieldForm({
      name: '',
      type: 'text',
      required: false,
      active: true,
      optionsInput: '',
    })
    setEditingId(null)
  }

  const handleOpenCreateModal = () => {
    resetForm()
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (def) => {
    setEditingId(def._id)
    setFieldForm({
      name: def.name || '',
      type: def.type || 'text',
      required: Boolean(def.required),
      active: def.active !== undefined ? def.active : true,
      optionsInput: Array.isArray(def.options) ? def.options.join(', ') : '',
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!fieldForm.name.trim()) {
      toast.error('Field name is required')
      return
    }

    let parsedOptions = undefined
    if (fieldForm.type === 'dropdown') {
      parsedOptions = fieldForm.optionsInput
        .split(',')
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0)

      if (parsedOptions.length === 0) {
        toast.error('Dropdown type requires at least one option')
        return
      }
    }

    try {
      setSubmitting(true)
      if (editingId) {
        // Update
        const payload = {
          name: fieldForm.name.trim(),
          required: fieldForm.required,
          active: fieldForm.active,
        }
        if (fieldForm.type === 'dropdown') {
          payload.options = parsedOptions
        }
        await customFieldApi.updateDefinition(orgId, editingId, payload)
        toast.success('Custom field definition updated')
      } else {
        // Create
        const payload = {
          name: fieldForm.name.trim(),
          type: fieldForm.type,
          required: fieldForm.required,
          options: parsedOptions,
        }
        await customFieldApi.createDefinition(orgId, payload)
        toast.success('Custom field definition created')
      }

      setIsModalOpen(false)
      resetForm()
      await loadDefinitions()
    } catch (err) {
      console.error('Failed to save custom field definition', err)
      const msg = err.response?.data?.message || err.message || 'Failed to save definition'
      toast.error(typeof msg === 'string' ? msg : 'Invalid field definition')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (defId, name) => {
    if (
      !window.confirm(
        `Are you sure you want to delete custom field "${name}"? This action removes all stored values for meetings.`,
      )
    ) {
      return
    }
    try {
      setLoading(true)
      await customFieldApi.deleteDefinition(orgId, defId)
      toast.success(`Custom field "${name}" deleted`)
      await loadDefinitions()
    } catch (err) {
      console.error('Failed to delete custom field', err)
      toast.error(err.response?.data?.message || 'Failed to delete custom field')
      setLoading(false)
    }
  }

  const handleToggleActive = async (def) => {
    try {
      await customFieldApi.updateDefinition(orgId, def._id, {
        active: !def.active,
      })
      toast.success(`Custom field "${def.name}" ${def.active ? 'deactivated' : 'activated'}`)
      await loadDefinitions()
    } catch (err) {
      console.error('Failed to toggle field active status', err)
      toast.error('Failed to update status')
    }
  }

  if (!orgId) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden mb-8">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Organization Custom Fields
            </h2>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Define custom metadata attributes collectable across all organization meetings.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg shadow-sm transition-colors gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Custom Field
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400 mb-2" />
            <p className="text-sm">Loading field definitions...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        ) : definitions.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            <Sliders className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              No Custom Fields Defined
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              Create custom fields like Project ID, Cost Center, or Sprint Number to organize
              meeting metadata.
            </p>
            {canEdit && (
              <button
                onClick={handleOpenCreateModal}
                className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors gap-2"
              >
                <Plus className="w-4 h-4" />
                Define First Field
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs uppercase font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3">Field Name</th>
                  <th className="px-4 py-3">Data Type</th>
                  <th className="px-4 py-3">Options / Validation</th>
                  <th className="px-4 py-3">Required</th>
                  <th className="px-4 py-3">Status</th>
                  {canEdit && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {definitions.map((def) => {
                  const typeObj = FIELD_TYPES.find((t) => t.value === def.type)
                  const Icon = typeObj?.icon || Type

                  return (
                    <tr
                      key={def._id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {def.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          <Icon className="w-3.5 h-3.5" />
                          {typeObj?.label || def.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {def.type === 'dropdown' && def.options ? (
                          <span className="truncate max-w-xs block" title={def.options.join(', ')}>
                            Options: {def.options.join(', ')}
                          </span>
                        ) : (
                          <span className="italic">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {def.required ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                            Required
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Optional</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          disabled={!canEdit}
                          onClick={() => handleToggleActive(def)}
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded transition-colors ${
                            def.active !== false
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                          }`}
                        >
                          {def.active !== false ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditModal(def)}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Edit Field"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(def._id, def.name)}
                              className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="Delete Field"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Edit Custom Field' : 'Create Custom Field'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Field Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={fieldForm.name}
                  onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
                  placeholder="e.g. Project Code, Sprint ID"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Field Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FIELD_TYPES.map((ft) => {
                    const Icon = ft.icon
                    const isSelected = fieldForm.type === ft.value
                    return (
                      <button
                        type="button"
                        key={ft.value}
                        disabled={Boolean(editingId)} // Type cannot be changed after creation
                        onClick={() => setFieldForm({ ...fieldForm, type: ft.value })}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                        } ${editingId ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <Icon className="w-5 h-5 mb-1" />
                        {ft.label}
                      </button>
                    )
                  })}
                </div>
                {editingId && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Field data type cannot be changed after creation.
                  </p>
                )}
              </div>

              {fieldForm.type === 'dropdown' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Dropdown Options (comma-separated) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fieldForm.optionsInput}
                    onChange={(e) => setFieldForm({ ...fieldForm, optionsInput: e.target.value })}
                    placeholder="Option 1, Option 2, Option 3"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={fieldForm.required}
                    onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                  Mark as Required field
                </label>

                {editingId && (
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={fieldForm.active}
                      onChange={(e) => setFieldForm({ ...fieldForm, active: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    Active Field
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Create Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrgCustomFieldsManager

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import OrgCustomFieldsManager from '../OrgCustomFieldsManager'
import { customFieldApi } from '../../../api/customFieldApi'

vi.mock('../../../api/customFieldApi', () => ({
  customFieldApi: {
    getDefinitions: vi.fn(),
    createDefinition: vi.fn(),
    updateDefinition: vi.fn(),
    deleteDefinition: vi.fn(),
  },
}))

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('OrgCustomFieldsManager', () => {
  const orgId = 'org-123'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no custom fields exist', async () => {
    customFieldApi.getDefinitions.mockResolvedValue({ data: [] })

    render(<OrgCustomFieldsManager orgId={orgId} canEdit={true} />)

    expect(screen.getByText('Loading field definitions...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('No Custom Fields Defined')).toBeInTheDocument()
    })
  })

  it('renders custom field definitions in a table', async () => {
    const mockDefs = [
      { _id: 'def-1', name: 'Cost Center', type: 'text', required: true, active: true },
      {
        _id: 'def-2',
        name: 'Priority',
        type: 'dropdown',
        options: ['High', 'Low'],
        required: false,
        active: true,
      },
    ]
    customFieldApi.getDefinitions.mockResolvedValue({ data: mockDefs })

    render(<OrgCustomFieldsManager orgId={orgId} canEdit={true} />)

    await waitFor(() => {
      expect(screen.getByText('Cost Center')).toBeInTheDocument()
      expect(screen.getByText('Priority')).toBeInTheDocument()
      expect(screen.getByText('Options: High, Low')).toBeInTheDocument()
    })
  })

  it('opens modal and creates a new custom field definition', async () => {
    customFieldApi.getDefinitions.mockResolvedValue({ data: [] })
    customFieldApi.createDefinition.mockResolvedValue({
      success: true,
      data: { _id: 'def-3', name: 'Project ID', type: 'text' },
    })

    render(<OrgCustomFieldsManager orgId={orgId} canEdit={true} />)

    await waitFor(() => {
      expect(screen.getByText('No Custom Fields Defined')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Add Custom Field/i }))

    expect(screen.getByText('Create Custom Field')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Project Code/i), {
      target: { value: 'Project ID' },
    })

    fireEvent.click(screen.getByRole('button', { name: /Create Field/i }))

    await waitFor(() => {
      expect(customFieldApi.createDefinition).toHaveBeenCalledWith(orgId, {
        name: 'Project ID',
        type: 'text',
        required: false,
        options: undefined,
      })
    })
  })
})

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NudgeInbox from '../NudgeInbox'
import * as meetingNudgeApi from '../../api/meetingNudgeApi'

vi.mock('../../api/meetingNudgeApi')

describe('NudgeInbox component tests (#2000)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays loading state initially and renders nudges on success', async () => {
    const mockNudges = [
      {
        _id: 'n1',
        meetingId: { _id: 'm123', title: 'Quarterly Strategy' },
        nudgeType: 'UNRESOLVED_ACTION_ITEMS',
        context: { count: 3 },
      },
    ]
    meetingNudgeApi.getMyNudges.mockResolvedValueOnce(mockNudges)

    render(
      <MemoryRouter>
        <NudgeInbox organizationId="org1" />
      </MemoryRouter>,
    )

    expect(meetingNudgeApi.getMyNudges).toHaveBeenCalledWith('org1')

    await waitFor(() => {
      expect(screen.getByText('Quarterly Strategy')).toBeInTheDocument()
    })

    const link = screen.getByRole('link', { name: 'Quarterly Strategy' })
    expect(link).toHaveAttribute('href', '/meeting/m123')
    expect(screen.getByText('You have 3 unresolved action items to complete.')).toBeInTheDocument()
  })

  it('handles empty nudge list by returning null', async () => {
    meetingNudgeApi.getMyNudges.mockResolvedValueOnce([])

    const { container } = render(
      <MemoryRouter>
        <NudgeInbox />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(container.firstChild).toBeNull()
    })
  })

  it('handles error state and allows retry', async () => {
    meetingNudgeApi.getMyNudges.mockRejectedValueOnce(new Error('Network Error'))

    render(
      <MemoryRouter>
        <NudgeInbox />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Unable to load meeting nudges.')).toBeInTheDocument()
    })

    meetingNudgeApi.getMyNudges.mockResolvedValueOnce([])
    fireEvent.click(screen.getByText('Retry'))

    expect(meetingNudgeApi.getMyNudges).toHaveBeenCalledTimes(2)
  })

  it('marks nudge as done and removes it from UI', async () => {
    const mockNudges = [
      {
        _id: 'n1',
        meetingId: { _id: 'm123', title: 'Sync Meeting' },
        nudgeType: 'AGENDA_REVIEW',
      },
    ]
    meetingNudgeApi.getMyNudges.mockResolvedValueOnce(mockNudges)
    meetingNudgeApi.updateNudgeStatus.mockResolvedValueOnce({ success: true })

    render(
      <MemoryRouter>
        <NudgeInbox />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Sync Meeting')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Mark as Done'))

    await waitFor(() => {
      expect(meetingNudgeApi.updateNudgeStatus).toHaveBeenCalledWith('n1', 'ACTED_ON')
      expect(screen.queryByText('Sync Meeting')).not.toBeInTheDocument()
    })
  })

  it('dismisses nudge and removes it from UI', async () => {
    const mockNudges = [
      {
        _id: 'n2',
        meetingId: { _id: 'm456', title: 'Prep Meeting' },
        nudgeType: 'GENERAL_PREP',
      },
    ]
    meetingNudgeApi.getMyNudges.mockResolvedValueOnce(mockNudges)
    meetingNudgeApi.updateNudgeStatus.mockResolvedValueOnce({ success: true })

    render(
      <MemoryRouter>
        <NudgeInbox />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Prep Meeting')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Dismiss'))

    await waitFor(() => {
      expect(meetingNudgeApi.updateNudgeStatus).toHaveBeenCalledWith('n2', 'DISMISSED')
      expect(screen.queryByText('Prep Meeting')).not.toBeInTheDocument()
    })
  })
})

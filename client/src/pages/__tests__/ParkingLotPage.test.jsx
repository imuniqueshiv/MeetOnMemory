// @vitest-environment jsdom
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AppContent from '../../context/AppContent.js'
import ParkingLotPage from '../ParkingLotPage.jsx'
import { parkingLotApi, meetingApi } from '../../services'

vi.mock('react-toastify', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../../components/Navbar.jsx', () => ({
  default: () => <div data-testid="mock-navbar" />,
}))

vi.mock('../../services', () => ({
  parkingLotApi: {
    getOrganizationParkingLot: vi.fn(),
    updateTopicStatus: vi.fn(),
    assignTopics: vi.fn(),
  },
  meetingApi: {
    getMeetings: vi.fn(),
  },
}))

describe('ParkingLotPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    meetingApi.getMeetings.mockResolvedValue({
      data: {
        success: true,
        meetings: [
          { _id: 'm_1', title: 'Engineering Sync' },
          { _id: 'm_2', title: 'Product Roadmap' },
        ],
      },
    })
  })

  it('renders parking lot topics and allows status transition', async () => {
    parkingLotApi.getOrganizationParkingLot.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              _id: 'item_1',
              topic: 'Discuss database migration strategy',
              status: 'pending',
              submittedBy: { name: 'Alice' },
              sourceMeetingId: { _id: 'm_1', title: 'Engineering Sync' },
            },
          ],
        },
      },
    })

    parkingLotApi.updateTopicStatus.mockResolvedValue({
      data: { success: true },
    })

    render(
      <AppContent.Provider value={{ userData: { organization: 'org_123' } }}>
        <MemoryRouter>
          <ParkingLotPage />
        </MemoryRouter>
      </AppContent.Provider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Discuss database migration strategy')).toBeInTheDocument()
    })

    const discardButton = screen.getByRole('button', { name: /discard/i })
    fireEvent.click(discardButton)

    await waitFor(() => {
      expect(parkingLotApi.updateTopicStatus).toHaveBeenCalledWith('item_1', {
        status: 'discarded',
      })
    })
  })

  it('handles filter changes and search filtering', async () => {
    parkingLotApi.getOrganizationParkingLot.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [
            {
              _id: 'item_1',
              topic: 'Topic Alpha',
              status: 'pending',
              submittedBy: { name: 'Bob' },
            },
            {
              _id: 'item_2',
              topic: 'Topic Beta',
              status: 'pending',
              submittedBy: { name: 'Charlie' },
            },
          ],
        },
      },
    })

    render(
      <AppContent.Provider value={{ userData: { organization: 'org_123' } }}>
        <MemoryRouter>
          <ParkingLotPage />
        </MemoryRouter>
      </AppContent.Provider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Topic Alpha')).toBeInTheDocument()
      expect(screen.getByText('Topic Beta')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search topics, submitters...')
    fireEvent.change(searchInput, { target: { value: 'Alpha' } })

    expect(screen.getByText('Topic Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Topic Beta')).not.toBeInTheDocument()
  })
})

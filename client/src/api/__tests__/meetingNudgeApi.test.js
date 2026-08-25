import { beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from '../../services/apiClient'
import { getMeetingReadiness, getMyNudges, updateNudgeStatus } from '../meetingNudgeApi'

vi.mock('../../services/apiClient', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}))

describe('meetingNudgeApi unit tests (#2000)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getMyNudges fetches nudges without organization parameter when unspecified', async () => {
    const mockNudges = [{ _id: 'nudge-1', nudgeType: 'AGENDA_REVIEW' }]
    apiClient.get.mockResolvedValueOnce({ data: mockNudges })

    const result = await getMyNudges()

    expect(apiClient.get).toHaveBeenCalledWith('/api/nudges')
    expect(result).toEqual(mockNudges)
  })

  it('getMyNudges fetches nudges with organization query parameter when specified', async () => {
    const mockNudges = [{ _id: 'nudge-2', nudgeType: 'UNRESOLVED_ACTION_ITEMS' }]
    apiClient.get.mockResolvedValueOnce({ data: mockNudges })

    const result = await getMyNudges('org-99')

    expect(apiClient.get).toHaveBeenCalledWith('/api/nudges?organization=org-99')
    expect(result).toEqual(mockNudges)
  })

  it('updateNudgeStatus sends a PATCH request to update nudge status', async () => {
    const mockResponse = { _id: 'nudge-1', status: 'ACTED_ON' }
    apiClient.patch.mockResolvedValueOnce({ data: mockResponse })

    const result = await updateNudgeStatus('nudge-1', 'ACTED_ON')

    expect(apiClient.patch).toHaveBeenCalledWith('/api/nudges/nudge-1/status', {
      status: 'ACTED_ON',
    })
    expect(result).toEqual(mockResponse)
  })

  it('getMeetingReadiness fetches meeting readiness metrics by meeting ID', async () => {
    const mockReadiness = { averageScore: 92, participants: [] }
    apiClient.get.mockResolvedValueOnce({ data: mockReadiness })

    const result = await getMeetingReadiness('meeting-77')

    expect(apiClient.get).toHaveBeenCalledWith('/api/nudges/meeting/meeting-77/readiness')
    expect(result).toEqual(mockReadiness)
  })

  it('uses apiClient for bearer authentication parity across all requests', async () => {
    apiClient.get.mockResolvedValue({ data: [] })
    apiClient.patch.mockResolvedValue({ data: {} })

    await getMyNudges('org-1')
    await updateNudgeStatus('n1', 'DISMISSED')
    await getMeetingReadiness('m1')

    expect(apiClient.get).toHaveBeenCalledTimes(2)
    expect(apiClient.patch).toHaveBeenCalledTimes(1)
  })
})

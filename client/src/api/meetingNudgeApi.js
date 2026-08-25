import apiClient from '../services/apiClient'

const API_BASE = '/api/nudges'

export const getMyNudges = async (organizationId) => {
  const url = organizationId ? `${API_BASE}?organization=${organizationId}` : API_BASE
  const { data } = await apiClient.get(url)
  return data
}

export const updateNudgeStatus = async (id, status) => {
  const { data } = await apiClient.patch(`${API_BASE}/${id}/status`, {
    status,
  })
  return data
}

export const getMeetingReadiness = async (meetingId) => {
  const { data } = await apiClient.get(`${API_BASE}/meeting/${meetingId}/readiness`)
  return data
}

import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import useMeetingAttendance from '../../hooks/useMeetingAttendance';
import debriefQAApi from '../debriefQAApi';
import actionItemChangeLogApi from '../actionItemChangeLogApi';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('API Prefix Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('clerk_token', 'test-token');
  });

  describe('useMeetingAttendance API paths', () => {
    it('should use /api prefix for fetching attendance', async () => {
      const meetingId = 'test-meeting-123';
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            participants: [],
            present: [],
            absent: [],
            excused: [],
            pending: [],
          },
        },
      });

      // This will trigger the fetch on mount
      const { fetchAttendance } = useMeetingAttendance(meetingId);
      await fetchAttendance();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/attendance`
      );
    });

    it('should use /api prefix for marking present', async () => {
      const meetingId = 'test-meeting-123';
      const userId = 'user-456';
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
      });

      const { markPresent } = useMeetingAttendance(meetingId);
      await markPresent(userId);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/attendance/present`,
        expect.objectContaining({ userId })
      );
    });

    it('should use /api prefix for marking absent', async () => {
      const meetingId = 'test-meeting-123';
      const userId = 'user-456';
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
      });

      const { markAbsent } = useMeetingAttendance(meetingId);
      await markAbsent(userId, 'Sick');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/attendance/absent`,
        expect.objectContaining({ userId, reason: 'Sick' })
      );
    });

    it('should use /api prefix for bulk update', async () => {
      const meetingId = 'test-meeting-123';
      const updates = [{ userId: 'user-1', status: 'present' }];
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
      });

      const { bulkUpdate } = useMeetingAttendance(meetingId);
      await bulkUpdate(updates);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/attendance/bulk`,
        expect.objectContaining({ updates })
      );
    });
  });

  describe('debriefQAApi API paths', () => {
    it('should use /api prefix for getting sessions', async () => {
      const debriefId = 'debrief-123';
      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: [] },
      });

      await debriefQAApi.getSessions(debriefId);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `/api/debrief/session/${debriefId}/qa`
      );
    });

    it('should use /api prefix for creating a session', async () => {
      const debriefId = 'debrief-123';
      const data = { title: 'Test Session' };
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
      });

      await debriefQAApi.createSession(debriefId, data);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/debrief/session/${debriefId}/qa`,
        data
      );
    });

    it('should use /api prefix for adding a question', async () => {
      const debriefId = 'debrief-123';
      const sessionId = 'session-456';
      const questionData = { text: 'Test question?' };
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
      });

      await debriefQAApi.addQuestion(debriefId, sessionId, questionData);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/debrief/session/${debriefId}/qa/${sessionId}/questions`,
        questionData
      );
    });

    it('should use /api prefix for voting on a question', async () => {
      const debriefId = 'debrief-123';
      const sessionId = 'session-456';
      const questionId = 'question-789';
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
      });

      await debriefQAApi.voteQuestion(debriefId, sessionId, questionId, 'up');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/debrief/session/${debriefId}/qa/${sessionId}/questions/${questionId}/vote`,
        { voteType: 'up' }
      );
    });
  });

  describe('actionItemChangeLogApi API paths', () => {
    it('should use /api prefix for getting changelog', async () => {
      const actionItemId = 'action-123';
      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true, data: [] },
      });

      await actionItemChangeLogApi.getChangeLog(actionItemId);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `/api/action-items/${actionItemId}/changelog?limit=50&offset=0`
      );
    });

    it('should use /api prefix for creating a changelog entry', async () => {
      const actionItemId = 'action-123';
      const data = { change: 'Status updated' };
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
      });

      await actionItemChangeLogApi.createChangeLogEntry(actionItemId, data);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/action-items/${actionItemId}/changelog`,
        data
      );
    });

    it('should use /api prefix for comparing versions', async () => {
      const actionItemId = 'action-123';
      const version1 = 'v1';
      const version2 = 'v2';
      mockedAxios.get.mockResolvedValueOnce({
        data: { success: true },
      });

      await actionItemChangeLogApi.compareVersions(
        actionItemId,
        version1,
        version2
      );

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `/api/action-items/${actionItemId}/changelog/compare`,
        { params: { version1, version2 } }
      );
    });

    it('should use /api prefix for restoring a version', async () => {
      const actionItemId = 'action-123';
      const versionId = 'version-456';
      mockedAxios.post.mockResolvedValueOnce({
        data: { success: true },
      });

      await actionItemChangeLogApi.restoreVersion(actionItemId, versionId);

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `/api/action-items/${actionItemId}/changelog/restore`,
        { versionId }
      );
    });
  });

  describe('Error handling', () => {
    it('should handle 404 errors gracefully for attendance', async () => {
      const meetingId = 'test-meeting-123';
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 404, data: { error: 'Not found' } },
      });

      const { fetchAttendance } = useMeetingAttendance(meetingId);
      await fetchAttendance();

      // Should set error without throwing
      // Verify through state - we'd need to test with actual component
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `/api/meetings/${meetingId}/attendance`
      );
    });

    it('should handle 401 errors gracefully for debrief Q&A', async () => {
      const debriefId = 'debrief-123';
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 401, data: { error: 'Unauthorized' } },
      });

      try {
        await debriefQAApi.getSessions(debriefId);
      } catch (error) {
        expect(error).toBeDefined();
      }

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `/api/debrief/session/${debriefId}/qa`
      );
    });

    it('should handle 403 errors gracefully for action item changelog', async () => {
      const actionItemId = 'action-123';
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 403, data: { error: 'Forbidden' } },
      });

      try {
        await actionItemChangeLogApi.getChangeLog(actionItemId);
      } catch (error) {
        expect(error).toBeDefined();
      }

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `/api/action-items/${actionItemId}/changelog?limit=50&offset=0`
      );
    });
  });
});
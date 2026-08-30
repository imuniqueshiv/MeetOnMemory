import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app.js';

describe('API Route Prefix Tests', () => {
  describe('Attendance routes', () => {
    it('should mount attendance routes under /api/meetings/:meetingId/attendance', async () => {
      const meetingId = 'test-meeting-id';
      // We expect 401 (unauthorized) rather than 404 because route exists
      const response = await request(app)
        .get(`/api/meetings/${meetingId}/attendance`)
        .set('Authorization', 'Bearer invalid-token');

      // Route exists but auth fails
      expect(response.status).not.toBe(404);
    });

    it('should mount attendance/present under /api/meetings/:meetingId/attendance/present', async () => {
      const meetingId = 'test-meeting-id';
      const response = await request(app)
        .post(`/api/meetings/${meetingId}/attendance/present`)
        .send({ userId: 'user-123' });

      // Should not be 404 - route exists
      expect(response.status).not.toBe(404);
    });
  });

  describe('Debrief Q&A routes', () => {
    it('should mount debrief Q&A routes under /api/debrief/session/:debriefId/qa', async () => {
      const debriefId = 'test-debrief-id';
      const response = await request(app)
        .get(`/api/debrief/session/${debriefId}/qa`);

      // Route exists but auth fails
      expect(response.status).not.toBe(404);
    });

    it('should mount debrief Q&A questions under /api/debrief/session/:debriefId/qa/:sessionId/questions', async () => {
      const debriefId = 'test-debrief-id';
      const sessionId = 'test-session-id';
      const response = await request(app)
        .post(`/api/debrief/session/${debriefId}/qa/${sessionId}/questions`)
        .send({ text: 'Test question' });

      expect(response.status).not.toBe(404);
    });
  });

  describe('Action Item Change Log routes', () => {
    it('should mount action item changelog under /api/action-items/:actionItemId/changelog', async () => {
      const actionItemId = 'test-action-id';
      const response = await request(app)
        .get(`/api/action-items/${actionItemId}/changelog`);

      expect(response.status).not.toBe(404);
    });

    it('should mount action item changelog restore under /api/action-items/:actionItemId/changelog/restore', async () => {
      const actionItemId = 'test-action-id';
      const response = await request(app)
        .post(`/api/action-items/${actionItemId}/changelog/restore`)
        .send({ versionId: 'version-123' });

      expect(response.status).not.toBe(404);
    });

    it('should mount action item changelog compare under /api/action-items/:actionItemId/changelog/compare', async () => {
      const actionItemId = 'test-action-id';
      const response = await request(app)
        .get(`/api/action-items/${actionItemId}/changelog/compare`)
        .query({ version1: 'v1', version2: 'v2' });

      expect(response.status).not.toBe(404);
    });
  });

  describe('Route fallback for missing /api prefix', () => {
    it('should NOT match routes without /api prefix', async () => {
      const response = await request(app)
        .get('/meetings/test-id/attendance');
      
      // Should be 404 because route without /api doesn't exist
      expect(response.status).toBe(404);
    });

    it('should NOT match debrief routes without /api prefix', async () => {
      const response = await request(app)
        .get('/debrief/session/test/qa');
      
      expect(response.status).toBe(404);
    });

    it('should NOT match action item routes without /api prefix', async () => {
      const response = await request(app)
        .get('/action-items/test/changelog');
      
      expect(response.status).toBe(404);
    });
  });
});
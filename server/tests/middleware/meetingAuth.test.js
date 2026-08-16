const meetingAuth = require('../../middleware/meetingAuth');
const Meeting = require('../../models/Meeting');

// Mock the Meeting model
jest.mock('../../models/Meeting');

describe('meetingAuth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: { meetingId: 'meeting123' },
      user: {
        _id: 'user123',
        role: 'user',
        organization: 'orgABC'
      }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should grant access for same-organization users', async () => {
    Meeting.findById.mockResolvedValue({
      _id: 'meeting123',
      organization: 'orgABC'
    });

    await meetingAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should deny access for cross-organization users', async () => {
    Meeting.findById.mockResolvedValue({
      _id: 'meeting123',
      organization: 'orgXYZ' // Different organization
    });

    await meetingAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied. Cross-organization access is prohibited.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should fail closed if user organization is missing', async () => {
    req.user.organization = null;
    Meeting.findById.mockResolvedValue({
      _id: 'meeting123',
      organization: 'orgABC'
    });

    await meetingAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied. Missing organization information.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should fail closed if meeting organization is missing', async () => {
    Meeting.findById.mockResolvedValue({
      _id: 'meeting123',
      organization: null
    });

    await meetingAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied. Missing organization information.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should grant access to admins regardless of organization', async () => {
    req.user.role = 'admin';
    req.user.organization = 'orgXYZ';
    Meeting.findById.mockResolvedValue({
      _id: 'meeting123',
      organization: 'orgABC'
    });

    await meetingAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

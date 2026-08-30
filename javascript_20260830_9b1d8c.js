import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttendanceTracker from '../AttendanceTracker';
import { useMeetingAttendance } from '../../hooks/useMeetingAttendance';

vi.mock('../../hooks/useMeetingAttendance');

describe('AttendanceTracker Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch attendance on mount with /api prefix', async () => {
    const mockFetch = vi.fn();
    useMeetingAttendance.mockReturnValue({
      attendance: {
        participants: [{ _id: '1', name: 'John' }],
        present: [],
        absent: [],
        excused: [],
        pending: [{ _id: '1', name: 'John' }],
      },
      stats: { total: 1, present: 0, attendanceRate: 0 },
      loading: false,
      error: null,
      fetchAttendance: mockFetch,
      markPresent: vi.fn(),
      markAbsent: vi.fn(),
      markExcused: vi.fn(),
    });

    render(<AttendanceTracker meetingId="meeting-123" />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('should display attendance stats correctly', () => {
    useMeetingAttendance.mockReturnValue({
      attendance: {
        participants: [{ _id: '1', name: 'John' }],
        present: [{ _id: '1', name: 'John' }],
        absent: [],
        excused: [],
        pending: [],
      },
      stats: { total: 1, present: 1, attendanceRate: 100 },
      loading: false,
      error: null,
      fetchAttendance: vi.fn(),
      markPresent: vi.fn(),
      markAbsent: vi.fn(),
      markExcused: vi.fn(),
    });

    render(<AttendanceTracker meetingId="meeting-123" />);

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('1 present')).toBeInTheDocument();
  });

  it('should handle 404 error state', () => {
    useMeetingAttendance.mockReturnValue({
      attendance: {
        participants: [],
        present: [],
        absent: [],
        excused: [],
        pending: [],
      },
      stats: { total: 0, present: 0, attendanceRate: 0 },
      loading: false,
      error: 'No attendance records found for this meeting',
      fetchAttendance: vi.fn(),
      markPresent: vi.fn(),
      markAbsent: vi.fn(),
      markExcused: vi.fn(),
    });

    render(<AttendanceTracker meetingId="meeting-123" />);

    expect(screen.getByText(/no attendance records/i)).toBeInTheDocument();
  });
});
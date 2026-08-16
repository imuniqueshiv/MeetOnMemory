import React, { useState } from 'react';
import { AccessibleDialog } from './shared/AccessibleDialog';

export const InviteMemberForm = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpen = () => setIsModalOpen(true);
  const handleClose = () => setIsModalOpen(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Your existing invite logic goes here...
    
    // Close modal on success
    handleClose();
  };

  return (
    <>
      {/* Trigger Button */}
      <button onClick={handleOpen} className="btn-primary">
        Invite Team Member
      </button>

      {/* Accessible Modal Wrapper */}
      <AccessibleDialog
        isOpen={isModalOpen}
        onClose={handleClose}
        title="Invite a new team member"
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              placeholder="colleague@example.com"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="role">Role</label>
            <select id="role" name="role">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="form-actions">
            <button type="button" onClick={handleClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Send Invite
            </button>
          </div>
        </form>
      </AccessibleDialog>
    </>
  );
};

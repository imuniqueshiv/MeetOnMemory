import React, { useContext } from 'react'
// --- FIX: Changed to absolute path from /src and added .jsx extension ---
import { AppContent } from '/src/context/AppContext.jsx'

// This is your new "front page" after logging in.
// We'll build this out to show the list of meetings.

const MeetingListPage = () => {
  const { user } = useContext(AppContent);

  return (
    <div className='min-h-screen bg-gray-100 p-8'>
      {/* You'll need to add your Header/Navbar component here */}
      <h1 className='text-3xl font-bold text-gray-800 mb-4'>
        Welcome, {user ? user.name : 'User'}!
      </h1>
      <h2 className='text-xl text-gray-600 mb-6'>Your Meetings</h2>

      <div className='bg-white p-6 rounded-lg shadow-md'>
        <button className='bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700'>
          + Create New Meeting
        </button>

        {/* This is where your list of meetings will go */}
        <div className='mt-6'>
          <p className='text-gray-500'>You have no meetings scheduled.</p>
          {/* We will replace this with a list later */}
        </div>
      </div>
    </div>
  )
}

export default MeetingListPage


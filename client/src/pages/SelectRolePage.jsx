// client/src/pages/SelectRolePage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

const SelectRolePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <Navbar />
      <div className="grow flex flex-col items-center justify-center">
        <div className="bg-white p-10 rounded-lg shadow-xl text-center w-[90%] max-w-lg">
          <h1 className="text-3xl font-bold mb-6">How are you joining?</h1>
          <p className="text-gray-600 mb-8">Select a role to get started.</p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              onClick={() => navigate('/create-organization')}
              className="w-64 sm:w-48 p-6 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-all text-xl font-semibold"
            >
              Join as Admin
            </button>

            <button
              onClick={() => navigate('/join-organization')}
              className="w-64 sm:w-48 p-6 bg-gray-700 text-white rounded-lg shadow-lg hover:bg-gray-800 transition-all text-xl font-semibold"
            >
              Join as Member
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectRolePage;

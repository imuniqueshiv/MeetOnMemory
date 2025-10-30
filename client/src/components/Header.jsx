import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { assets } from '../assets/assets';
import { AppContent } from '../context/AppContext.jsx';

const Header = () => {
  const { userData } = useContext(AppContent);
  const navigate = useNavigate();

  // Handle navigation logic for Get Started button
  const handleGetStarted = () => {
    if (userData && userData.name) {
      // ✅ Logged in user → Dashboard
      navigate('/dashboard');
    } else {
      // 🚀 Not logged in → Login page
      navigate('/login');
    }
  };

  return (
    <div className='flex flex-col items-center mt-20 px-4 text-center text-gray-800'>
      {/* ✅ Bot image from assets */}
      <img
        src={assets.header_img}
        alt="AI Bot"
        className='w-36 h-36 rounded-full mb-6 shadow-md bg-white'
      />

      {/* ✅ Greeting with hand wave */}
      <h1 className='flex items-center justify-center gap-2 text-xl sm:text-3xl font-medium mb-2'>
        Hey {userData ? userData.name : 'Developer'}!
        <img
          className='w-8 h-8'
          src={assets.hand_wave}
          alt="wave"
        />
      </h1>

      {/* ✅ Title & subtitle */}
      <h2 className='text-3xl sm:text-5xl font-semibold mb-4'>
        Welcome to <span className="text-blue-700">MeetOnMemory!</span>
      </h2>

      <p className='mb-8 max-w-md text-gray-600'>
        AI that remembers every meeting!
      </p>

      {/* ✅ Smart Get Started button */}
      <button
        onClick={handleGetStarted}
        className='border border-gray-500 rounded-full px-8 py-2.5 hover:bg-gray-900 hover:text-white transition-all'
      >
        Get Started
      </button>
    </div>
  );
};

export default Header;

import React, { use, useContext, useEffect } from 'react';
import { assets } from '../assets/assets';
import axios from 'axios';
import { AppContent } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const EmailVerify = () => {
  axios.defaults.withCredentials = true;
  const { backendUrl, getUserData, isLoggedin, userData } = useContext(AppContent);
  const navigate = useNavigate();
  const inputRefs = React.useRef([]);

  const handleInput = (e, index) => {
    if (e.target.value.length > 0 && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && e.target.value === '' && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text');
    const pasteArray = paste.split('');
    pasteArray.forEach((char, index) => {
      if (inputRefs.current[index]) {
        inputRefs.current[index].value = char;
      }
    });
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();
    const otpArray = inputRefs.current.map((el) => el.value);
    const otp = otpArray.join('');

    try {
      const { data } = await axios.post(
        `${backendUrl}/api/auth/verify-account`,
        { otp }, // ✅ Send object, not raw string
        { withCredentials: true }
      );

      if (data.success) {
        toast.success(data.message || 'Email verified successfully!');
        getUserData();
        navigate('/');
      } else {
        toast.error(data.message || 'Verification failed');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Something went wrong');
    }
  };
   
  useEffect(()=>{
    isLoggedin && userData && userData.isAccountVerified && navigate('/')
  }, [isLoggedin, userData]);


    return (
    <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-blue-200 to-purple-400">
      <img
        onClick={() => navigate('/')}
        src={assets.logo}
        alt=""
        className="absolute left-5 sm:left-20 top-5 w-28 sm:w-32 cursor-pointer"
      />

      <form
        onSubmit={onSubmitHandler}
        className="bg-slate-900 p-8 rounded-lg shadow-lg w-96 text-sm"
      >
        <h1 className="text-white text-2xl font-semibold text-center mb-4">
          Email Verify OTP
        </h1>
        <p className="text-center mb-6 text-indigo-400">
          Enter the 6-digit code sent to your email.
        </p>

        <div className="flex justify-between mb-8" onPaste={handlePaste}>
          {Array(6)
            .fill(0)
            .map((_, index) => (
              <input
                type="text"
                maxLength="1"
                key={index}
                required
                className="w-12 h-12 bg-[#333A5C] text-white text-center text-xl rounded-md"
                ref={(el) => (inputRefs.current[index] = el)}
                onInput={(e) => handleInput(e, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              />
            ))}
        </div>
        <button className="w-full py-3 bg-linear-to-r from-indigo-500 to-indigo-900 text-white rounded-full hover:opacity-90 transition-all">
          Verify Email
        </button>
      </form>
    </div>
  );
};

export default EmailVerify;

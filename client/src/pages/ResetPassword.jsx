import React, { useContext, useState } from 'react'
// Changed to aliased path - assumes '@' is set to '/src'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
// Changed to aliased path - assumes '@' is set to '/src'
import { AppContent } from '../context/AppContext' 
import axios from 'axios'
import { toast } from 'react-toastify'

const ResetPassword = () => {

    const { backendUrl } = useContext(AppContent)
    axios.defaults.withCredentials = true

    const navigate = useNavigate();
    const [email, setEmail] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [isEmailSent, setIsEmailSent] = useState(false) // Correct
    const [otp, setOtp] = useState('') // Changed to string
    const [isOtpSubmited, setIsOtpSubmited] = useState(false)

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

    // FIX 1: Added '(e)' parameter
    const onSubmitEmail = async (e) => {
        e.preventDefault();

        try {
            const { data } = await axios.post(backendUrl + '/api/auth/send-reset-otp', { email })
            data.success ? toast.success(data.message) : toast.error(data.message)
            data.success && setIsEmailSent(true)

        }
        catch (error) {
            toast.error(error.response?.data?.message || "Failed to send email");
        }
    }


    // FIX 2: Correctly get and set the OTP
    const onSubmitOTP = async (e) => {
        e.preventDefault();
        const otpString = inputRefs.current.map(el => el.value).join('');

        if (otpString.length < 6) {
            toast.error("Please enter the 6-digit OTP.");
            return;
        }
        
        setOtp(otpString); // Save the OTP
        setIsOtpSubmited(true); // Show the next form
    }

    // FIX 3: Added 'await' and fixed structure
    const onSubmitNewPassword = async (e) => {
        e.preventDefault();
        try {
            // Added 'await'
            const { data } = await axios.post(backendUrl + '/api/auth/reset-password', { email, otp, newPassword })
            
            if (data.success) {
                toast.success(data.message);
                navigate('/login'); // Navigate on success
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to reset password");
        }
    } // <-- FIX 4: Function was not closed

    // FIX 5: The 'return' statement was inside the function above
    return (
        <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-blue-200 to-purple-400">
            <img
                onClick={() => navigate('/')}
                src={assets.logo}
                alt=""
                className="absolute left-5 sm:left-20 top-5 w-28 sm:w-32 cursor-pointer" />
            {/* Enter email id  */}

            {!isEmailSent && <form onSubmit={onSubmitEmail} className='bg-slate-900 p-8 rounded-lg shadow-lg w-96 text-sm"'>
                <h1 className="text-white text-2xl font-semibold text-center mb-4">
                    Reset Password
                </h1>
                <p className="text-center mb-6 text-indigo-400">
                    Enter your registered email address
                </p>
                <div className='mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#333A5C]'>
                    <img src={assets.mail_icon} alt="" className='w-3 h-3' />
                    <input type="email" placeholder='Email id' className='bg-transparent outline-none  text-white'
                        value={email} onChange={e => setEmail(e.target.value)
                        } required />
                </div>
                <button type="submit" className='w-full py-2.5 bg-linear-to-r from-indigo-500 to-indigo-900 text-white rounded-full mt-3'>
                    Submit
                </button>
            </form>}

            {/* OTP input form */}

            {!isOtpSubmited && isEmailSent &&

                <form
                    onSubmit={onSubmitOTP}
                    className="bg-slate-900 p-8 rounded-lg shadow-lg w-96 text-sm"
                >
                    <h1 className="text-white text-2xl font-semibold text-center mb-4">
                        Reset Password OTP
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
                    <button type="submit" className="w-full py-2.5 bg-linear-to-r from-indigo-500 to-indigo-900 text-white rounded-full hover:opacity-90 transition-all">
                        Submit
                    </button>
                </form>}

            {/* Enter New password */}
            {isOtpSubmited && isEmailSent && <form onSubmit={onSubmitNewPassword} className='bg-slate-900 p-8 rounded-lg shadow-lg w-96 text-sm"'>
                <h1 className="text-white text-2xl font-semibold text-center mb-4">
                    New Password
                </h1>
                <p className="text-center mb-6 text-indigo-400">
                    Enter the new password below
                </p>
                <div className='mb-4 flex items-center gap-3 w-full px-5 py-2.5 rounded-full bg-[#333A5C]'>
                    <img src={assets.lock_icon} alt="" className='w-3 h-3' />
                    <input type="password" placeholder='New Password' className='bg-transparent outline-none  text-white'
                        value={newPassword} onChange={e => setNewPassword(e.target.value)
                        } required />
                </div>
                <button type="submit" className='w-full py-2.5 bg-linear-to-r from-indigo-500 to-indigo-900 text-white rounded-full mt-3'>
                    Submit
                </button>
            </form>}

        </div>
    )
} // <-- FIX 6: Component function was not closed

// FIX 7: Export was inside the function
export default ResetPassword


import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar'; // Assuming you want your navbar here

const SelectRolePage = () => {
    const navigate = useNavigate();

    return (
        <div className='flex flex-col items-center justify-center min-h-screen bg-gray-100'>
            {/* You might want a simpler header here, but Navbar is fine */}
            <Navbar /> 
            <div className='grow flex flex-col items-center justify-center'>
                <div className='bg-white p-10 rounded-lg shadow-xl text-center'>
                    <h1 className='text-3xl font-bold mb-6'>How are you joining?</h1>
                    <p className='text-gray-600 mb-8'>Select a role to get started.</p>
                    <div className='flex flex-col sm:flex-row gap-6'>
                        <button
                            onClick={() => navigate('/create-organization')}
                            className='w-64 sm:w-48 p-6 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-all text-xl font-semibold'
                        >
                            Join as admin
                        </button>
                        <button
                            onClick={() => navigate('/join-organization')}
                            className='w-64 sm:w-48 p-6 bg-gray-700 text-white rounded-lg shadow-lg hover:bg-gray-800 transition-all text-xl font-semibold'
                        >
                            Join as member
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SelectRolePage;
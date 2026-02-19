import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const GetUsername = () => {
    const [userName, setUserName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { meetingCode } = useParams();
    const navigate = useNavigate();

    // Check if there's an existing username in localStorage
    useEffect(() => {
        const savedUserName = localStorage.getItem("userName");
        if (savedUserName) {
            setUserName(savedUserName);
        }
    }, []);

    const handleJoinMeeting = () => {
        if (!userName.trim()) {
            alert("Please enter your name to join the meeting.");
            return;
        }

        setIsLoading(true);

        // Store username in localStorage
        localStorage.setItem("userName", userName);
        
        // If we have a meeting code from URL params, also store it
        if (meetingCode) {
            localStorage.setItem("meetingCode", meetingCode);
        }

        // Redirect after a short delay to show loading state
        setTimeout(() => {
            if (meetingCode) {
                // If we have a meeting code, go to that meeting
                navigate(`/meeting/${meetingCode}`);
            } else {
                // Otherwise go to the meeting creation page
                navigate("/");
            }
        }, 800);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleJoinMeeting();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-700 to-slate-900">
            <div className="bg-slate-50 shadow-xl rounded-xl p-8 w-full max-w-md mx-4">
                <div className="flex items-center justify-center mb-8">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-700" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                    <h1 className="text-3xl font-bold text-slate-800 ml-3">
                        PeerLink
                    </h1>
                </div>
                
                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                        {meetingCode ? "Join Meeting" : "Welcome to PeerLink"}
                    </h2>
                    <p className="text-slate-500">
                        {meetingCode 
                            ? "Please enter your name to join the meeting" 
                            : "Please enter your name to continue"
                        }
                    </p>
                </div>
                
                {/* User Name Input */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="userName">
                        Your Name
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            id="userName"
                            type="text"
                            placeholder="Enter your name"
                            className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-lg"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    </div>
                </div>
                
                {/* Continue Button */}
                <button
                    onClick={handleJoinMeeting}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center bg-slate-700 text-white py-3 px-4 rounded-lg hover:bg-slate-800 transition duration-300 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {isLoading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {meetingCode ? "Joining..." : "Continuing..."}
                        </>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            {meetingCode ? "Join Meeting" : "Continue"}
                        </>
                    )}
                </button>
                
                {/* Meeting Code Info */}
                {meetingCode && (
                    <div className="mt-6 p-4 bg-slate-100 rounded-lg text-center">
                        <div className="text-sm text-slate-500 mb-1">You are joining meeting:</div>
                        <div className="font-medium text-slate-800 break-all">{meetingCode}</div>
                    </div>
                )}
                
                {/* Help Text */}
                <div className="mt-6 text-sm text-slate-500 text-center">
                    {meetingCode 
                        ? "Your name will be visible to other participants"
                        : "You can create or join a meeting after entering your name"
                    }
                </div>
            </div>
            
            {/* Footer */}
            <div className="mt-6 text-center text-slate-300 text-sm">
                <p>© {new Date().getFullYear()} PeerLink. All rights reserved.</p>
            </div>
        </div>
    );
};

export default GetUsername;
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// Initialize socket connection outside the component to ensure only one connection
import socket from "../socket";

const MeetingCreate = ({ setJoined }) => {
    const [meetingName, setMeetingName] = useState(""); // State to store meeting name
    const [meetingCode, setMeetingCode] = useState("");
    const [existingMeetingCode, setExistingMeetingCode] = useState("");
    const [userName, setUserName] = useState(""); // User's name state
    const [activeTab, setActiveTab] = useState("create"); // Track active tab
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();

    // Generate a random meeting code
    const generateMeetingCode = () => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        let code = "";
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    // Handle creating a new meeting
    const handleCreateMeeting = () => {
        if (!meetingName || !userName) {
            alert("Please enter both meeting name and your name.");
            return;
        }
        
        setIsLoading(true);
        const generatedCode = generateMeetingCode();
        setMeetingCode(generatedCode);
        localStorage.setItem("userName", userName);
        localStorage.setItem("meetingCode", generatedCode);
        localStorage.setItem("meetingName", meetingName);
        
        // Emit user info to the server to create a new meeting
        setJoined(true);
        console.log(userName);
        // Emit user info to the server to join the meeting
        socket.emit("join", { userName, meetingCode: generatedCode });

        // Short delay to show loading state
        setTimeout(() => {
            // Redirect to the meeting page using the generated meeting code
            navigate(`/meeting/${generatedCode}`);
        }, 800);
    };

    // Handle joining an existing meeting
    const handleJoinMeeting = () => {
        if (!existingMeetingCode || !userName) {
            alert("Please enter a valid meeting code and your name.");
            return;
        }

        setIsLoading(true);
        localStorage.setItem("userName", userName);
        localStorage.setItem("meetingCode", existingMeetingCode);

        // Ensure socket is connected before emitting the event
        if (socket && socket.connected) {
            console.log("Emitting join event");
            setJoined(true);
            socket.emit("join", { userName, meetingCode: existingMeetingCode });
        } else {
            console.error("Socket not connected");
            setIsLoading(false);
            return;
        }
        
        // Short delay to show loading state
        setTimeout(() => {
            navigate(`/meeting/${existingMeetingCode}`);
        }, 800);
    };

    // Set up socket listeners on component mount
    useEffect(() => {
        // Ensure the socket connects only once
        // socket.connect();
        console.log("connected")
        
        // Clean up socket on component unmount
    }, []); // Empty dependency array ensures this effect runs only once

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
                
                {/* User Name Section */}
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
                            className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                        />
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex mb-6 border-b border-slate-200">
                    <button
                        className={`flex-1 py-3 px-4 text-sm font-medium ${
                            activeTab === "create" 
                            ? "text-slate-700 border-b-2 border-slate-600" 
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                        onClick={() => setActiveTab("create")}
                    >
                        Create Meeting
                    </button>
                    <button
                        className={`flex-1 py-3 px-4 text-sm font-medium ${
                            activeTab === "join" 
                            ? "text-slate-700 border-b-2 border-slate-600" 
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                        onClick={() => setActiveTab("join")}
                    >
                        Join Meeting
                    </button>
                </div>

                {/* Create Meeting Section */}
                {activeTab === "create" && (
                    <div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="meetingName">
                                Meeting Name
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <input
                                    id="meetingName"
                                    type="text"
                                    placeholder="Enter meeting name"
                                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                                    value={meetingName}
                                    onChange={(e) => setMeetingName(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <button
                            onClick={handleCreateMeeting}
                            disabled={isLoading}
                            className={`w-full flex items-center justify-center bg-slate-700 text-white py-3 px-4 rounded-lg hover:bg-slate-800 transition duration-300 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                                    </svg>
                                    Create Meeting
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Join Meeting Section */}
                {activeTab === "join" && (
                    <div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="meetingCode">
                                Meeting Code
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <input
                                    id="meetingCode"
                                    type="text"
                                    placeholder="Enter meeting code"
                                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent"
                                    value={existingMeetingCode}
                                    onChange={(e) => setExistingMeetingCode(e.target.value)}
                                />
                            </div>
                        </div>
                        
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
                                    Joining...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
                                    </svg>
                                    Join Meeting
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Help Text */}
                <div className="mt-6 text-sm text-slate-500 text-center">
                    {activeTab === "create" ? (
                        <p>Create a new meeting and share the code with participants</p>
                    ) : (
                        <p>Enter a meeting code you received from someone</p>
                    )}
                </div>
            </div>
            
            {/* Footer */}
            <div className="mt-6 text-center text-slate-300 text-sm">
                <p>© {new Date().getFullYear()} PeerLink. All rights reserved.</p>
            </div>
        </div>
    );
};

export default MeetingCreate;

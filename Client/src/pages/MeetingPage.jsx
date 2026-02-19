import React, { useState, useEffect, useCallback, useRef } from "react";
import CodeEditor from "../components/CodeEditor";
import VideoCall from "../components/VideoCall";
import ChatBox from "../components/ChatBox";
import UserList from "../components/UserList";
import { useParams } from "react-router-dom";
import socket from "../socket"
import { useNavigate } from "react-router-dom";

const MeetingPage = () => {
    const { meetingCode } = useParams();
    const [joined, setJoined] = useState(false);
    const [users, setUsers] = useState([]);
    const [host, setHost] = useState("");
    const [consoleOutput, setConsoleOutput] = useState("");
    const [notification, setNotification] = useState(null);
    const [showShareLink, setShowShareLink] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const userName = localStorage.getItem("userName");
    
    const mountedRef = useRef(false);
    const usersRef = useRef([]);
    const previousUsersRef = useRef([]);
    const shareLinkRef = useRef(null);
    const reconnectAttemptRef = useRef(null);
    const navigate = useNavigate();
    console.log("MeetingPage rendering, users:", users);

    const handleUserUpdate = useCallback((updatedUsers) => {
        console.log("MeetingPage received user update:", updatedUsers);
        // Only update if the users list has actually changed
        if (JSON.stringify(usersRef.current) !== JSON.stringify(updatedUsers)) {
            // Save previous users for comparison
            previousUsersRef.current = [...usersRef.current];
            usersRef.current = updatedUsers;
            setUsers(updatedUsers);

            // Check for new users
            if (previousUsersRef.current.length > 0) {
                const newUsers = updatedUsers.filter(
                    user => !previousUsersRef.current.some(prevUser => prevUser.id === user.id)
                );

                if (newUsers.length > 0) {
                    // Show notification for each new user
                    newUsers.forEach(user => {
                        setNotification({
                            message: `${user.name} joined the meeting`,
                            type: 'info',
                            timestamp: Date.now()
                        });

                        // Auto-dismiss notification after 1 second
                        setTimeout(() => {
                            setNotification(null);
                        }, 1000);
                    });
                }
            }
        }
    }, []);

    const handleHostUpdate = useCallback((hostName) => {
        setHost(hostName);
        // Also store host name in localStorage for the UserList component
        localStorage.setItem("hostName", hostName);
    }, []);

    const copyShareLink = () => {
        const shareableLink = `${window.location.origin}/meeting/${meetingCode}`;
        navigator.clipboard.writeText(shareableLink)
            .then(() => {
                // Show temporary "Copied!" message
                shareLinkRef.current.innerText = "Copied!";
                setTimeout(() => {
                    shareLinkRef.current.innerText = "Copy Link";
                }, 2000);
            })
            .catch(err => {
                console.error('Error copying link:', err);
                setNotification({
                    message: 'Failed to copy link',
                    type: 'error',
                    timestamp: Date.now()
                });
            });
    };

    // Network status monitoring
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setNotification({
                message: "You're back online! Reconnecting...",
                type: 'success',
                timestamp: Date.now()
            });
            
            // Auto-dismiss notification after 1 second
            setTimeout(() => {
                setNotification(null);
            }, 1000);
            
            // Clear any pending reconnect attempts
            if (reconnectAttemptRef.current) {
                clearTimeout(reconnectAttemptRef.current);
            }
            
            // Attempt to reconnect to the socket
            if (!socket.connected) {
                try {
                    socket.connect();
                    
                    // Re-join the meeting
                    socket.emit("join", { 
                        userName, 
                        meetingCode, 
                        reconnecting: true
                    });
                    
                    // Get the host information
                    socket.emit("getHost", { meetingCode });
                    
                    console.log("Reconnected to socket server");
                    
                    // Force a full page reload after short delay to ensure all components are refreshed
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } catch (error) {
                    console.error("Reconnection failed:", error);
                    // Schedule another attempt
                    reconnectAttemptRef.current = setTimeout(() => {
                        if (!socket.connected && navigator.onLine) {
                            handleOnline();
                        }
                    }, 5000);
                }
            }
        };

        const handleOffline = () => {
            setIsOnline(false);
            setNotification({
                message: "You're offline. Please check your internet connection.",
                type: 'error',
                timestamp: Date.now()
            });
            
            // Auto-dismiss notification after 1 second
            setTimeout(() => {
                setNotification(null);
            }, 1000);
        };

        // Check initial connection status
        if (!navigator.onLine) {
            setIsOnline(false);
            setNotification({
                message: "You're offline. Please check your internet connection.",
                type: 'error',
                timestamp: Date.now()
            });
        }

        // Add event listeners
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Socket connection monitoring
        const checkSocketConnection = () => {
            if (!socket.connected && isOnline) {
                setNotification({
                    message: "Connection to server lost. Attempting to reconnect...",
                    type: 'error',
                    timestamp: Date.now()
                });
                
                // Auto-dismiss notification after 1 second
                setTimeout(() => {
                    setNotification(null);
                }, 1000);
                
                // Attempt to reconnect
                socket.connect();
                
                // Schedule another check
                reconnectAttemptRef.current = setTimeout(checkSocketConnection, 5000);
            }
        };

        // Check socket connection every 10 seconds
        const intervalId = setInterval(checkSocketConnection, 10000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(intervalId);
            if (reconnectAttemptRef.current) {
                clearTimeout(reconnectAttemptRef.current);
            }
        };
    }, [userName, meetingCode, notification]); // Remove isOnline from dependency array to prevent re-renders

    // Setup socket connections only once
    useEffect(() => {
        if(!userName) {
            navigate(`/${meetingCode}/Username`);
        }
        localStorage.setItem("meetingCode", meetingCode);
        console.log("Setting up socket connections in MeetingPage");
        localStorage.setItem("meetingCode", meetingCode);

        // Clear any existing listeners to prevent duplicates
        socket.off("hostName");
        socket.off("updateList");
        socket.off("joined");

        // Set up new listeners
        socket.on("hostName", handleHostUpdate);
        socket.on("updateList", handleUserUpdate);
        socket.on("joined", () => {
            console.log("Joined event received");
            if (!joined) setJoined(true);
        });

        // Join the meeting if not already joined
        if (!joined) {
            console.log("Emitting join event:", { userName, meetingCode });
            socket.emit("join", { userName, meetingCode });
        }

        // Get the host information
        socket.emit("getHost", { meetingCode });

            return () => {
            console.log("Cleaning up socket connections in MeetingPage");
            socket.off("hostName");
            socket.off("updateList");
            socket.off("joined");
        };
    }, [meetingCode, userName, joined, handleHostUpdate, handleUserUpdate]);

    const handleRunCode = useCallback(({ code, language, input }) => {
        console.log(`Running code in ${language} with input:`, input);
        // Set initial console output to a loading message
        setConsoleOutput(`Running ${language} code...\nPlease wait...\n\n`);

        // Make sure code is not empty
        if (!code || code.trim() === '') {
            setConsoleOutput('Error: No code to execute. Please enter some code first.');
            return;
        }

        // Send code to server for execution
        socket.emit('runCode', {
            code,
            language,
            input,
            meetingCode
        });
    }, [meetingCode]);

    useEffect(() => {
        const handleCodeOutput = ({ output, language, code }) => {
            console.log("Received code output for language:", language);

            if (!output) {
                setConsoleOutput('No output received from server. Please try again.');
                return;
            }

            // Set the output with proper formatting
            setConsoleOutput(output);

            // Scroll to the bottom of the output
            const outputElement = document.querySelector('.output-container');
            if (outputElement) {
                setTimeout(() => {
                    outputElement.scrollTop = outputElement.scrollHeight;
                }, 100);
            }
        };

        socket.on('codeOutput', handleCodeOutput);

        return () => {
            socket.off('codeOutput', handleCodeOutput);
        };
    }, []);

    return (
        <div className="flex flex-col min-h-screen">
            {/* Header Section */}
            <header className="bg-gradient-to-r from-slate-700 to-slate-900 text-white shadow-lg">
                <div className="container mx-auto py-4 px-6">
                    <div className="flex flex-col md:flex-row items-center justify-between">
                        <h1 className="text-2xl font-bold flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                            </svg>
                            PeerLink Meeting
                        </h1>

                        <div className="flex flex-wrap md:flex-nowrap items-center gap-4 mt-4 md:mt-0">
                            <div className="flex items-center bg-slate-600 bg-opacity-50 px-3 py-1.5 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">Code: <span className="font-bold">{meetingCode}</span></span>
                            </div>

                            <div className="flex items-center bg-slate-600 bg-opacity-50 px-3 py-1.5 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm font-medium">Host: <span className="font-bold">{host}</span></span>
                            </div>

                            <div className="flex items-center bg-slate-600 bg-opacity-50 px-3 py-1.5 rounded-lg">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                </svg>
                                <span className="text-sm font-medium">Participants: <span className="font-bold">{users.length}</span></span>
                            </div>

                            <button
                                onClick={() => setShowShareLink(!showShareLink)}
                                className="flex items-center bg-slate-600 hover:bg-slate-500 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                                </svg>
                                <span className="text-sm font-medium">Share Meeting</span>
                            </button>

                            {showShareLink && (
                                <div className="absolute top-20 right-4 md:right-8 bg-white text-slate-800 p-4 rounded-lg shadow-lg z-10">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-semibold">Share this meeting</h3>
                                        <button
                                            onClick={() => setShowShareLink(false)}
                                            className="text-slate-500 hover:text-slate-700"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="flex space-x-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={`${window.location.origin}/meeting/${meetingCode}`}
                                            className="flex-grow bg-slate-100 p-2 rounded text-sm"
                                            onClick={(e) => e.target.select()}
                                        />
                                        <button
                                            ref={shareLinkRef}
                                            onClick={copyShareLink}
                                            className="bg-slate-700 text-white px-3 py-1 rounded hover:bg-slate-600 text-sm"
                                        >
                                            Copy Link
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Offline Overlay - show when user is offline */}
            {!isOnline && (
                <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center">
                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a3 3 0 010-4.243m2.121-2.121L21 3m-7.5 1.5a9 9 0 00-9 9m3-3L3 13.5M13 21a9 9 0 01-9-9" />
                        </svg>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">You're Offline</h2>
                        <p className="text-gray-600 mb-4">
                            Your internet connection has been lost. Please check your network settings and try again.
                        </p>
                        <p className="text-gray-500 text-sm mb-4">
                            The application will automatically reconnect when your internet connection is restored.
                        </p>
                        <div className="animate-pulse text-blue-600 font-medium">
                            Waiting for connection...
                        </div>
                    </div>
                </div>
            )}

            {/* Notification */}
            {notification && (
                <div className={`fixed top-4 right-4 max-w-xs bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg z-50 animate-fade-in-out flex items-center`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
                    </svg>
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Main Section */}
            <div className="flex-grow p-4 pt-5 bg-slate-100 flex flex-col md:flex-row gap-4 overflow-hidden">
                {/* Left: Video Call and Chat Section */}
                <div className="w-full md:w-[35%] flex flex-col gap-4 h-full md:h-[calc(100vh-116px)]">
                    {/* Video Call */}
                    <div className="h-[35%] min-h-[250px] bg-slate-50 rounded-lg shadow-md overflow-hidden">
                        <VideoCall users={users} />
                    </div>

                    {/* User List */}
                    <div className="h-[30%] min-h-[200px]">
                        <UserList usersFromParent={users} meetingCode={meetingCode} />
                    </div>

                    {/* Chat Section */}
                    <div className="h-[35%] min-h-[250px]">
                        <ChatBox />
                    </div>
                </div>

                {/* Right: Code Editor and Console */}
                <div className="w-full md:w-[65%] h-[600px] md:h-[calc(100vh-116px)] overflow-hidden bg-slate-50 rounded-lg shadow-md">
                    <CodeEditor
                        meetingCode={meetingCode}
                        onRunCode={handleRunCode}
                        consoleOutput={consoleOutput}
                    />
                </div>
            </div>
        </div>
    );
};

export default MeetingPage;

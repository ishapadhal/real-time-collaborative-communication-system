import React, { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../socket';
import createPeerConnection, { destroyPeerConnection } from '../peerConfig';
import { IoIosCall } from "react-icons/io";
const VideoCall = ({ users }) => {
    const [myStream, setMyStream] = useState(null);
    const [peers, setPeers] = useState({});
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [error, setError] = useState('');
    const [isConnecting, setIsConnecting] = useState(true);
    const [myPeerId, setMyPeerId] = useState(null);

    const myVideo = useRef();
    const peersRef = useRef({});
    const myPeerRef = useRef(null);
    const userNamesRef = useRef({});
    const connectionAttemptsRef = useRef(0);
    const processedUsersRef = useRef([]);
    const maxConnectionAttempts = 3;

    const userName = localStorage.getItem('userName');
    const meetingCode = localStorage.getItem('meetingCode');

    console.log(`VideoCall rendering with ${users?.length || 0} users`, users);

    const initializePeerConnection = useCallback(async (stream) => {
        try {
            if (connectionAttemptsRef.current >= maxConnectionAttempts) {
                setError('Failed to connect after multiple attempts. Please refresh the page.');
                setIsConnecting(false);
                return;
            }

            connectionAttemptsRef.current++;
            console.log('Initializing peer connection, attempt:', connectionAttemptsRef.current);

            const peer = createPeerConnection();
            myPeerRef.current = peer;

            peer.on('open', (id) => {
                console.log('PeerJS connection established with ID:', id);
                setMyPeerId(id);
                setIsConnecting(false);
                setError('');
                socket.emit('join', {
                    userName,
                    meetingCode,
                    peerId: id
                });
            });

            peer.on('error', (err) => {
                console.error('Peer connection error:', err);
                if(err.type !== 'peer-unavailable')
                setError(`Connection error: ${err.type}. Attempting to reconnect...`);
                if (err.type === 'network' || err.type === 'disconnected' || err.type === 'server-error' || err.type === 'peer-unavailable') {
                    setTimeout(() => {
                        if (!peer.destroyed) {
                            console.log('Retrying peer connection...');
                            initializePeerConnection(stream);
                        }
                    }, 2000);
                }
            });

            peer.on('call', (call) => {
                console.log('Receiving call from peer:', call.peer);
                call.answer(stream);

                call.on('stream', (remoteStream) => {
                    console.log('Received stream from peer:', call.peer);
                    setPeers(prev => {
                        if (prev[call.peer]?.stream === remoteStream) return prev;
                        console.log('Adding new peer stream:', call.peer);
                        return {
                            ...prev,
                            [call.peer]: { stream: remoteStream }
                        };
                    });
                });

                call.on('error', (err) => {
                    console.error('Call error:', err);
                    if (peersRef.current[call.peer]) {
                        peersRef.current[call.peer].close();
                        delete peersRef.current[call.peer];
                        setPeers(prev => {
                            const newPeers = { ...prev };
                            delete newPeers[call.peer];
                            return newPeers;
                        });
                    }
                });

                call.on('close', () => {
                    console.log('Call closed by peer:', call.peer);
                    if (peersRef.current[call.peer]) {
                        delete peersRef.current[call.peer];
                        setPeers(prev => {
                            const newPeers = { ...prev };
                            delete newPeers[call.peer];
                            return newPeers;
                        });
                    }
                });
            });

        } catch (err) {
            console.error('Error initializing peer:', err);
            setError('Failed to initialize connection. Retrying...');
            setTimeout(() => {
                initializePeerConnection(stream);
            }, 2000);
        }
    }, [userName, meetingCode]);

    // Process user updates and create peer connections
    useEffect(() => {
        if (!myPeerRef.current || !myStream || !users || !users.length || !myPeerId) {
            console.log('Not ready to process users:', {
                hasPeer: !!myPeerRef.current,
                hasStream: !!myStream,
                usersCount: users?.length || 0,
                myPeerId
            });
            return;
        }

        console.log(`Processing ${users.length} users with my peer ID: ${myPeerId}`);

        // Store current user list for comparison
        const currentUserIds = users.map(user => user.peerId).filter(Boolean);

        // Check if the user list has changed
        if (JSON.stringify(processedUsersRef.current) === JSON.stringify(currentUserIds)) {
            console.log('User list has not changed, skipping update');
            return;
        }

        processedUsersRef.current = currentUserIds;

        // Update usernames
        users.forEach(user => {
            if (user.peerId && user.name) {
                userNamesRef.current[user.peerId] = user.name;
            }
        });

        // Call peers that I haven't called yet
        users.forEach(user => {
            if (user.peerId &&
                user.name &&
                user.peerId !== myPeerId &&
                !peersRef.current[user.peerId]) {

                console.log('Initiating call to peer:', user.peerId, user.name);
                const call = myPeerRef.current.call(user.peerId, myStream);
                peersRef.current[user.peerId] = call;

                call.on('stream', (remoteStream) => {
                    console.log('Received stream from:', user.peerId, user.name);
                    setPeers(prev => {
                        if (prev[user.peerId]?.stream === remoteStream) {
                            console.log('Stream already exists for:', user.peerId);
                            return prev;
                        }
                        console.log('Adding new stream for:', user.peerId);
                        return {
                            ...prev,
                            [user.peerId]: { stream: remoteStream }
                        };
                    });
                });

                call.on('close', () => {
                    console.log('Call closed with:', user.peerId);
                    delete peersRef.current[user.peerId];
                    setPeers(prev => {
                        const newPeers = { ...prev };
                        delete newPeers[user.peerId];
                        return newPeers;
                    });
                });

                call.on('error', (err) => {
                    console.error('Call error with:', user.peerId, err);
                    if (peersRef.current[user.peerId]) {
                        peersRef.current[user.peerId].close();
                        delete peersRef.current[user.peerId];
                        setPeers(prev => {
                            const newPeers = { ...prev };
                            delete newPeers[user.peerId];
                            return newPeers;
                        });
                    }
                });
            }
        });

        // Remove disconnected peers
        Object.keys(peersRef.current).forEach(peerId => {
            if (!users.some(user => user.peerId === peerId)) {
                if (peersRef.current[peerId]) {
                    console.log('Removing disconnected peer:', peerId);
                    peersRef.current[peerId].close();
                    delete peersRef.current[peerId];
                    setPeers(prev => {
                        const newPeers = { ...prev };
                        delete newPeers[peerId];
                        return newPeers;
                    });
                }
            }
        });

        console.log('Current peers after update:', Object.keys(peersRef.current));
    }, [myStream, users, myPeerId]);

    // Initialize media stream and peer connection
    useEffect(() => {
        const initCall = async () => {
            try {
                console.log('Requesting media permissions...');
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                console.log('Media permissions granted');
                setMyStream(stream);
                if (myVideo.current) {
                    myVideo.current.srcObject = stream;
                }

                await initializePeerConnection(stream);

                socket.on('userLeft', ({ peerId }) => {
                    console.log('User left:', peerId);
                    if (peersRef.current[peerId]) {
                        peersRef.current[peerId].close();
                        delete peersRef.current[peerId];
                        setPeers(prev => {
                            const newPeers = { ...prev };
                            delete newPeers[peerId];
                            return newPeers;
                        });
                    }
                });

            } catch (err) {
                console.error('Error:', err);
                setError('Failed to access camera/microphone. Please check permissions.');
                setIsConnecting(false);
            }
        };

        initCall();

        return () => {
            if (myStream) {
                myStream.getTracks().forEach(track => track.stop());
            }
            Object.values(peersRef.current).forEach(call => call.close());
            destroyPeerConnection();
            socket.off('userLeft');
        };
    }, [initializePeerConnection]);

    const toggleMute = useCallback(() => {
        if (myStream) {
            const audioTracks = myStream.getAudioTracks();
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    }, [myStream, isMuted]);

    const toggleVideo = useCallback(() => {
        if (myStream) {
            const videoTracks = myStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    }, [myStream, isVideoOff]);

    const handleLeaveMeeting = useCallback(() => {
        socket.emit('leaveMeeting');
        if (myStream) {
            myStream.getTracks().forEach(track => track.stop());
        }
        Object.values(peersRef.current).forEach(call => call.close());
        destroyPeerConnection();
        window.location.href = '/';
    }, [myStream]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-grow overflow-auto p-3 bg-slate-200">
                <div className="flex flex-wrap gap-3 justify-center content-start">
                    {/* My Video */}
                    <div className="relative w-40 h-32 rounded-lg overflow-hidden shadow-md bg-slate-800">
                        <video
                            ref={myVideo}
                            muted
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1 text-xs text-center">
                            {userName} (You)
                            {isMuted && <span className="ml-1">🔇</span>}
                            {isVideoOff && <span className="ml-1">🎦</span>}
                        </div>
                    </div>

                    {/* Peer Videos */}
                    {Object.keys(peers).map((peerId) => (
                        <div key={peerId} className="relative w-40 h-32 rounded-lg overflow-hidden shadow-md bg-slate-800">
                            <video
                                key={peerId}
                                autoPlay
                                playsInline
                                ref={(element) => {
                                    if (element && peers[peerId]?.stream) {
                                        element.srcObject = peers[peerId].stream;
                                    }
                                }}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1 text-xs text-center">
                                {userNamesRef.current[peerId] || 'Unknown'}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Error and Connection Status */}
                {error && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm text-center">
                        {error}
                    </div>
                )}

                {isConnecting && (
                    <div className="mt-3 p-2 bg-slate-300 border border-slate-400 text-slate-700 rounded-md text-sm text-center">
                        Connecting to peers...
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center space-x-3 p-3 border-t border-slate-300">
                <button
                    onClick={toggleMute}
                    className={`p-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-slate-600'} text-white focus:outline-none transition-colors`}
                >
                    {isMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M1.293 1.293a1 1 0 011.414 0L16.707 15.293a1 1 0 01-1.414 1.414L1.293 2.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                        </svg>
                    )}
                </button>

                <button
                    onClick={toggleVideo}
                    className={`p-2 rounded-full ${isVideoOff ? 'bg-red-500' : 'bg-slate-600'} text-white focus:outline-none transition-colors`}
                >
                    {isVideoOff ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                            <path fillRule="evenodd" d="M3.293 3.293a1 1 0 011.414 0L18.707 17.293a1 1 0 01-1.414 1.414L3.293 4.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                            <path d="M14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                    )}
                </button>

                <button
                    onClick={handleLeaveMeeting}
                    className="px-2 py-2 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 focus:outline-none transition-colors"
                >
                    <IoIosCall className='text-xl' />
                </button>
            </div>
        </div>
    );
};

export default VideoCall;

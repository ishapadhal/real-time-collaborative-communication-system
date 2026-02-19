import React from "react";

const UserList = ({ usersFromParent, meetingCode }) => {
    console.log("UserList rendering with users:", usersFromParent);
    
    // Get current host name from localStorage for comparison
    const hostName = localStorage.getItem("hostName") || "";
    
    // Function to generate consistent colors from strings
    function stringToColor(string) {
        let hash = 0;
        let i;

        for (i = 0; i < string.length; i += 1) {
            hash = string.charCodeAt(i) + ((hash << 5) - hash);
        }

        let color = '#';
        for (i = 0; i < 3; i += 1) {
            const value = (hash >> (i * 8)) & 0xff;
            color += `00${value.toString(16)}`.slice(-2);
        }
        return color;
    }
    
    return (
        <div className="flex flex-col h-full bg-slate-50 rounded-lg shadow-md overflow-hidden">
            <div className="flex items-center p-4 border-b border-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                </svg>
                <h2 className="text-lg font-semibold text-slate-800">Participants ({usersFromParent?.length || 0})</h2>
                <span className="ml-auto px-2 py-1 text-xs font-medium bg-slate-200 text-slate-700 rounded-full">
                    {meetingCode}
                </span>
            </div>
            
            <div className="border-t border-slate-200"></div>
            
            {usersFromParent && usersFromParent.length > 0 ? (
                <div className="overflow-auto flex-grow p-2 h-[calc(100%-64px)]">
                    <ul className="space-y-2">
                        {usersFromParent.map((user) => {
                            const isHost = user.name === hostName;
                            return (
                                <li key={user.id} className="flex items-center p-2 hover:bg-slate-100 rounded-lg transition-colors duration-150">
                                    <div 
                                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium mr-3 ${isHost ? 'ring-2 ring-amber-400' : ''}`}
                                        style={{ backgroundColor: stringToColor(user.name) }}
                                    >
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="overflow-hidden flex-grow">
                                        <div className="flex items-center">
                                            <p className="font-medium truncate text-slate-800">{user.name}</p>
                                            {isHost && (
                                                <span className="ml-2 text-amber-500" title="Host">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 truncate">
                                            {isHost ? 'Meeting Host' : user.peerId ? `ID: ${user.peerId.substring(0, 6)}...` : 'Connecting...'}
                                        </p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-[calc(100%-64px)] text-slate-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <p className="text-sm font-medium">No users in the meeting yet</p>
                </div>
            )}
        </div>
    );
};

export default UserList;

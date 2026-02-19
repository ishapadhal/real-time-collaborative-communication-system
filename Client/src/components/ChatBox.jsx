import React, { useState, useEffect, useCallback, useRef } from "react";
import socket from "../socket";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB max file size
const MAX_IMAGE_DIMENSION = 1200; // Max width/height for images
const IMAGE_QUALITY = 0.7; // JPEG quality for compression

const ChatBox = () => {
    const [message, setMessage] = useState("");
    const [messages, setMessages] = useState([]);
    const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
    const [attachment, setAttachment] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);
    const meetingCode = localStorage.getItem("meetingCode");
    const userName = localStorage.getItem("userName");
    const messagesEndRef = useRef(null);
    const attachmentMenuRef = useRef(null);

    // Scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Handle click outside attachment menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target)) {
                setShowAttachmentMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const handleNewMessage = (newMessage) => {
            setMessages(prevMessages => [...prevMessages, newMessage]);
        };

        socket.on("receiveMessage", handleNewMessage);

        return () => socket.off("receiveMessage", handleNewMessage);
    }, []);

    // Extract links from text
    const extractLinks = (text) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex);
        return matches || [];
    };

    // Format message text with clickable links
    const formatMessageText = (text) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.split(urlRegex).map((part, index) => {
            if (part.match(urlRegex)) {
                return (
                    <a 
                        key={index}
                        href={part}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    // Get file type icon based on file extension
    const getFileIcon = (fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();
        
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
            );
        } else if (['pdf'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
            );
        } else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
            );
        } else {
            return (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                </svg>
            );
        }
    };

    // Handle file selection
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            alert(`File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
            return;
        }
        
        try {
            // If it's an image, compress it
            if (file.type.startsWith('image/')) {
                const compressedFile = await compressImage(file);
                setAttachment({
                    file: compressedFile,
                    name: file.name,
                    type: file.type,
                    size: compressedFile.size
                });
            } else {
                // For non-image files, just use as is (with size limit)
                setAttachment({
                    file,
                    name: file.name,
                    type: file.type,
                    size: file.size
                });
            }
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file. Please try again with a different file.');
        }
    };

    // Add this image compression function
    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                
                img.onload = () => {
                    // Calculate new dimensions while maintaining aspect ratio
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height && width > MAX_IMAGE_DIMENSION) {
                        height = Math.round(height * (MAX_IMAGE_DIMENSION / width));
                        width = MAX_IMAGE_DIMENSION;
                    } else if (height > MAX_IMAGE_DIMENSION) {
                        width = Math.round(width * (MAX_IMAGE_DIMENSION / height));
                        height = MAX_IMAGE_DIMENSION;
                    }
                    
                    // Create canvas and draw resized image
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convert to blob with compression
                    canvas.toBlob((blob) => {
                        // Create a new file from the blob
                        const compressedFile = new File(
                            [blob], 
                            file.name, 
                            { type: 'image/jpeg', lastModified: Date.now() }
                        );
                        resolve(compressedFile);
                    }, 'image/jpeg', IMAGE_QUALITY);
                };
                
                img.onerror = () => {
                    reject(new Error('Failed to load image'));
                };
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };
        });
    };

    const sendMessage = useCallback(async () => {
        if ((!message.trim() && !attachment) || isUploading) return;
        
        try {
            setIsUploading(attachment !== null);
            
            let attachmentData = null;
            
            if (attachment) {
                // Convert file to base64
                const reader = new FileReader();
                
                const fileBase64 = await new Promise((resolve, reject) => {
                    reader.readAsDataURL(attachment.file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
                
                attachmentData = {
                    data: fileBase64,
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size
                };
            }
            
            // Find links in message
            const links = extractLinks(message);
            
            // Emit message with attachment if any
            socket.emit("sendMessage", { 
                meetingCode, 
                userName, 
                message: message.trim(), 
                attachment: attachmentData,
                links: links.length > 0 ? links : null
            });
            
            setMessage("");
            setAttachment(null);
            setIsUploading(false);
        } catch (error) {
            console.error("Error sending message:", error);
            setIsUploading(false);
            alert("Failed to send message. The file may be too large.");
        }
    }, [message, attachment, isUploading, meetingCode, userName]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }, [sendMessage]);

    // Remove attachment
    const removeAttachment = () => {
        setAttachment(null);
    };

    // Generate avatar color based on username
    const stringToColor = (string) => {
        let hash = 0;
        for (let i = 0; i < string.length; i++) {
            hash = string.charCodeAt(i) + ((hash << 5) - hash);
        }
        let color = '#';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xff;
            color += `00${value.toString(16)}`.slice(-2);
        }
        return color;
    };

    // Render attachment preview
    const renderAttachmentPreview = (file) => {
        if (!file) return null;
        
        const isImage = file.type.startsWith('image/');
        
        if (isImage) {
            return (
                <div className="relative inline-block">
                    <img 
                        src={URL.createObjectURL(file)} 
                        alt="Preview" 
                        className="max-h-24 max-w-full rounded border border-slate-300 shadow-sm"
                    />
                    <button 
                        onClick={removeAttachment}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-sm hover:bg-red-600 transition-colors"
                    >
                        &times;
                    </button>
                </div>
            );
        }
        
        // Get file type for background color
        const getFileColor = (fileName) => {
            const ext = fileName.split('.').pop().toLowerCase();
            
            if (['pdf'].includes(ext)) {
                return 'bg-red-100 text-red-800 border-red-200';
            } else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
                return 'bg-blue-100 text-blue-800 border-blue-200';
            } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
                return 'bg-green-100 text-green-800 border-green-200';
            } else if (['ppt', 'pptx'].includes(ext)) {
                return 'bg-orange-100 text-orange-800 border-orange-200';
            } else if (['zip', 'rar', 'tar', 'gz'].includes(ext)) {
                return 'bg-purple-100 text-purple-800 border-purple-200';
            } else {
                return 'bg-slate-100 text-slate-800 border-slate-200';
            }
        };
        
        return (
            <div className={`relative inline-flex items-center px-3 py-2 rounded border shadow-sm hover:shadow-md transition-shadow ${getFileColor(file.name)}`}>
                {getFileIcon(file.name)}
                <span className="ml-2 text-sm font-medium truncate max-w-[150px]">{file.name}</span>
                <button 
                    onClick={removeAttachment}
                    className="ml-2 text-red-500 hover:text-red-700 transition-colors font-bold"
                >
                    &times;
                </button>
            </div>
        );
    };

    // Render message attachment
    const renderMessageAttachment = (attachment) => {
        if (!attachment) return null;
        
        const isImage = attachment.type.startsWith('image/');
        
        if (isImage) {
            return (
                <div className="mt-2">
                    <a 
                        href={attachment.data} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="block"
                    >
                        <img 
                            src={attachment.data} 
                            alt={attachment.name} 
                            className="max-h-56 max-w-full rounded shadow-sm hover:shadow-md transition-shadow"
                        />
                    </a>
                </div>
            );
        }
        
        // Get file type for background color
        const getFileColor = (fileName) => {
            const ext = fileName.split('.').pop().toLowerCase();
            
            if (['pdf'].includes(ext)) {
                return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
            } else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) {
                return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
            } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
                return 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200';
            } else if (['ppt', 'pptx'].includes(ext)) {
                return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
            } else if (['zip', 'rar', 'tar', 'gz'].includes(ext)) {
                return 'bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200';
            } else {
                return 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200';
            }
        };
        
        return (
            <div className="mt-2">
                <a 
                    href={attachment.data} 
                    download={attachment.name}
                    className={`flex items-center p-2 rounded border shadow-sm ${getFileColor(attachment.name)} transition-colors`}
                >
                    {getFileIcon(attachment.name)}
                    <span className="ml-2 text-sm font-medium truncate max-w-[200px]">{attachment.name}</span>
                    <span className="ml-1 text-xs opacity-75">
                        ({Math.round(attachment.size / 1024)} KB)
                    </span>
                </a>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 rounded-lg shadow-md overflow-hidden">
            {/* Header */}
            <div className="flex items-center p-4 border-b border-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
                <h2 className="text-lg font-semibold text-slate-800">Chat</h2>
            </div>
            
            {/* Messages */}
            <div className="flex-grow overflow-auto p-4 bg-slate-100 h-[calc(100%-106px)]">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2 opacity-50" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm">No messages yet</p>
                        <p className="text-sm">Be the first to send a message!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {messages.map((msg, index) => {
                            const isCurrentUser = msg.userName === userName;
                            return (
                                <div 
                                    key={index} 
                                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                                >
                                    <div className={`flex items-start max-w-[85%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div 
                                            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${isCurrentUser ? 'ml-2' : 'mr-2'}`}
                                            style={{ backgroundColor: stringToColor(msg.userName) }}
                                        >
                                            {msg.userName.charAt(0).toUpperCase()}
                                        </div>
                                        
                                        <div className="max-w-full">
                                            <span className={`text-xs text-slate-500 block ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                                                {msg.userName}
                                            </span>
                                            <div 
                                                className={`p-3 rounded-lg inline-block max-w-full ${
                                                    isCurrentUser 
                                                    ? 'bg-slate-700 text-white rounded-br-none' 
                                                    : 'bg-slate-200 text-slate-800 rounded-bl-none'
                                                }`}
                                            >
                                                <p className="text-sm break-words whitespace-pre-wrap">
                                                    {msg.message ? formatMessageText(msg.message) : (msg.attachment ? "Sent an attachment" : "")}
                                                </p>
                                                
                                                {msg.attachment && renderMessageAttachment(msg.attachment)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
            
            {/* Attachment Preview */}
            {attachment && (
                <div className="px-4 py-2 border-t border-slate-200">
                    {renderAttachmentPreview(attachment)}
                </div>
            )}
            
            {/* Input */}
            <div className="border-t border-slate-200 p-4">
                <div className="flex items-end">
                    <div className="relative">
                        <button 
                            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                            className="p-2 rounded-full text-slate-500 hover:bg-slate-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                            </svg>
                        </button>
                        
                        {/* Hidden file input */}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                        />
                        
                        {/* Attachment Menu */}
                        {showAttachmentMenu && (
                            <div 
                                ref={attachmentMenuRef}
                                className="absolute bottom-10 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-48"
                            >
                                <button 
                                    onClick={() => {
                                        setShowAttachmentMenu(false);
                                        fileInputRef.current?.click();
                                    }}
                                    className="flex items-center w-full p-2 hover:bg-slate-100 rounded"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm">Image</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setShowAttachmentMenu(false);
                                        fileInputRef.current?.click();
                                    }}
                                    className="flex items-center w-full p-2 hover:bg-slate-100 rounded"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-sm">Document</span>
                                </button>
                            </div>
                        )}
                    </div>
                    
                    <textarea
                        className="flex-grow resize-none border border-slate-300 rounded-lg py-2 px-3 ml-2 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent text-slate-800"
                        rows={1}
                        placeholder="Type your message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        style={{ maxHeight: '6rem' }}
                    />
                    
                    <button 
                        className={`ml-2 p-2 rounded-full ${(message.trim() || attachment) ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        onClick={sendMessage}
                        disabled={(!message.trim() && !attachment) || isUploading}
                    >
                        {isUploading ? (
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatBox;

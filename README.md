# PeerLink - Collaborative Coding & Video Call Platform

PeerLink is a real-time collaborative platform designed for remote coding sessions, interviews, and team programming. It combines collaborative code editing with video conferencing capabilities, enabling users to work together seamlessly regardless of location.

## ✨ Features

- **Collaborative Code Editor**: Edit code in real-time with syntax highlighting and multiple language support
- **Video Conferencing**: Connect face-to-face with peers through integrated video calls
- **Real-time Chat**: Communicate with other participants via text chat
- **Code Execution**: Run and test code directly within the platform
- **User Management**: See all meeting participants and their status
- **Multiple Language Support**: JavaScript, Python, Java, C++, C# and more

## 🛠️ Tech Stack

### Frontend
- **React** with Vite for fast development
- **Monaco Editor** for powerful code editing
- **Socket.IO Client** for real-time communication
- **PeerJS** for WebRTC video connections
- **Material UI** for responsive interface components
- **Redux Toolkit** for state management
- **TailwindCSS** for styling

### Backend
- **Express** for the server framework
- **Socket.IO** for bidirectional communication
- **PeerJS Server** for WebRTC signaling
- **Judge0 API** integration for code execution

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/divyeshdhole/PeerLink.git
   cd PeerLink
   ```

2. Set up the server:
   ```bash
   cd Server
   npm install
   # Create .env file with required environment variables
   npm start
   ```

3. Set up the client:
   ```bash
   cd Client
   npm install
   # Create .env file with required environment variables
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5173`

## 🔧 Environment Variables

### Server (.env)
```
PORT=3001
JUDGE0_API_KEY=your_judge0_api_key
```

### Client (.env)
```
VITE_SERVER_URL=http://localhost:3001
VITE_PEER_HOST=localhost
VITE_PEER_PORT=3001
VITE_PEER_PATH=/peerjs
```

## 📝 Usage

1. Create or join a meeting by entering a meeting code
2. Share the meeting code with collaborators
3. Edit code together in real-time
4. Use video and chat to communicate with team members
5. Run and test your code directly in the editor

## 🔍 Project Structure

### Client
- **src/pages**: Main application pages (MeetingPage, MeetingCreate, GetUsername)
- **src/components**: Reusable UI components (VideoCall, ChatBox, CodeEditor, UserList)
- **src/appStore**: Redux store configuration
- **src/assets**: Static resources and images

### Server
- **index.js**: Main server file handling Socket.IO events, PeerJS server, and code execution

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgements

- Monaco Editor for the code editing capabilities
- Socket.IO for the real-time communication infrastructure
- PeerJS for WebRTC video functionality

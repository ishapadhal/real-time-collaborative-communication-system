import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MeetingCreate from './pages/MeetingCreate';
import MeetingPage from './pages/MeetingPage';
import { useState } from 'react';
import './App.css';
import GetUsername from './pages/GetUsername'
const App = () => {

  const [joined, setJoined] = useState(false);


  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MeetingCreate setJoined={setJoined} />} />
        <Route path="/meeting/:meetingCode" element={<MeetingPage joined={joined} setJoined={setJoined} />} />
        <Route path="/:meetingCode/username" element={<GetUsername/>}/>
      </Routes>
    </BrowserRouter>
  );
};

export default App;

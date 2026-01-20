import React from 'react';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import RoomSelection from './components/RoomSelection';
import GameInterface from './components/GameInterface';
import './App.css';

function App() {
  return (
    <WebSocketProvider>
      <div className="App">
        <MainContent />
      </div>
    </WebSocketProvider>
  );
}

function MainContent() {
  const { currentRoomCode } = useWebSocket();

  return (
    <div className="main-content">
      <header className="app-header">
        <h1>扑克对战游戏 - React版</h1>
        <p>实时联机对战，支持翻牌对战和三堆出牌</p>
      </header>
      
      {currentRoomCode ? <GameInterface /> : <RoomSelection />}
      
      <footer className="app-footer">
        <p>使用WebSocket实时通信，支持多房间对战</p>
      </footer>
    </div>
  );
}

export default App;

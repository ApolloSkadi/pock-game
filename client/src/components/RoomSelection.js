import React, { useState } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

const RoomSelection = () => {
  const { createRoom, joinRoom, error, roomStatus } = useWebSocket();
  const [playerNameCreate, setPlayerNameCreate] = useState(`玩家${Math.floor(Math.random() * 1000)}`);
  const [playerNameJoin, setPlayerNameJoin] = useState(`玩家${Math.floor(Math.random() * 1000)}`);
  const [roomCode, setRoomCode] = useState('');
  const [gameType, setGameType] = useState('flip_card');

  const handleCreateRoom = () => {
    if (!playerNameCreate.trim()) {
      alert('请输入昵称');
      return;
    }
    createRoom(playerNameCreate, gameType);
  };

  const handleJoinRoom = () => {
    if (!playerNameJoin.trim()) {
      alert('请输入昵称');
      return;
    }
    if (!roomCode.trim() || roomCode.length !== 4) {
      alert('请输入4位数字房间码');
      return;
    }
    joinRoom(roomCode, playerNameJoin);
  };

  const handleRoomCodeInput = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setRoomCode(value);
  };

  const getGameTypeName = (type) => {
    return type === 'three_pile' ? '三堆出牌' : '翻牌对战';
  };

  return (
    <div className="room-selection">
      <h2 id="room-selection-title">
        {gameType === 'three_pile' ? '三堆出牌 - 房间联机版' : '翻牌对战 - 房间联机版'}
      </h2>
      <p id="room-selection-subtitle">
        {gameType === 'three_pile' ? '创建或加入房间，体验三堆出牌对战' : '创建或加入房间，与好友进行实时对战'}
      </p>
      
      {error && <div className="error-message">{error}</div>}
      {roomStatus && <div className="room-status">{roomStatus}</div>}

      <div className="selection-container">
        <div className="create-room-section">
          <h3>创建房间</h3>
          <div className="form-group">
            <label htmlFor="player-name-create">你的昵称：</label>
            <input
              id="player-name-create"
              type="text"
              value={playerNameCreate}
              onChange={(e) => setPlayerNameCreate(e.target.value)}
              placeholder="请输入昵称"
            />
          </div>
          <div className="form-group">
            <label htmlFor="game-type">游戏类型：</label>
            <select
              id="game-type"
              value={gameType}
              onChange={(e) => setGameType(e.target.value)}
            >
              <option value="flip_card">翻牌对战</option>
              <option value="three_pile">三堆出牌</option>
            </select>
          </div>
          <button id="create-room-btn" onClick={handleCreateRoom}>
            创建房间
          </button>
        </div>

        <div className="join-room-section">
          <h3>加入房间</h3>
          <div className="form-group">
            <label htmlFor="player-name-join">你的昵称：</label>
            <input
              id="player-name-join"
              type="text"
              value={playerNameJoin}
              onChange={(e) => setPlayerNameJoin(e.target.value)}
              placeholder="请输入昵称"
            />
          </div>
          <div className="form-group">
            <label htmlFor="room-code">房间码：</label>
            <input
              id="room-code"
              type="text"
              value={roomCode}
              onChange={handleRoomCodeInput}
              placeholder="4位数字"
              maxLength="4"
            />
          </div>
          <button id="join-room-btn" onClick={handleJoinRoom}>
            加入房间
          </button>
        </div>
      </div>

      <div className="game-instructions">
        <h3>游戏说明</h3>
        <ul id="room-selection-instructions">
          {gameType === 'three_pile' ? (
            <>
              <li>每局游戏需要2位玩家</li>
              <li>房间码为4位数字，创建房间后分享给好友</li>
              <li>每人三堆牌，每堆第一张翻开</li>
              <li>按大小出牌，先出完所有牌者获胜</li>
              <li>支持大小王，大王为最大牌</li>
              <li>游戏结束后可重复对战，战绩计入排行榜</li>
            </>
          ) : (
            <>
              <li>每局游戏需要2位玩家</li>
              <li>房间码为4位数字，创建房间后分享给好友</li>
              <li>游戏支持多房间同时进行</li>
              <li>游戏结束后可重复对战，战绩计入排行榜</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default RoomSelection;

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
  const [ws, setWs] = useState(null);
  const [currentRoomCode, setCurrentRoomCode] = useState(null);
  const [pid, setPid] = useState(null);
  const [game, setGame] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [roomGameType, setRoomGameType] = useState('flip_card');
  const [roomStatus, setRoomStatus] = useState('');
  const [error, setError] = useState(null);

  const connectWebSocket = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
    const socket = new WebSocket(`${protocol}//${wsHost}`);

    socket.onopen = () => {
      console.log('WebSocket连接已建立');
      setError(null);
    };

    socket.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('收到消息:', data.type, data);
        handleWebSocketMessage(data);
      } catch (err) {
        console.error('消息解析错误:', err);
      }
    };

    socket.onclose = () => {
      console.log('WebSocket连接已关闭');
      setError('与服务器的连接已断开，请刷新页面重新连接');
    };

    socket.onerror = (error) => {
      console.error('WebSocket错误:', error);
      setError('连接服务器时发生错误，请检查网络连接');
    };

    setWs(socket);
    return socket;
  }, []);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'room_created':
        handleRoomCreated(data);
        break;
      case 'room_joined':
        handleRoomJoined(data);
        break;
      case 'player_joined':
        handlePlayerJoined(data);
        break;
      case 'player_left':
        handlePlayerLeft(data);
        break;
      case 'start':
        handleGameStart(data);
        break;
      case 'update':
        handleGameUpdate(data);
        break;
      case 'end':
        handleGameEnd(data);
        break;
      case 'leaderboard':
        updateLeaderboard(data.leaderboard);
        break;
      case 'error':
        setError(data.message);
        alert(data.message);
        break;
      case 'game_reset':
        alert(data.message);
        resetGameState();
        break;
      case 'room_timeout':
        handleRoomTimeout(data);
        break;
      case 'room_status':
        handleRoomStatus(data);
        break;
      default:
        console.log('未知消息类型:', data.type);
    }
  };

  const handleRoomCreated = (data) => {
    setCurrentRoomCode(data.roomCode);
    setPlayerId(data.playerId);
    setPlayerName(data.playerName);
    setPid(data.pid);
    setIsHost(data.isHost);
    setRoomGameType(data.gameType || 'flip_card');
    setRoomStatus(data.message);
    setRoomPlayers([{ name: data.playerName, isHost: true, id: data.playerId }]);
  };

  const handleRoomJoined = (data) => {
    setCurrentRoomCode(data.roomCode);
    setPlayerId(data.playerId);
    setPlayerName(data.playerName);
    setPid(data.pid);
    setIsHost(data.isHost);
    setRoomGameType(data.gameType || 'flip_card');
    
    if (data.playerCount === 2) {
      setRoomStatus(`房间已满 (2/2)，等待房主开始游戏...`);
    } else {
      setRoomStatus(`已加入房间，等待其他玩家加入... (${data.playerCount}/2)`);
    }
    
    // 如果是房主且房间满2人，稍后显示开始游戏按钮（由GameInterface组件处理）
  };

  const handlePlayerJoined = (data) => {
    setRoomStatus(`${data.playerName} 加入了房间 (${data.playerCount}/2)`);
    // 获取最新房间状态
    sendMessage({ type: 'get_room_status' });
  };

  const handlePlayerLeft = (data) => {
    setRoomStatus(`${data.playerName} 离开了房间 (${data.playerCount}/2)`);
    sendMessage({ type: 'get_room_status' });
  };

  const handleGameStart = (data) => {
    setGame(data.game);
    setRoomStatus(`${data.gameName || '翻牌对战'} 开始！`);
  };

  const handleGameUpdate = (data) => {
    setGame(data.game);
  };

  const handleGameEnd = (data) => {
    setGame(data.game);
    // 游戏结束动画由GameInterface组件处理
  };

  const handleRoomTimeout = (data) => {
    alert(data.message);
    resetGameState();
    setCurrentRoomCode(null);
  };

  const handleRoomStatus = (data) => {
    setRoomPlayers(data.players);
    setRoomStatus(`房间状态: ${data.playerCount}/2 位玩家`);
  };

  const updateLeaderboard = (leaderboard) => {
    setLeaderboardData(leaderboard);
  };

  const resetGameState = () => {
    setPid(null);
    setGame(null);
    setPlayerId(null);
    setIsHost(false);
    setLeaderboardData([]);
    setRoomPlayers([]);
  };

  const sendMessage = useCallback((message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket未连接');
      setError('WebSocket未连接，请刷新页面重试');
    }
  }, [ws]);

  const createRoom = (playerName, gameType) => {
    sendMessage({ type: 'create_room', playerName, gameType });
  };

  const joinRoom = (roomCode, playerName) => {
    sendMessage({ type: 'join_room', roomCode, playerName });
  };

  const leaveRoom = () => {
    sendMessage({ type: 'leave_room' });
    resetGameState();
    setCurrentRoomCode(null);
  };

  const startGame = (gameType) => {
    sendMessage({ type: 'start_game', gameType });
  };

  const restartGame = () => {
    sendMessage({ type: 'restart' });
  };

  const sendGameAction = (action) => {
    sendMessage({ type: 'game_action', action });
  };

  const getRoomStatus = () => {
    sendMessage({ type: 'get_room_status' });
  };

  useEffect(() => {
    const socket = connectWebSocket();
    return () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [connectWebSocket]);

  const value = {
    ws,
    currentRoomCode,
    pid,
    game,
    playerId,
    playerName,
    isHost,
    leaderboardData,
    roomPlayers,
    roomGameType,
    roomStatus,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    restartGame,
    sendGameAction,
    getRoomStatus,
    setPlayerName,
    setRoomGameType,
    resetGameState
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

import React, { useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import FlipCardGame from './FlipCardGame';
import ThreePileGame from './ThreePileGame';
import Leaderboard from './Leaderboard';

const GameInterface = () => {
  const {
    currentRoomCode,
    playerName,
    isHost,
    roomPlayers,
    roomStatus,
    game,
    roomGameType,
    leaderboardData,
    leaveRoom,
    startGame,
    restartGame,
    getRoomStatus
  } = useWebSocket();

  useEffect(() => {
    // 获取房间状态
    getRoomStatus();
  }, [getRoomStatus]);

  const handleLeaveRoom = () => {
    if (window.confirm('确定要离开房间吗？')) {
      leaveRoom();
    }
  };

  const handleStartGame = () => {
    startGame(roomGameType);
  };

  const handleRestartGame = () => {
    restartGame();
  };

  const renderGame = () => {
    if (!game) {
      return null;
    }

    if (game.gameName === '三堆出牌') {
      return <ThreePileGame />;
    } else {
      return <FlipCardGame />;
    }
  };

  return (
    <div className="game-interface">
      <div className="game-header">
        <h1>{game ? game.gameName : roomGameType === 'three_pile' ? '三堆出牌' : '翻牌对战'}</h1>
        <div className="room-info">
          <div className="room-code">房间码: {currentRoomCode}</div>
          <div className="player-info">玩家: {playerName} {isHost ? '(房主)' : ''}</div>
          <div className="room-status">{roomStatus}</div>
        </div>
        <button id="leave-room-btn" className="leave-btn" onClick={handleLeaveRoom}>
          离开房间
        </button>
        <button id="refresh-room-btn" className="refresh-btn" onClick={getRoomStatus}>
          刷新状态
        </button>
      </div>

      <div className="game-content">
        <div className="left-panel">
          <div className="player-list-container">
            <h3>玩家列表 ({roomPlayers.length}/2)</h3>
            <ul id="player-list">
              {roomPlayers.length === 0 ? (
                <li>等待玩家加入...</li>
              ) : (
                roomPlayers.map((player, index) => (
                  <li key={index}>
                    {player.name} {player.isHost ? '👑' : ''}
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="start-game-section">
            {isHost && roomPlayers.length === 2 && !game && (
              <button id="start-game-btn" className="start-btn" onClick={handleStartGame}>
                开始游戏
              </button>
            )}
            {game && isHost && (
              <button className="restart-btn" onClick={handleRestartGame}>
                重新开始
              </button>
            )}
          </div>

          <div className="game-rules">
            <h3>游戏规则</h3>
            <ul id="game-rules-list">
              {roomGameType === 'three_pile' ? (
                <>
                  <li>每人三堆牌，每堆第一张自动翻开</li>
                  <li>出牌类型：单张、对子(2张相同)、三连(3张相同)、顺子(3-5张连续，不含大小王)</li>
                  <li>下家必须出相同类型且比上家更大的牌</li>
                  <li>可以选择不出牌（跳过）</li>
                  <li>连续两人不出牌则清除出牌记录，重新开始</li>
                  <li>先出完所有牌的玩家获胜</li>
                  <li>大小王可出，大王最大，小王次之</li>
                  <li>支持石头剪刀布决定先手</li>
                </>
              ) : (
                <>
                  <li>每回合猜测自己的一张牌</li>
                  <li>猜错则牌进入惩罚堆，并补充新牌</li>
                  <li>五回合后比较双方惩罚牌数量，少者胜利</li>
                  <li>游戏结束后可点击"重新开始"再次游玩</li>
                  <li>胜利次数会计入排行榜</li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="center-panel">
          <div id="round" className="round-display">
            {game ? (game.gameName === '三堆出牌' ? `${game.gameName} - ${game.currentPlayer === 0 ? '玩家1回合' : '玩家2回合'}` : `第 ${game.step || 1} 张牌`) : '等待游戏开始'}
          </div>
          {renderGame()}
        </div>

        <div className="right-panel">
          <Leaderboard data={leaderboardData} />
        </div>
      </div>
    </div>
  );
};

export default GameInterface;

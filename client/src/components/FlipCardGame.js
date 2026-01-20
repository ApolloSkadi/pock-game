import React from 'react';
import { useWebSocket } from '../context/WebSocketContext';

const FlipCardGame = () => {
  const { pid, game, sendGameAction } = useWebSocket();

  if (!game) return null;

  const renderCard = (card, index, showAll = false) => {
    const isFaceUp = card.faceUp || showAll;
    return (
      <div key={index} className={`card ${isFaceUp ? 'front' : 'back'}`}>
        {isFaceUp && (
          <>
            {card.rank}{card.suit}
            {card.isRed && <span className="red-indicator" />}
          </>
        )}
      </div>
    );
  };

  const renderActions = () => {
    if (!game || game.finished[pid]) return null;

    const createButton = (text, value, className) => (
      <button
        key={value}
        className={className}
        onClick={() => sendGameAction({ answer: value })}
      >
        {text}
      </button>
    );

    switch (game.step) {
      case 1:
        return [
          createButton('红色', 'red', 'left'),
          createButton('黑色', 'black', 'right')
        ];
      case 2:
        return [
          createButton('更大', 'bigger', 'left'),
          createButton('更小', 'smaller', 'right')
        ];
      case 3:
        return [
          createButton('在之间', 'between', 'left'),
          createButton('不在之间', 'not', 'right')
        ];
      case 4:
        return ['♠', '♥', '♣', '♦'].map(suit =>
          createButton(suit, suit, 'left')
        );
      case 5:
        return [createButton('翻牌', 'flip', 'left')];
      default:
        return null;
    }
  };

  return (
    <div className="flip-card-interface">
      <div className="game-area">
        <div className="player-section">
          <h4>对手手牌</h4>
          <div id="opponent" className="hand">
            {game.hands[1 - pid]?.map((card, index) => renderCard(card, index))}
          </div>
          <h4>对手惩罚牌</h4>
          <div id="penalty-op" className="penalty">
            {game.penalty[1 - pid]?.map((card, index) => renderCard(card, index, true))}
          </div>
        </div>

        <div className="player-section">
          <h4>你的手牌</h4>
          <div id="self" className="hand">
            {game.hands[pid]?.map((card, index) => renderCard(card, index))}
          </div>
          <h4>你的惩罚牌</h4>
          <div id="penalty-self" className="penalty">
            {game.penalty[pid]?.map((card, index) => renderCard(card, index, true))}
          </div>
        </div>
      </div>

      <div id="actions" className="actions">
        {renderActions()}
      </div>
    </div>
  );
};

export default FlipCardGame;

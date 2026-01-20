import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

const ThreePileGame = () => {
  const { pid, game, sendGameAction } = useWebSocket();
  const [selectedCards, setSelectedCards] = useState([]);

  // Reset selected cards when game changes
  useEffect(() => {
    setSelectedCards([]);
  }, [game]);

  if (!game) return null;

  // Helper function to render a single card
  const renderCard = (card, pileIndex, cardIndex, isOwnCard = true) => {
    const isFaceUp = card.faceUp;
    const isSelected = selectedCards.some(
      c => c.pileIndex === pileIndex && c.cardIndex === cardIndex
    );

    const cardClasses = `card ${isFaceUp ? 'front' : 'back'} ${isSelected ? 'selected' : ''}`;
    const cardStyle = isSelected ? { boxShadow: '0 0 15px #ffcc00' } : {};
    // 确定花色类名
    const suitClass = card.isRed ? 'red-suit' : 'black-suit';
    const suitSpecificClass = card.suit === '♥' ? 'suit-heart' : 
                             card.suit === '♦' ? 'suit-diamond' :
                             card.suit === '♠' ? 'suit-spade' : 'suit-club';

    return (
      <div
        key={`${pileIndex}-${cardIndex}`}
        className={cardClasses}
        style={cardStyle}
        data-pile-index={pileIndex}
        data-card-index={cardIndex}
        onClick={() => isOwnCard && isFaceUp && handleCardClick(pileIndex, cardIndex)}
      >
        {isFaceUp && (
          <>
            <span className="card-rank">{card.rank}</span>
            <span className={`card-suit ${suitClass} ${suitSpecificClass}`}>{card.suit}</span>
            {card.isRed && <span className="red-indicator" />}
          </>
        )}
      </div>
    );
  };

  // Helper function to render a pile of cards
  const renderPile = (pile, pileIndex, isOwnCard = true) => {
    if (pile.length === 0) return null;

    return (
      <div className="pile-container" key={pileIndex}>
        <div className="pile-label">
          {isOwnCard ? `牌堆 ${pileIndex + 1}` : `对手牌堆 ${pileIndex + 1}`}
        </div>
        <div className="pile">
          {pile.map((card, cardIndex) => renderCard(card, pileIndex, cardIndex, isOwnCard))}
          {pile.length > 1 && (
            <div className="remaining-count">{pile.length - 1}</div>
          )}
        </div>
      </div>
    );
  };

  const handleCardClick = (pileIndex, cardIndex) => {
    // Check if the card is already selected
    const existingIndex = selectedCards.findIndex(
      c => c.pileIndex === pileIndex && c.cardIndex === cardIndex
    );

    if (existingIndex >= 0) {
      // Remove from selection
      setSelectedCards(prev => prev.filter((_, idx) => idx !== existingIndex));
    } else {
      // Add to selection
      setSelectedCards(prev => [...prev, { pileIndex, cardIndex }]);
    }
  };

  const handlePlayCards = () => {
    if (selectedCards.length === 0) {
      alert('请先选择要出的牌！');
      return;
    }

    sendGameAction({
      type: 'play',
      cards: selectedCards
    });
    setSelectedCards([]);
  };

  const handlePass = () => {
    sendGameAction({ type: 'pass' });
  };

  const handleCancelSelection = () => {
    setSelectedCards([]);
  };

  const renderRockPaperScissorsActions = () => {
    const myChoice = game.rockPaperScissors[`player${pid}`];
    
    if (myChoice !== null) {
      return <p>已选择: {getChoiceText(myChoice)}，等待对手选择...</p>;
    }

    if (game.currentPlayer !== pid) {
      return <p>等待对手选择石头剪刀布...</p>;
    }

    const choices = [
      { value: 'rock', text: '✊ 石头', color: '#3498db' },
      { value: 'paper', text: '✋ 布', color: '#2ecc71' },
      { value: 'scissors', text: '✌️ 剪刀', color: '#e74c3c' }
    ];

    return (
      <>
        <p style={{ textAlign: 'center', marginBottom: '15px', color: '#ffcc80' }}>
          请选择石头、剪刀或布：
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
          {choices.map(choice => (
            <button
              key={choice.value}
              style={{
                background: `linear-gradient(135deg, ${choice.color}, ${darkenColor(choice.color)})`,
                color: 'white',
                border: 'none',
                padding: '15px 20px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontWeight: 'bold',
                margin: '10px',
                flex: '1',
                minWidth: '120px',
                fontSize: '1.1rem'
              }}
              onClick={() => sendGameAction({
                type: 'rock_paper_scissors',
                choice: choice.value
              })}
            >
              {choice.text}
            </button>
          ))}
        </div>
      </>
    );
  };

  const getChoiceText = (choice) => {
    const texts = {
      'rock': '✊ 石头',
      'paper': '✋ 布', 
      'scissors': '✌️ 剪刀'
    };
    return texts[choice] || choice;
  };

  const darkenColor = (color) => {
    const colorMap = {
      '#3498db': '#2980b9',
      '#2ecc71': '#27ae60',
      '#e74c3c': '#c0392b'
    };
    return colorMap[color] || color.replace(/^#/, '#0');
  };

  // Check if game is finished
  if (game.winner !== null) {
    return (
      <div className="three-pile-interface">
        <div className="game-finished">
          <h2 style={{ color: '#ffcc00' }}>
            {game.winner === pid ? '🎉 恭喜你获胜！' : '💀 对手获胜！'}
          </h2>
        </div>
      </div>
    );
  }

  // Render based on game stage
  if (game.stage === 'rock_paper_scissors') {
    return (
      <div className="three-pile-interface">
        <div className="rock-paper-scissors">
          {renderRockPaperScissorsActions()}
        </div>
      </div>
    );
  }

  // Normal game stage
  return (
    <div className="three-pile-interface">
      <div className="game-area">
        <div className="player-section">
          <h4>对手牌堆</h4>
          <div id="opponent-piles" className="piles">
            {game.piles[1 - pid]?.map((pile, index) => renderPile(pile, index, false))}
          </div>
        </div>

        <div className="played-cards-area">
          <h4>出牌区</h4>
          <div id="played-cards">
            {game.lastPlay && game.lastPlay.type !== 'pass' ? (
              game.lastPlay.cards.map((card, index) => {
                const suitClass = card.isRed ? 'red-suit' : 'black-suit';
                const suitSpecificClass = card.suit === '♥' ? 'suit-heart' : 
                                         card.suit === '♦' ? 'suit-diamond' :
                                         card.suit === '♠' ? 'suit-spade' : 'suit-club';
                return (
                  <div key={index} className="card front">
                    <span className="card-rank">{card.rank}</span>
                    <span className={`card-suit ${suitClass} ${suitSpecificClass}`}>{card.suit}</span>
                    {card.isRed && <span className="red-indicator" />}
                  </div>
                );
              })
            ) : (
              <p className="empty-played-cards">暂无出牌</p>
            )}
          </div>
        </div>

        <div className="player-section">
          <h4>你的牌堆</h4>
          <div id="self-piles" className="piles">
            {game.piles[pid]?.map((pile, index) => renderPile(pile, index, true))}
          </div>
        </div>
      </div>

      <div id="actions" className="actions">
        {game.currentPlayer === pid ? (
          <>
            {selectedCards.length > 0 ? (
              <>
                <button className="confirm-btn" onClick={handlePlayCards}>
                  确定出牌
                </button>
                <button className="cancel-btn" onClick={handleCancelSelection}>
                  取消选择
                </button>
              </>
            ) : (
              <button className="pass-btn" onClick={handlePass}>
                不出牌
              </button>
            )}
          </>
        ) : (
          <p>等待对手出牌...</p>
        )}
      </div>
    </div>
  );
};

export default ThreePileGame;

/**
 * 三堆出牌游戏
 * 规则：每人三堆牌，每堆第一张翻开，按大小出牌，先出完牌者获胜
 */
const AbstractGame = require('./AbstractGame');

class ThreePileGame extends AbstractGame {
    constructor(room, options = {}) {
        super(room, options);
        this.gameName = '三堆出牌';
        this.currentPlayer = 0; // 当前出牌玩家索引
        this.lastCard = null; // 上一张打出的牌
        this.skipped = false; // 上一个玩家是否选择不出牌
        this.passes = 0; // 连续不出牌次数，达到2则清空lastCard
    }

    init() {
        // 创建包含大小王的54张牌
        const deck = this.createFullDeck();
        const shuffledDeck = this.shuffleDeck(deck);
        
        // 将牌分成6堆，每人3堆，每堆9张
        const piles = [[], [], [], [], [], []];
        for (let i = 0; i < shuffledDeck.length; i++) {
            piles[i % 6].push(shuffledDeck[i]);
        }
        
        // 分配玩家牌堆：玩家0得到前3堆，玩家1得到后3堆
        const playerPiles = [
            [piles[0], piles[1], piles[2]],
            [piles[3], piles[4], piles[5]]
        ];
        
        // 将每个牌堆的第一张设为翻开
        playerPiles.forEach(player => {
            player.forEach(pile => {
                if (pile.length > 0) {
                    pile[0].faceUp = true;
                }
            });
        });
        
        // 石头剪刀布决定先手玩家
        const choices = ['rock', 'paper', 'scissors'];
        const player0Choice = choices[Math.floor(Math.random() * 3)];
        const player1Choice = choices[Math.floor(Math.random() * 3)];
        let firstPlayer = 0; // 默认玩家0先手
        
        // 比较石头剪刀布结果
        if (player0Choice === player1Choice) {
            // 平局，随机决定
            firstPlayer = Math.floor(Math.random() * 2);
        } else if (
            (player0Choice === 'rock' && player1Choice === 'scissors') ||
            (player0Choice === 'paper' && player1Choice === 'rock') ||
            (player0Choice === 'scissors' && player1Choice === 'paper')
        ) {
            // 玩家0胜利
            firstPlayer = 0;
        } else {
            // 玩家1胜利
            firstPlayer = 1;
        }
        
        this.currentPlayer = firstPlayer;
        
        this.gameState = {
            piles: playerPiles,
            currentPlayer: this.currentPlayer,
            lastCard: null,
            skipped: false,
            passes: 0,
            winner: null,
            gameStarted: true,
            rockPaperScissors: {
                player0: player0Choice,
                player1: player1Choice,
                winner: firstPlayer
            }
        };
        
        this.updateActivity();
        return this.gameState;
    }

    // 创建包含大小王的完整牌组
    createFullDeck() {
        const standardDeck = this.createStandardDeck();
        // 添加大小王 - 大王为红色，小王为黑色
        standardDeck.push({
            suit: 'Joker',
            rank: '小王',
            value: 14,
            isRed: false
        }, {
            suit: 'Joker', 
            rank: '大王',
            value: 15,
            isRed: true  // 大王为红色
        });
        return standardDeck;
    }

    // 比较两张牌的大小，返回1表示card1大，-1表示card2大，0表示相等
    compareCards(card1, card2) {
        if (card1.value > card2.value) return 1;
        if (card1.value < card2.value) return -1;
        return 0;
    }

    handleAction(playerIndex, action) {
        if (this.isFinished()) {
            throw new Error('游戏已结束');
        }

        const game = this.gameState;
        
        // 检查是否轮到该玩家
        if (playerIndex !== game.currentPlayer) {
            throw new Error('还没轮到你的回合');
        }

        switch (action.type) {
            case 'play':
                return this.handlePlayAction(playerIndex, action);
            case 'pass':
                return this.handlePassAction(playerIndex);
            default:
                throw new Error('未知操作类型');
        }
    }

    handlePlayAction(playerIndex, action) {
        const game = this.gameState;
        const { pileIndex, cardIndex } = action;
        
        // 验证操作合法性
        if (pileIndex < 0 || pileIndex > 2) {
            throw new Error('无效的牌堆索引');
        }
        
        const pile = game.piles[playerIndex][pileIndex];
        if (cardIndex >= pile.length) {
            throw new Error('无效的卡牌索引');
        }
        
        const card = pile[cardIndex];
        
        // 检查是否翻开（只有牌堆最上面的牌可以出）
        if (!card.faceUp) {
            throw new Error('只能出翻开的牌');
        }
        
        // 检查牌是否比上一张大（如果有上一张牌且不是pass后的情况）
        if (game.lastCard && !game.skipped) {
            if (this.compareCards(card, game.lastCard) <= 0) {
                throw new Error('只能出比上一张大的牌');
            }
        }
        
        // 出牌：从牌堆中移除
        pile.splice(cardIndex, 1);
        
        // 如果牌堆还有牌，将新的第一张翻开
        if (pile.length > 0) {
            pile[0].faceUp = true;
        }
        
        // 更新游戏状态
        game.lastCard = card;
        game.currentPlayer = 1 - playerIndex; // 切换玩家
        game.skipped = false;
        game.passes = 0;
        
        // 检查是否获胜
        if (this.checkWin(playerIndex)) {
            game.winner = playerIndex;
            this.updateLeaderboard();
        }
        
        this.updateActivity();
        return game;
    }

    handlePassAction(playerIndex) {
        const game = this.gameState;
        
        // 玩家选择不出牌
        game.passes++;
        game.skipped = true;
        
        // 如果连续两次不出牌，清空上一张牌
        if (game.passes >= 2) {
            game.lastCard = null;
            game.passes = 0;
        }
        
        // 切换回上一个玩家出牌
        game.currentPlayer = 1 - playerIndex;
        
        this.updateActivity();
        return game;
    }

    // 检查玩家是否获胜（所有牌堆都为空）
    checkWin(playerIndex) {
        const game = this.gameState;
        const playerPiles = game.piles[playerIndex];
        return playerPiles.every(pile => pile.length === 0);
    }

    isFinished() {
        const game = this.gameState;
        return game.winner !== null;
    }

    getWinners() {
        const game = this.gameState;
        if (game.winner === null) return [];
        return [game.winner];
    }

    updateLeaderboard() {
        const winners = this.getWinners();
        
        this.players.forEach((player, index) => {
            let entry = this.leaderboard.find(p => p.id === player.id);
            if (!entry) {
                entry = {
                    id: player.id,
                    name: player.name,
                    wins: 0,
                    totalGames: 0,
                    totalCards: 0
                };
                this.leaderboard.push(entry);
            }
            entry.totalGames += 1;
            if (winners.includes(index)) entry.wins += 1;
            // 计算玩家剩余的牌数
            const remainingCards = this.gameState.piles[index].reduce((sum, pile) => sum + pile.length, 0);
            entry.totalCards += remainingCards;
        });

        this.leaderboard.sort((a, b) => b.wins - a.wins);
    }

    restart() {
        this.gameState = null;
        return this.init();
    }

    getGameName() {
        return this.gameName;
    }

    getClientState() {
        const state = this.getState();
        if (!state) return null;
        
        // 为客户端准备数据，隐藏对手未翻开的牌
        const clientState = {
            ...state,
            piles: state.piles.map((playerPiles, playerIndex) => {
                // 如果是当前玩家自己，显示所有牌的状态
                // 如果是对手，只显示翻开的牌，未翻开的牌用背面代替
                return playerPiles.map(pile => {
                    return pile.map(card => {
                        // 如果是当前玩家的牌或者是翻开的牌，显示完整信息
                        if (card.faceUp) {
                            return card;
                        } else {
                            // 未翻开的牌，只返回背面信息
                            return { faceUp: false, isRed: false };
                        }
                    });
                });
            }),
            gameName: this.gameName,
            isFinished: this.isFinished(),
            winners: this.isFinished() ? this.getWinners() : []
        };
        
        return clientState;
    }
}

module.exports = ThreePileGame;

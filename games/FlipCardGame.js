/**
 * 翻牌对战游戏
 * 继承自AbstractGame
 */
const AbstractGame = require('./AbstractGame');

class FlipCardGame extends AbstractGame {
    constructor(room, options = {}) {
        super(room, options);
        this.gameName = '翻牌对战';
        this.roundInfo = {
            1: { label: '第一回合(猜颜色)', type: 'color' },
            2: { label: '第二回合(猜大小)', type: 'size' },
            3: { label: '第三回合(猜区间)', type: 'range' },
            4: { label: '第四回合(猜花色)', type: 'suit' },
            5: { label: '第五回合(比大小)', type: 'compare' }
        };
    }

    init() {
        // 创建并洗牌，固定一个不重复的牌组
        const fullDeck = this.createStandardDeck();
        const shuffledDeck = this.shuffleDeck(fullDeck);
        
        // 为每位玩家发5张牌，剩余牌组用于补充
        const { cards: player1Hand, remainingDeck: deck1 } = this.dealCards(shuffledDeck, 5);
        const { cards: player2Hand, remainingDeck: remainingDeck } = this.dealCards(deck1, 5);
        
        this.gameState = {
            deck: remainingDeck, // 剩余牌组，用于补充
            hands: [
                player1Hand.map(card => ({ ...card, faceUp: false })),
                player2Hand.map(card => ({ ...card, faceUp: false }))
            ],
            penalty: [[], []], // 两位玩家的惩罚牌
            step: 1, // 当前回合
            finished: [false, false], // 玩家是否完成当前回合
            roundHistory: [], // 回合历史记录
            gameStarted: true
        };
        
        this.updateActivity();
        return this.gameState;
    }

    handleAction(playerIndex, action) {
        if (this.isFinished()) {
            throw new Error('游戏已结束');
        }

        const game = this.gameState;
        if (game.finished[playerIndex]) return game;

        // 第5回合：只翻牌
        if (game.step === 5) {
            const card = game.hands[playerIndex][4];
            card.faceUp = true;
            game.finished[playerIndex] = true;

            if (game.finished[0] && game.finished[1]) {
                // 双方都翻牌后比较
                const c0 = game.hands[0][4];
                const c1 = game.hands[1][4];
                if (c0.value > c1.value) {
                    game.penalty[1].push(c1);
                    this.players[1].penaltyCount = (this.players[1].penaltyCount || 0) + 1;
                } else if (c1.value > c0.value) {
                    game.penalty[0].push(c0);
                    this.players[0].penaltyCount = (this.players[0].penaltyCount || 0) + 1;
                }
                // 游戏结束，更新排行榜
                this.updateLeaderboard();
            }
            this.updateActivity();
            return game;
        }

        // 1-4回合：猜测
        const hand = game.hands[playerIndex];
        const idx = game.step - 1;
        const card = hand[idx];
        let correct = false;

        switch (game.step) {
            case 1: // 猜颜色
                correct = (action.answer === 'red') === card.isRed;
                break;
            case 2: // 猜大小
                const firstCardValue = hand[0].value;
                if (action.answer === 'bigger') {
                    correct = card.value > firstCardValue;
                } else if (action.answer === 'smaller') {
                    correct = card.value < firstCardValue;
                }
                break;
            case 3: // 猜区间
                const min = Math.min(hand[0].value, hand[1].value);
                const max = Math.max(hand[0].value, hand[1].value);
                const between = card.value > min && card.value < max;
                correct = action.answer === (between ? 'between' : 'not');
                break;
            case 4: // 猜花色
                correct = action.answer === card.suit;
                break;
        }

        card.faceUp = true;

        if (!correct) {
            // 猜错：牌进入惩罚堆，并从剩余牌组中补充新牌
            game.penalty[playerIndex].push(card);
            this.players[playerIndex].penaltyCount = (this.players[playerIndex].penaltyCount || 0) + 1;
            hand.splice(idx, 1); // 移除错误的牌

            // 从剩余牌组中补充新牌
            if (game.deck.length > 0) {
                const newCard = { ...game.deck.shift(), faceUp: false };
                hand.splice(idx, 0, newCard);
            }
        } else {
            game.finished[playerIndex] = true;
        }

        // 双方都猜对则进入下一回合
        if (game.finished[0] && game.finished[1]) {
            game.step++;
            game.finished = [false, false];
            game.roundHistory.push({
                step: game.step - 1,
                player1Correct: true,
                player2Correct: true
            });
        }

        this.updateActivity();
        return game;
    }

    isFinished() {
        if (!this.gameState) return false;
        const game = this.gameState;
        // 游戏结束条件：第5回合双方都翻牌完毕
        return game.step === 5 && game.finished[0] && game.finished[1];
    }

    getWinners() {
        if (!this.isFinished()) return [];
        const game = this.gameState;
        const penalty0 = game.penalty[0].length;
        const penalty1 = game.penalty[1].length;
        
        if (penalty0 < penalty1) return [0]; // 玩家0胜利
        if (penalty1 < penalty0) return [1]; // 玩家1胜利
        return [0, 1]; // 平局
    }

    updateLeaderboard() {
        const winners = this.getWinners();
        
        // 更新玩家数据
        this.players.forEach((player, index) => {
            let entry = this.leaderboard.find(p => p.id === player.id);
            if (!entry) {
                entry = {
                    id: player.id,
                    name: player.name,
                    wins: 0,
                    totalGames: 0,
                    totalPenalty: 0
                };
                this.leaderboard.push(entry);
            }
            entry.totalGames += 1;
            if (winners.includes(index)) entry.wins += 1;
            entry.totalPenalty += player.penaltyCount || 0;
        });

        // 按胜利次数排序
        this.leaderboard.sort((a, b) => b.wins - a.wins);
    }

    restart() {
        this.gameState = null;
        // 重置玩家当前对局的惩罚牌数量
        this.players.forEach(p => p.penaltyCount = 0);
        return this.init();
    }

    getGameName() {
        return this.gameName;
    }

    /**
     * 获取当前回合信息
     * @returns {Object}
     */
    getCurrentRoundInfo() {
        if (!this.gameState) return null;
        return this.roundInfo[this.gameState.step] || { label: '未知回合', type: 'unknown' };
    }

    /**
     * 获取游戏状态用于客户端显示
     * @returns {Object}
     */
    getClientState() {
        const state = this.getState();
        if (!state) return null;
        
        return {
            ...state,
            currentRound: this.getCurrentRoundInfo(),
            gameName: this.gameName,
            isFinished: this.isFinished(),
            winners: this.isFinished() ? this.getWinners() : []
        };
    }
}

module.exports = FlipCardGame;

/**
 * 抽象游戏类
 * 所有扑克牌游戏都应该继承此类
 */
class AbstractGame {
    constructor(room, options = {}) {
        this.room = room;
        this.options = options;
        this.players = room.players;
        this.gameState = null;
        this.leaderboard = room.leaderboard || [];
        this.lastActivity = Date.now();
    }

    /**
     * 初始化游戏
     * @returns {Object} 初始游戏状态
     */
    init() {
        throw new Error('init() must be implemented by subclass');
    }

    /**
     * 处理玩家操作
     * @param {number} playerIndex 玩家索引
     * @param {Object} action 玩家操作
     * @returns {Object} 更新后的游戏状态
     */
    handleAction(playerIndex, action) {
        throw new Error('handleAction() must be implemented by subclass');
    }

    /**
     * 获取游戏状态
     * @returns {Object} 当前游戏状态
     */
    getState() {
        return this.gameState;
    }

    /**
     * 检查游戏是否结束
     * @returns {boolean}
     */
    isFinished() {
        throw new Error('isFinished() must be implemented by subclass');
    }

    /**
     * 获取胜利者
     * @returns {Array} 胜利者索引数组
     */
    getWinners() {
        throw new Error('getWinners() must be implemented by subclass');
    }

    /**
     * 更新排行榜
     */
    updateLeaderboard() {
        throw new Error('updateLeaderboard() must be implemented by subclass');
    }

    /**
     * 重新开始游戏
     * @returns {Object} 新的游戏状态
     */
    restart() {
        throw new Error('restart() must be implemented by subclass');
    }

    /**
     * 获取游戏类型名称
     * @returns {string}
     */
    getGameName() {
        throw new Error('getGameName() must be implemented by subclass');
    }

    /**
     * 更新活动时间
     */
    updateActivity() {
        this.lastActivity = Date.now();
    }

    /**
     * 创建一副标准扑克牌
     * @returns {Array} 扑克牌数组
     */
    createStandardDeck() {
        const suits = ['♠', '♥', '♣', '♦'];
        const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
        
        suits.forEach(suit => {
            ranks.forEach(rank => {
                deck.push({
                    suit,
                    rank,
                    value: this.getCardValue(rank),
                    isRed: suit === '♥' || suit === '♦'
                });
            });
        });
        
        return deck;
    }

    /**
     * 获取卡牌数值
     * @param {string} rank 牌面
     * @returns {number}
     */
    getCardValue(rank) {
        const values = {
            'A': 1,
            '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
            'J': 11, 'Q': 12, 'K': 13
        };
        return values[rank] || 0;
    }

    /**
     * 洗牌
     * @param {Array} deck 牌组
     * @returns {Array} 洗牌后的牌组
     */
    shuffleDeck(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * 从牌组中发牌
     * @param {Array} deck 牌组
     * @param {number} count 发牌数量
     * @returns {Object} { cards: 发出的牌, remainingDeck: 剩余牌组 }
     */
    dealCards(deck, count) {
        const cards = deck.slice(0, count);
        const remainingDeck = deck.slice(count);
        return { cards, remainingDeck };
    }
}

module.exports = AbstractGame;

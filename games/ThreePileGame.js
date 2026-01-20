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
        
        // 初始化游戏状态，等待石头剪刀布选择
        this.gameState = {
            piles: playerPiles,
            currentPlayer: 0, // 默认玩家0开始选择石头剪刀布
            lastCard: null,
            skipped: false,
            passes: 0,
            winner: null,
            gameStarted: false, // 游戏未开始，等待石头剪刀布
            rockPaperScissors: {
                player0: null, // 等待玩家选择
                player1: null, // 等待玩家选择
                winner: null   // 结果未定
            },
            stage: 'rock_paper_scissors' // 游戏阶段：石头剪刀布阶段
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

    // 判断出牌类型并验证
    validateAndGetPlayType(cards) {
        if (!cards || cards.length === 0) {
            throw new Error('请选择要出的牌');
        }

        const count = cards.length;
        
        // 单张牌
        if (count === 1) {
            return 'single';
        }
        
        // 对子
        if (count === 2) {
            if (cards[0].value === cards[1].value) {
                return 'pair';
            } else {
                throw new Error('对子必须由两张相同点数的牌组成');
            }
        }
        
        // 三连 & 顺子（至少3张，最多5张，连续数字，大小王不能参与）
        if (count === 3) {
            if (cards[0].value === cards[1].value && cards[1].value === cards[2].value) {
                return 'triple';
            } else {
                // 检查是否包含大小王
                if (cards.some(card => card.suit === 'Joker')) {
                    throw new Error('顺子不能包含大小王');
                }

                // 复制并排序
                const sortedCards = [...cards].sort((a, b) => a.value - b.value);

                // 检查是否连续
                for (let i = 1; i < sortedCards.length; i++) {
                    if (sortedCards[i].value !== sortedCards[i-1].value + 1) {
                        throw new Error('顺子必须由连续点数的牌组成');
                    }
                }
                return 'straight';
            }
        }

        throw new Error(`不支持出${count}张牌`);
    }

    // 比较两次出牌的大小
    comparePlays(prevPlay, currentPlay) {
        // 如果上一轮没有出牌或者上一轮是pass，则可以直接出
        if (!prevPlay || prevPlay.type === 'pass') {
            return true;
        }
        
        // 类型必须相同
        if (prevPlay.type !== currentPlay.type) {
            throw new Error(`必须出相同类型的牌：${prevPlay.type}`);
        }
        
        // 张数必须相同（对于顺子，张数必须相同）
        if (prevPlay.cards.length !== currentPlay.cards.length) {
            throw new Error(`必须出相同张数的牌：${prevPlay.cards.length}张`);
        }
        
        // 比较最大牌
        const getMaxCard = (cards) => {
            return cards.reduce((max, card) => card.value > max.value ? card : max, cards[0]);
        };
        
        const prevMax = getMaxCard(prevPlay.cards);
        const currentMax = getMaxCard(currentPlay.cards);
        
        if (currentMax.value <= prevMax.value) {
            throw new Error(`必须出比上一轮更大的牌`);
        }
        
        return true;
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

        // 根据游戏阶段处理不同操作
        if (game.stage === 'rock_paper_scissors') {
            // 石头剪刀布阶段
            switch (action.type) {
                case 'rock_paper_scissors':
                    return this.handleRockPaperScissorsAction(playerIndex, action);
                default:
                    throw new Error('石头剪刀布阶段只能选择石头、剪刀、布');
            }
        } else {
            // 正常游戏阶段
            switch (action.type) {
                case 'play':
                    return this.handlePlayAction(playerIndex, action);
                case 'pass':
                    return this.handlePassAction(playerIndex);
                default:
                    throw new Error('未知操作类型');
            }
        }
    }

    handlePlayAction(playerIndex, action) {
        const game = this.gameState;
        const { cards } = action; // cards: [{pileIndex, cardIndex}, ...]
        
        if (!cards || !Array.isArray(cards) || cards.length === 0) {
            throw new Error('请选择要出的牌');
        }
        
        // 检查每张牌是否都在牌堆中且是翻开的
        const selectedCards = [];
        for (const cardInfo of cards) {
            const pileIndex = cardInfo.pileIndex;
            const cardIndex = cardInfo.cardIndex;
            
            // 检查牌堆索引
            if (pileIndex < 0 || pileIndex > 2) {
                throw new Error('无效的牌堆索引');
            }
            
            const pile = game.piles[playerIndex][pileIndex];
            if (cardIndex >= pile.length) {
                throw new Error('无效的卡牌索引');
            }
            const card = pile[cardIndex];
            if (!card.faceUp) {
                throw new Error('只能出翻开的牌');
            }
            selectedCards.push(card);
        }
        
        // 判断出牌类型
        const playType = this.validateAndGetPlayType(selectedCards);
        
        // 与上一轮出牌比较
        if (game.lastPlay && !game.skipped) {
            this.comparePlays(game.lastPlay, {
                type: playType,
                cards: selectedCards
            });
        }
        
        // 出牌：从牌堆中移除（按牌堆分组，从后往前移除）
        // 先按牌堆分组
        const cardsByPile = {};
        cards.forEach(cardInfo => {
            const pileIndex = cardInfo.pileIndex;
            if (!cardsByPile[pileIndex]) {
                cardsByPile[pileIndex] = [];
            }
            cardsByPile[pileIndex].push(cardInfo.cardIndex);
        });
        
        // 对每个牌堆进行移除
        for (const pileIndex in cardsByPile) {
            const pile = game.piles[playerIndex][pileIndex];
            const indices = cardsByPile[pileIndex].sort((a, b) => b - a); // 从大到小排序
            indices.forEach(index => {
                pile.splice(index, 1);
            });
            
            // 如果牌堆还有牌，将新的第一张翻开
            if (pile.length > 0) {
                pile[0].faceUp = true;
            }
        }
        
        // 更新游戏状态
        game.lastPlay = {
            type: playType,
            cards: selectedCards
        };
        
        // 检查是否获胜
        if (this.checkWin(playerIndex)) {
            game.winner = playerIndex;
            this.updateLeaderboard();
            // 游戏结束，不切换玩家
        } else {
            game.currentPlayer = 1 - playerIndex; // 切换玩家
        }
        
        game.skipped = false;
        game.passes = 0;
        
        this.updateActivity();
        return game;
    }

    handlePassAction(playerIndex) {
        const game = this.gameState;
        
        // 玩家选择不出牌
        game.passes++;
        game.skipped = true;
        
        // 如果连续两次不出牌，清空上一轮出牌记录
        if (game.passes >= 2) {
            game.lastPlay = null;
            game.passes = 0;
        }
        
        // 记录pass出牌类型
        game.lastPlay = { type: 'pass' };
        
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

    // 处理石头剪刀布选择
    handleRockPaperScissorsAction(playerIndex, action) {
        const game = this.gameState;
        const { choice } = action; // choice: 'rock', 'paper', 'scissors'
        
        if (!['rock', 'paper', 'scissors'].includes(choice)) {
            throw new Error('无效的选择，只能选择石头、剪刀、布');
        }
        
        // 记录玩家选择
        game.rockPaperScissors[`player${playerIndex}`] = choice;
        
        // 检查是否两个玩家都做出了选择
        const player0Choice = game.rockPaperScissors.player0;
        const player1Choice = game.rockPaperScissors.player1;
        
        if (player0Choice !== null && player1Choice !== null) {
            // 两个玩家都选择了，比较结果
            let winner = 0; // 默认玩家0胜利
            
            if (player0Choice === player1Choice) {
                // 平局，随机决定先手
                winner = Math.floor(Math.random() * 2);
            } else if (
                (player0Choice === 'rock' && player1Choice === 'scissors') ||
                (player0Choice === 'paper' && player1Choice === 'rock') ||
                (player0Choice === 'scissors' && player1Choice === 'paper')
            ) {
                // 玩家0胜利
                winner = 0;
            } else {
                // 玩家1胜利
                winner = 1;
            }
            
            // 设置先手玩家和游戏阶段
            game.rockPaperScissors.winner = winner;
            game.currentPlayer = winner; // 胜利者先出牌
            game.stage = 'playing'; // 切换到游戏阶段
            game.gameStarted = true;
            
            // 设置回合提示
            game.roundMessage = `${winner === 0 ? '玩家1' : '玩家2'} 在石头剪刀布中获胜，获得先手！`;
        } else {
            // 切换当前玩家，让另一位玩家选择
            game.currentPlayer = 1 - playerIndex;
        }
        
        this.updateActivity();
        return game;
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

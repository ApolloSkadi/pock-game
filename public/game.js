// 翻牌对战游戏 - 房间联机版
// 动态构建WebSocket URL
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host;
const ws = new WebSocket(`${protocol}//${wsHost}`);

// 游戏状态变量
let currentRoomCode = null;
let pid = null;
let game = null;
let playerId = null;
let playerName = null;
let isHost = false;
let leaderboardData = [];
let roomPlayers = [];
let gameName = '翻牌对战';
let roomGameType = 'flip_card'; // 房间的游戏类型

// DOM 元素
const roomSelection = document.getElementById('room-selection');
const gameInterface = document.getElementById('game-interface');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const refreshRoomBtn = document.getElementById('refresh-room-btn');
const playerNameCreateInput = document.getElementById('player-name-create');
const playerNameJoinInput = document.getElementById('player-name-join');
const roomCodeInput = document.getElementById('room-code');
const gameTypeSelect = document.getElementById('game-type');
const roomCodeValue = document.getElementById('room-code-value');
const playerInfoDisplay = document.getElementById('player-info');
const roomStatusDisplay = document.getElementById('room-status');
const playerList = document.getElementById('player-list');
const roundDisplay = document.getElementById('round');
const selfHand = document.getElementById('self');
const oppHand = document.getElementById('opponent');
const selfPenalty = document.getElementById('penalty-self');
const oppPenalty = document.getElementById('penalty-op');
const actions = document.getElementById('actions');
const leaderboardContainer = document.getElementById('leaderboard-container');
// 新增的DOM元素
const flipCardInterface = document.getElementById('flip-card-interface');
const threePileInterface = document.getElementById('three-pile-interface');
const selfPiles = document.getElementById('self-piles');
const opponentPiles = document.getElementById('opponent-piles');
const playedCardsArea = document.getElementById('played-cards');

// WebSocket 消息处理
ws.onmessage = (e) => {
    try {
        const data = JSON.parse(e.data);
        console.log('收到消息:', data.type, data);

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
    } catch (err) {
        console.error('消息解析错误:', err);
    }
};

ws.onopen = () => {
    console.log('WebSocket 连接已建立');
};

ws.onclose = () => {
    console.log('WebSocket 连接已关闭');
    alert('与服务器的连接已断开，请刷新页面重新连接');
};

ws.onerror = (error) => {
    console.error('WebSocket 错误:', error);
    alert('连接服务器时发生错误，请检查网络连接');
};

// 事件监听器
createRoomBtn.addEventListener('click', createRoom);
joinRoomBtn.addEventListener('click', joinRoom);
leaveRoomBtn.addEventListener('click', leaveRoom);
refreshRoomBtn.addEventListener('click', refreshRoom);

// 房间码输入框只允许数字
roomCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
});

// 房间码输入框按回车触发加入
roomCodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoom();
    }
});

// 创建房间
function createRoom() {
    const name = playerNameCreateInput.value.trim();
    if (!name) {
        alert('请输入昵称');
        return;
    }
    
    playerName = name;
    const gameType = gameTypeSelect ? gameTypeSelect.value : 'flip_card';
    ws.send(JSON.stringify({ type: 'create_room', playerName: name, gameType }));
}

// 加入房间
function joinRoom() {
    const name = playerNameJoinInput.value.trim();
    const code = roomCodeInput.value.trim();
    
    if (!name) {
        alert('请输入昵称');
        return;
    }
    
    if (!code || code.length !== 4) {
        alert('请输入4位数字房间码');
        return;
    }
    
    playerName = name;
    ws.send(JSON.stringify({ 
        type: 'join_room', 
        roomCode: code,
        playerName: name
    }));
}

// 离开房间
function leaveRoom() {
    if (confirm('确定要离开房间吗？')) {
        ws.send(JSON.stringify({ type: 'leave_room' }));
        showRoomSelection();
        resetGameState();
    }
}

// 刷新房间状态
function refreshRoom() {
    if (!currentRoomCode) {
        alert('未加入任何房间');
        return;
    }
    
    ws.send(JSON.stringify({ type: 'get_room_status' }));
    roomStatusDisplay.textContent = '正在刷新房间状态...';
}

// 处理房间创建成功
function handleRoomCreated(data) {
    currentRoomCode = data.roomCode;
    playerId = data.playerId;
    playerName = data.playerName;
    pid = data.pid; // 设置玩家索引
    isHost = data.isHost;
    roomGameType = data.gameType || 'flip_card'; // 保存房间游戏类型
    
    roomCodeValue.textContent = currentRoomCode;
    playerInfoDisplay.textContent = `房主: ${playerName}`;
    roomStatusDisplay.textContent = data.message;
    
    showGameInterface();
    updatePlayerList([{ name: playerName, isHost: true, id: playerId }]);
}

// 处理加入房间成功
function handleRoomJoined(data) {
    currentRoomCode = data.roomCode;
    playerId = data.playerId;
    playerName = data.playerName;
    pid = data.pid;
    isHost = data.isHost;
    roomGameType = data.gameType || 'flip_card'; // 保存房间游戏类型
    
    roomCodeValue.textContent = currentRoomCode;
    playerInfoDisplay.textContent = `${playerName} ${isHost ? '(房主)' : ''}`;
    
    if (data.playerCount === 2) {
        roomStatusDisplay.textContent = `房间已满 (2/2)，等待房主开始游戏...`;
    } else {
        roomStatusDisplay.textContent = `已加入房间，等待其他玩家加入... (${data.playerCount}/2)`;
    }
    
    showGameInterface();
    // 如果是房主且房间满2人，显示开始游戏按钮
    if (isHost && data.playerCount === 2) {
        showStartGameButton();
    }
}

// 处理玩家加入
function handlePlayerJoined(data) {
    roomStatusDisplay.textContent = `${data.playerName} 加入了房间 (${data.playerCount}/2)`;
    // 更新玩家列表
    ws.send(JSON.stringify({ type: 'get_room_status' }));
    
    // 如果是房主且房间满2人，显示开始游戏按钮
    if (isHost && data.playerCount === 2) {
        showStartGameButton();
    }
}

// 处理玩家离开
function handlePlayerLeft(data) {
    roomStatusDisplay.textContent = `${data.playerName} 离开了房间 (${data.playerCount}/2)`;
    // 更新玩家列表
    ws.send(JSON.stringify({ type: 'get_room_status' }));
    
    // 隐藏开始游戏按钮，因为人数不足
    hideStartGameButton();
}

// 处理游戏开始
function handleGameStart(data) {
    game = data.game;
    gameName = data.gameName || '翻牌对战';
    roomStatusDisplay.textContent = `${gameName} 开始！`;
    
    // 更新游戏界面标题
    const gameTitle = document.querySelector('#game-interface h1');
    if (gameTitle) {
        gameTitle.textContent = gameName;
    }
    
    render();
}

// 处理游戏更新
function handleGameUpdate(data) {
    game = data.game;
    render();
}

// 处理游戏结束
function handleGameEnd(data) {
    game = data.game;
    render();
    endAnim(data.leaderboard, data.winners);
}

// 处理房间超时
function handleRoomTimeout(data) {
    alert(data.message);
    showRoomSelection();
    resetGameState();
}

// 处理房间状态更新
function handleRoomStatus(data) {
    // 更新房间信息
    roomStatusDisplay.textContent = `房间状态: ${data.playerCount}/2 位玩家`;
    
    // 更新玩家列表
    updatePlayerList(data.players);
    
    // 检查是否应该显示开始游戏按钮
    if (isHost && data.playerCount === 2 && !data.gameStarted) {
        showStartGameButton();
    } else {
        hideStartGameButton();
    }
    
    // 如果游戏已开始，但本地状态没有游戏，可能是重新连接
    if (data.gameStarted && !game) {
        roomStatusDisplay.textContent = `${data.gameName} 进行中，请等待同步...`;
    }
}

// 更新玩家列表
function updatePlayerList(players) {
    roomPlayers = players;
    playerList.innerHTML = '';
    
    if (players.length === 0) {
        playerList.innerHTML = '<li>等待玩家加入...</li>';
        return;
    }
    
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = `${player.name} ${player.isHost ? '👑' : ''}`;
        playerList.appendChild(li);
    });
}

// 显示房间选择界面
function showRoomSelection() {
    roomSelection.style.display = 'block';
    gameInterface.style.display = 'none';
    currentRoomCode = null;
    resetGameState();
}

// 显示游戏界面
function showGameInterface() {
    roomSelection.style.display = 'none';
    gameInterface.style.display = 'block';
}

// 重置游戏状态
function resetGameState() {
    pid = null;
    game = null;
    playerId = null;
    isHost = false;
    leaderboardData = [];
    roomPlayers = [];
    gameName = '翻牌对战';
    
    roundDisplay.textContent = '第 1 张牌';
    selfHand.innerHTML = '';
    oppHand.innerHTML = '';
    selfPenalty.innerHTML = '';
    oppPenalty.innerHTML = '';
    actions.innerHTML = '';
    leaderboardContainer.innerHTML = '<h3>排行榜</h3><p>等待数据...</p>';
}

// 渲染游戏界面
function render() {
    if (!game) return;
    
    // 根据游戏类型显示/隐藏不同的界面
    if (game.gameName === '三堆出牌') {
        flipCardInterface.style.display = 'none';
        threePileInterface.style.display = 'block';
        renderThreePile();
    } else {
        flipCardInterface.style.display = 'block';
        threePileInterface.style.display = 'none';
        renderFlipCard();
    }
    
    // 更新游戏规则说明
    updateGameRules();
}

// 渲染翻牌对战游戏
function renderFlipCard() {
    // 更新回合显示
    if (game.currentRound && game.currentRound.label) {
        roundDisplay.textContent = game.currentRound.label;
    } else {
        roundDisplay.textContent = `第 ${game.step} 张牌`;
    }
    
    // 绘制手牌和惩罚牌
    draw(selfHand, game.hands[pid]);
    draw(oppHand, game.hands[1 - pid]);
    draw(selfPenalty, game.penalty[pid], true);
    draw(oppPenalty, game.penalty[1 - pid], true);
    
    // 渲染操作按钮
    renderFlipCardActions();
}

// 渲染三堆出牌游戏
function renderThreePile() {
    roundDisplay.textContent = `${game.gameName} - ${game.currentPlayer === pid ? '你的回合' : '对手回合'}`;
    
    // 清空现有显示区域
    selfPiles.innerHTML = '';
    opponentPiles.innerHTML = '';
    playedCardsArea.innerHTML = '';
    
    // 显示玩家自己的三堆牌（折叠布局）
    if (game.piles && game.piles[pid]) {
        const myPiles = game.piles[pid];
        myPiles.forEach((pile, pileIndex) => {
            const pileContainer = document.createElement('div');
            pileContainer.className = 'pile-container';
            pileContainer.innerHTML = `<div class="pile-label">牌堆 ${pileIndex + 1}</div>`;
            
            const pileDiv = document.createElement('div');
            pileDiv.className = 'pile';
            
            pile.forEach((card, cardIndex) => {
                const cardDiv = document.createElement('div');
                cardDiv.className = 'card ' + (card.faceUp ? 'front' : 'back');
                if (card.faceUp) {
                    cardDiv.innerText = card.rank + (card.suit || '');
                    if (card.isRed) cardDiv.classList.add('red');
                }
                cardDiv.dataset.pileIndex = pileIndex;
                cardDiv.dataset.cardIndex = cardIndex;
                pileDiv.appendChild(cardDiv);
            });
            
            pileContainer.appendChild(pileDiv);
            selfPiles.appendChild(pileContainer);
        });
    }
    
    // 显示对手的三堆牌（折叠布局，只显示最上面的翻开的牌）
    if (game.piles && game.piles[1 - pid]) {
        const oppPiles = game.piles[1 - pid];
        oppPiles.forEach((pile, pileIndex) => {
            const pileContainer = document.createElement('div');
            pileContainer.className = 'pile-container';
            pileContainer.innerHTML = `<div class="pile-label">对手牌堆 ${pileIndex + 1}</div>`;
            
            const pileDiv = document.createElement('div');
            pileDiv.className = 'pile';
            
            // 对手的牌：只显示第一张翻开的牌，其余显示背面
            pile.forEach((card, cardIndex) => {
                const cardDiv = document.createElement('div');
                // 如果是对手且不是第一张牌，或者牌没翻开，显示背面
                if (cardIndex > 0 || !card.faceUp) {
                    cardDiv.className = 'card back';
                } else {
                    cardDiv.className = 'card front';
                    cardDiv.innerText = card.rank + (card.suit || '');
                    if (card.isRed) cardDiv.classList.add('red');
                }
                pileDiv.appendChild(cardDiv);
            });
            
            pileContainer.appendChild(pileDiv);
            opponentPiles.appendChild(pileContainer);
        });
    }
    
    // 渲染出牌区
    if (game.lastCard) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card front';
        cardDiv.innerText = game.lastCard.rank + (game.lastCard.suit || '');
        if (game.lastCard.isRed) cardDiv.classList.add('red');
        playedCardsArea.appendChild(cardDiv);
    } else {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-played-cards';
        emptyMsg.textContent = '暂无出牌';
        playedCardsArea.appendChild(emptyMsg);
    }
    
    // 渲染操作按钮
    renderThreePileActions();
}

// 渲染翻牌对战操作按钮
function renderFlipCardActions() {
    actions.innerHTML = '';
    if (!game || game.finished[pid]) return;

    const btn = (text, value, className) => {
        const button = document.createElement('button');
        button.innerText = text;
        button.className = className;
        button.onclick = () => {
            ws.send(JSON.stringify({
                type: 'game_action',
                action: { answer: value }
            }));
        };
        actions.appendChild(button);
    };

    switch (game.step) {
        case 1:
            btn('红色', 'red', 'left');
            btn('黑色', 'black', 'right');
            break;
        case 2:
            btn('更大', 'bigger', 'left');
            btn('更小', 'smaller', 'right');
            break;
        case 3:
            btn('在之间', 'between', 'left');
            btn('不在之间', 'not', 'right');
            break;
        case 4:
            ['♠', '♥', '♣', '♦'].forEach(suit => {
                btn(suit, suit, 'left');
            });
            break;
        case 5:
            btn('翻牌', 'flip', 'left');
            break;
    }
}

// 渲染三堆出牌操作按钮
function renderThreePileActions() {
    actions.innerHTML = '';
    
    // 如果不是当前玩家的回合，不显示操作按钮
    if (game.currentPlayer !== pid) {
        actions.innerHTML = '<p>等待对手出牌...</p>';
        return;
    }
    
    // 显示"不出牌"按钮
    const passBtn = document.createElement('button');
    passBtn.innerText = '不出牌';
    passBtn.className = 'pass-btn';
    passBtn.onclick = () => {
        ws.send(JSON.stringify({
            type: 'game_action',
            action: { type: 'pass' }
        }));
    };
    actions.appendChild(passBtn);
    
    // 为玩家自己的牌添加点击事件
    const myCards = selfPiles.querySelectorAll('.card');
    myCards.forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
            const pileIndex = parseInt(card.dataset.pileIndex);
            const cardIndex = parseInt(card.dataset.cardIndex);
            
            // 检查是否可以出这张牌（必须是翻开的牌）
            const cardData = game.piles[pid][pileIndex][cardIndex];
            if (!cardData.faceUp) {
                alert('只能出翻开的牌！');
                return;
            }
            
            // 如果有上一张牌且不是跳过状态，检查牌是否比上一张大
            if (game.lastCard && !game.skipped) {
                // 计算牌的大小（需要服务器端验证，这里先简单提示）
                const cardValue = cardData.value;
                const lastCardValue = game.lastCard.value;
                if (cardValue <= lastCardValue) {
                    alert(`只能出比上一张牌(${game.lastCard.rank}${game.lastCard.suit})大的牌！`);
                    return;
                }
            }
            
            ws.send(JSON.stringify({
                type: 'game_action',
                action: {
                    type: 'play',
                    pileIndex: pileIndex,
                    cardIndex: cardIndex
                }
            }));
        });
    });
}

// 绘制牌
function draw(dom, cards, showAll = false) {
    dom.innerHTML = '';
    cards.forEach(c => {
        const d = document.createElement('div');
        d.className = 'card ' + (c.faceUp || showAll ? 'front' : 'back');
        if (c.faceUp || showAll) {
            // 使用 rank 和 suit 显示
            d.innerText = c.rank + c.suit;
            if (c.isRed) d.classList.add('red');
        }
        dom.appendChild(d);
    });
}

// 游戏结束动画
function endAnim(leaderboard, winners) {
    setTimeout(() => {
        const myPenalty = game.penalty[pid].length;
        const oppPenalty = game.penalty[1 - pid].length;
        let resultMessage;
        
        if (winners && winners.length === 1) {
            if (winners[0] === pid) {
                resultMessage = '🎉 胜利';
            } else {
                resultMessage = '💀 失败';
            }
        } else if (winners && winners.length === 2) {
            resultMessage = '🤝 平局';
        } else {
            // 备用逻辑
            if (myPenalty < oppPenalty) {
                resultMessage = '🎉 胜利';
            } else if (myPenalty > oppPenalty) {
                resultMessage = '💀 失败';
            } else {
                resultMessage = '🤝 平局';
            }
        }
        
        alert(resultMessage);
        
        if (leaderboard) {
            updateLeaderboard(leaderboard);
        }
        
        showRestartButton();
    }, 3000);
}

// 显示重新开始按钮
function showRestartButton() {
    const restartBtn = document.createElement('button');
    restartBtn.innerText = '重新开始游戏';
    restartBtn.className = 'restart-btn';
    restartBtn.onclick = () => {
        ws.send(JSON.stringify({ type: 'restart' }));
        restartBtn.remove();
    };
    actions.appendChild(restartBtn);
}

// 显示开始游戏按钮（仅房主且房间满2人时）
function showStartGameButton() {
    // 先检查是否已经存在开始游戏按钮
    if (document.getElementById('start-game-btn')) return;
    
    const startBtn = document.createElement('button');
    startBtn.id = 'start-game-btn';
    startBtn.innerText = '开始游戏';
    startBtn.className = 'start-btn';
    startBtn.onclick = startGame;
    
    // 将按钮添加到行动区域上方
    const actionsParent = actions.parentNode;
    actionsParent.insertBefore(startBtn, actions);
}

// 隐藏开始游戏按钮
function hideStartGameButton() {
    const startBtn = document.getElementById('start-game-btn');
    if (startBtn) {
        startBtn.remove();
    }
}

// 开始游戏（房主调用）
function startGame() {
    if (!isHost) {
        alert('只有房主可以开始游戏');
        return;
    }
    
    // 使用房间的游戏类型，而不是下拉框的当前值
    const gameType = roomGameType || 'flip_card';
    ws.send(JSON.stringify({ type: 'start_game', gameType }));
    hideStartGameButton();
}

// 更新游戏规则说明
function updateGameRules() {
    const gameRulesList = document.getElementById('game-rules-list');
    if (!gameRulesList) return;
    
    if (game && game.gameName === '三堆出牌') {
        gameRulesList.innerHTML = `
            <li>每人三堆牌，每堆第一张自动翻开</li>
            <li>按牌面大小出牌，必须比上一张牌大</li>
            <li>可以选择不出牌（跳过）</li>
            <li>先出完所有牌的玩家获胜</li>
            <li>大小王可出，大王最大，小王次之</li>
            <li>支持石头剪刀布决定先手</li>
        `;
    } else {
        gameRulesList.innerHTML = `
            <li>每回合猜测自己的一张牌</li>
            <li>猜错则牌进入惩罚堆，并补充新牌</li>
            <li>五回合后比较双方惩罚牌数量，少者胜利</li>
            <li>游戏结束后可点击"重新开始"再次游玩</li>
            <li>胜利次数会计入排行榜</li>
        `;
    }
}

// 更新排行榜
function updateLeaderboard(data) {
    leaderboardData = data;
    if (!leaderboardContainer) return;
    
    leaderboardContainer.innerHTML = '<h3>排行榜</h3>';
    
    if (leaderboardData.length === 0) {
        leaderboardContainer.innerHTML += '<p>暂无数据</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'leaderboard-table';
    table.innerHTML = `
        <tr>
            <th>排名</th>
            <th>玩家</th>
            <th>胜利次数</th>
            <th>总对局</th>
            <th>总惩罚牌数</th>
        </tr>
    `;
    
    leaderboardData.forEach((entry, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${entry.name}</td>
            <td>${entry.wins}</td>
            <td>${entry.totalGames}</td>
            <td>${entry.totalPenalty}</td>
        `;
        table.appendChild(row);
    });
    
    leaderboardContainer.appendChild(table);
}

// 根据游戏类型更新房间选择页面内容
function updateRoomSelectionContent() {
    const gameType = gameTypeSelect ? gameTypeSelect.value : 'flip_card';
    const titleElement = document.getElementById('room-selection-title');
    const subtitleElement = document.getElementById('room-selection-subtitle');
    const instructionsElement = document.getElementById('room-selection-instructions');
    
    if (!titleElement || !subtitleElement || !instructionsElement) return;
    
    if (gameType === 'three_pile') {
        titleElement.textContent = '三堆出牌 - 房间联机版';
        subtitleElement.textContent = '创建或加入房间，体验三堆出牌对战';
        instructionsElement.innerHTML = `
            <li>每局游戏需要2位玩家</li>
            <li>房间码为4位数字，创建房间后分享给好友</li>
            <li>每人三堆牌，每堆第一张翻开</li>
            <li>按大小出牌，先出完所有牌者获胜</li>
            <li>支持大小王，大王为最大牌</li>
            <li>游戏结束后可重复对战，战绩计入排行榜</li>
        `;
    } else {
        titleElement.textContent = '翻牌对战 - 房间联机版';
        subtitleElement.textContent = '创建或加入房间，与好友进行实时对战';
        instructionsElement.innerHTML = `
            <li>每局游戏需要2位玩家</li>
            <li>房间码为4位数字，创建房间后分享给好友</li>
            <li>游戏支持多房间同时进行</li>
            <li>游戏结束后可重复对战，战绩计入排行榜</li>
        `;
    }
}

// 页面加载时初始化
window.addEventListener('load', () => {
    // 设置默认昵称
    const defaultName = `玩家${Math.floor(Math.random() * 1000)}`;
    playerNameCreateInput.value = defaultName;
    playerNameJoinInput.value = defaultName;
    
    // 初始化房间选择页面内容
    updateRoomSelectionContent();
    
    // 监听游戏类型选择变化
    if (gameTypeSelect) {
        gameTypeSelect.addEventListener('change', updateRoomSelectionContent);
    }
    
    // 显示房间选择界面
    showRoomSelection();
});

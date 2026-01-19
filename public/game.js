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

// 回合信息
const roundInfo = {
    1: { label: '第一回合(猜颜色)' },
    2: { label: '第二回合(猜大小)' },
    3: { label: '第三回合(猜区间)' },
    4: { label: '第四回合(猜花色)' },
    5: { label: '第五回合(比大小)' }
};

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
    ws.send(JSON.stringify({ type: 'create_room' }));
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
    roomCodeValue.textContent = currentRoomCode;
    roomStatusDisplay.textContent = data.message;
    playerInfoDisplay.textContent = `房主: ${playerName}`;
    isHost = true;
    
    showGameInterface();
    updatePlayerList([{ name: playerName, isHost: true }]);
}

// 处理加入房间成功
function handleRoomJoined(data) {
    currentRoomCode = data.roomCode;
    playerId = data.playerId;
    pid = data.pid;
    isHost = data.isHost;
    
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
    updatePlayerList([{ name: playerName, isHost }, { name: data.playerName, isHost: false }]);
    
    // 如果是房主且房间满2人，显示开始游戏按钮
    if (isHost && data.playerCount === 2) {
        showStartGameButton();
    }
}

// 处理玩家离开
function handlePlayerLeft(data) {
    roomStatusDisplay.textContent = `${data.playerName} 离开了房间 (${data.playerCount}/2)`;
    if (data.playerCount === 1) {
        updatePlayerList([{ name: playerName, isHost }]);
    } else {
        updatePlayerList([]);
    }
    
    // 隐藏开始游戏按钮，因为人数不足
    hideStartGameButton();
}

// 处理游戏开始
function handleGameStart(data) {
    game = data.game;
    roomStatusDisplay.textContent = '游戏开始！';
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
    endAnim(data.leaderboard);
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
    
    // 如果游戏已开始，但本地状态没有游戏，可能是重新连接，需要请求游戏状态
    if (data.gameStarted && !game) {
        ws.send(JSON.stringify({ type: 'get_leaderboard' }));
        roomStatusDisplay.textContent = '游戏进行中，正在同步...';
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
    
    roundDisplay.textContent = roundInfo[game.step].label;
    draw(selfHand, game.hands[pid]);
    draw(oppHand, game.hands[1 - pid]);
    draw(selfPenalty, game.penalty[pid], true);
    draw(oppPenalty, game.penalty[1 - pid], true);
    renderActions();
}

// 绘制牌
function draw(dom, cards, showAll = false) {
    dom.innerHTML = '';
    cards.forEach(c => {
        const d = document.createElement('div');
        d.className = 'card ' + (c.faceUp || showAll ? 'front' : 'back');
        if (c.faceUp || showAll) {
            d.innerText = c.value + c.suit;
            if (c.suit === '♥' || c.suit === '♦') d.classList.add('red');
        }
        dom.appendChild(d);
    });
}

// 渲染操作按钮
function renderActions() {
    actions.innerHTML = '';
    if (!game || game.finished[pid]) return;

    const btn = (text, value, className) => {
        const button = document.createElement('button');
        button.innerText = text;
        button.className = className;
        button.onclick = () => {
            ws.send(JSON.stringify({ type: 'guess', answer: value }));
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

// 游戏结束动画
function endAnim(leaderboard) {
    setTimeout(() => {
        const myPenalty = game.penalty[pid].length;
        const oppPenalty = game.penalty[1 - pid].length;
        let resultMessage;
        
        if (myPenalty < oppPenalty) {
            resultMessage = '🎉 胜利';
        } else if (myPenalty > oppPenalty) {
            resultMessage = '💀 失败';
        } else {
            resultMessage = '🤝 平局';
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
    
    ws.send(JSON.stringify({ type: 'start_game' }));
    hideStartGameButton();
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

// 页面加载时初始化
window.addEventListener('load', () => {
    // 设置默认昵称
    const defaultName = `玩家${Math.floor(Math.random() * 1000)}`;
    playerNameCreateInput.value = defaultName;
    playerNameJoinInput.value = defaultName;
    
    // 显示房间选择界面
    showRoomSelection();
});

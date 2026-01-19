const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    // 处理根路径
    if (req.url === '/' || req.url === '/index.html') {
        const filePath = path.join(__dirname, 'public', 'index.html');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading index.html');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/game.js') {
        const filePath = path.join(__dirname, 'public', 'game.js');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading game.js');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });
    } else if (req.url === '/style.css') {
        const filePath = path.join(__dirname, 'public', 'style.css');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading style.css');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end(data);
        });
    } else {
        // 其他请求返回404
        res.writeHead(404);
        res.end('Not Found');
    }
});

// 创建WebSocket服务器，附加到HTTP服务器
const wss = new WebSocket.Server({ server });

// 房间管理
const rooms = new Map(); // roomCode -> { players: [], game: null, leaderboard: [], playerMap: new Map(), nextPlayerId: 1, lastActivity: Date.now() }

// 生成4位数字房间码
function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString(); // 1000-9999
    } while (rooms.has(code));
    return code;
}

// 游戏常量
const RANK = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const value = c => RANK.indexOf(c.value);
const isRed = c => c.suit === '♥' || c.suit === '♦';

function createDeck() {
    const suits = ['♠','♥','♣','♦'];
    const deck = [];
    suits.forEach(s => RANK.forEach(v => deck.push({ suit: s, value: v })));
    return deck;
}

function shuffle(d) {
    for (let i = d.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [d[i], d[j]] = [d[j], d[i]];
    }
}

// 广播到房间内的所有玩家
function broadcastToRoom(room, data) {
    room.players.forEach(p => {
        if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(JSON.stringify(data));
        }
    });
}

// 更新房间活动时间
function updateRoomActivity(room) {
    room.lastActivity = Date.now();
}

function updateLeaderboard(room, pid1, pid2, penalty1, penalty2) {
    const player1 = room.players[pid1];
    const player2 = room.players[pid2];
    const p1Wins = penalty1.length < penalty2.length;
    const p2Wins = penalty2.length < penalty1.length;

    function updatePlayer(player, isWin) {
        let entry = room.leaderboard.find(p => p.id === player.id);
        if (!entry) {
            entry = {
                id: player.id,
                name: player.name,
                wins: 0,
                totalGames: 0,
                totalPenalty: 0
            };
            room.leaderboard.push(entry);
        }
        entry.totalGames += 1;
        if (isWin) entry.wins += 1;
        entry.totalPenalty += player.penaltyCount || 0;
    }

    updatePlayer(player1, p1Wins);
    updatePlayer(player2, p2Wins);

    // 按胜利次数排序
    room.leaderboard.sort((a, b) => b.wins - a.wins);
}

function startNewGame(room) {
    if (room.players.length < 2) return false;

    const deck = createDeck();
    shuffle(deck);

    room.game = {
        deck,
        hands: [
            deck.splice(0, 5).map(c => ({ ...c, faceUp: false })),
            deck.splice(0, 5).map(c => ({ ...c, faceUp: false }))
        ],
        penalty: [[], []],
        step: 1,
        finished: [false, false]
    };

    // 记录玩家当前对局的惩罚牌数量
    room.players.forEach(p => p.penaltyCount = 0);

    updateRoomActivity(room);
    broadcastToRoom(room, { type: 'start', game: room.game });
    return true;
}

wss.on('connection', ws => {
    let currentRoom = null;
    let currentPlayer = null;

    ws.on('message', msg => {
        try {
            const data = JSON.parse(msg);
            
            // 处理房间相关消息
            if (data.type === 'create_room') {
                // 创建房间
                const roomCode = generateRoomCode();
                const room = {
                    code: roomCode,
                    players: [],
                    game: null,
                    leaderboard: [],
                    playerMap: new Map(),
                    nextPlayerId: 1,
                    lastActivity: Date.now()
                };
                rooms.set(roomCode, room);
                currentRoom = room;
                
                ws.send(JSON.stringify({ 
                    type: 'room_created', 
                    roomCode,
                    message: `房间创建成功！房间码：${roomCode}，等待其他玩家加入...`
                }));
                return;
            }
            
            if (data.type === 'join_room') {
                const { roomCode, playerName } = data;
                
                // 检查房间是否存在
                const room = rooms.get(roomCode);
                if (!room) {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: '房间不存在，请检查房间码' 
                    }));
                    return;
                }
                
                // 检查房间是否已满
                if (room.players.length >= 2) {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: '房间已满' 
                    }));
                    return;
                }
                
                currentRoom = room;
                
                // 创建玩家
                const playerId = room.nextPlayerId++;
                const name = playerName || `玩家${playerId}`;
                currentPlayer = { 
                    id: playerId, 
                    name, 
                    ws, 
                    penaltyCount: 0,
                    isHost: room.players.length === 0 // 第一个加入的是房主
                };
                room.players.push(currentPlayer);
                room.playerMap.set(ws, currentPlayer);
                
                // 更新房间活动时间
                updateRoomActivity(room);
                
                // 发送加入成功消息
                ws.send(JSON.stringify({ 
                    type: 'room_joined', 
                    roomCode,
                    playerId,
                    playerName: name,
                    pid: room.players.length - 1,
                    isHost: currentPlayer.isHost,
                    playerCount: room.players.length
                }));
                
                // 通知房间内其他玩家
                broadcastToRoom(room, {
                    type: 'player_joined',
                    playerName: name,
                    playerCount: room.players.length
                });
                
                // 发送当前排行榜
                ws.send(JSON.stringify({ type: 'leaderboard', leaderboard: room.leaderboard }));
                
                // 不再自动开始游戏，等待房主手动开始
                return;
            }
            
            // 处理游戏消息（需要当前房间）
            if (!currentRoom || !currentPlayer) return;
            
            const player = currentRoom.playerMap.get(ws);
            const pid = currentRoom.players.indexOf(player);
            if (pid === -1) return;
            
            const game = currentRoom.game;
            
            if (data.type === 'start_game') {
                // 只有房主可以开始游戏
                if (!player.isHost) {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: '只有房主可以开始游戏' 
                    }));
                    return;
                }
                
                if (currentRoom.players.length < 2) {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: '需要2位玩家才能开始游戏' 
                    }));
                    return;
                }
                
                if (startNewGame(currentRoom)) {
                    // 游戏开始成功，消息已广播
                    console.log(`房间 ${currentRoom.code} 游戏开始`);
                }
                return;
            }
            
            if (data.type === 'guess') {
                if (!game || game.finished[pid]) return;

                // 第 5 回合：只翻牌
                if (game.step === 5) {
                    const card = game.hands[pid][4];
                    card.faceUp = true;
                    game.finished[pid] = true;

                    if (game.finished[0] && game.finished[1]) {
                        const c0 = game.hands[0][4];
                        const c1 = game.hands[1][4];
                        if (value(c0) > value(c1)) {
                            game.penalty[1].push(c1);
                            currentRoom.players[1].penaltyCount++;
                        }
                        else if (value(c1) > value(c0)) {
                            game.penalty[0].push(c0);
                            currentRoom.players[0].penaltyCount++;
                        }

                        // 游戏结束，更新排行榜
                        updateLeaderboard(currentRoom, 0, 1, game.penalty[0], game.penalty[1]);
                        broadcastToRoom(currentRoom, { type: 'end', game, leaderboard: currentRoom.leaderboard });
                    } else {
                        broadcastToRoom(currentRoom, { type: 'update', game });
                    }
                    updateRoomActivity(currentRoom);
                    return;
                }

                // 1~4 回合：持续猜
                const hand = game.hands[pid];
                const idx = game.step - 1;
                const card = hand[idx];
                let correct = false;

                if (game.step === 1)
                    correct = (data.answer === 'red') === isRed(card);

                if (game.step === 2)
                    correct =
                        (data.answer === 'bigger' && value(card) > value(hand[0])) ||
                        (data.answer === 'smaller' && value(card) < value(hand[0]));

                if (game.step === 3) {
                    const min = Math.min(value(hand[0]), value(hand[1]));
                    const max = Math.max(value(hand[0]), value(hand[1]));
                    const between = value(card) > min && value(card) < max;
                    correct = data.answer === (between ? 'between' : 'not');
                }

                if (game.step === 4)
                    correct = data.answer === card.suit;

                card.faceUp = true;

                if (!correct) {
                    // 错牌 → 惩罚堆 → 补牌 → 继续猜
                    game.penalty[pid].push(card);
                    currentRoom.players[pid].penaltyCount++;
                    hand.splice(idx, 1);

                    if (game.deck.length > 0) {
                        hand.splice(idx, 0, { ...game.deck.shift(), faceUp: false });
                    }
                } else {
                    game.finished[pid] = true;
                }

                // 双方都猜对 → 进入下一回合
                if (game.finished[0] && game.finished[1]) {
                    game.step++;
                    game.finished = [false, false];
                }

                updateRoomActivity(currentRoom);
                broadcastToRoom(currentRoom, { type: 'update', game });
            } else if (data.type === 'restart') {
                // 重新开始游戏
                if (currentRoom.players.length === 2) {
                    startNewGame(currentRoom);
                }
            } else if (data.type === 'get_room_status') {
                // 获取房间状态
                ws.send(JSON.stringify({
                    type: 'room_status',
                    roomCode: currentRoom.code,
                    players: currentRoom.players.map(p => ({ name: p.name, isHost: p.isHost })),
                    playerCount: currentRoom.players.length,
                    gameStarted: !!currentRoom.game
                }));
            } else if (data.type === 'get_leaderboard') {
                ws.send(JSON.stringify({ type: 'leaderboard', leaderboard: currentRoom.leaderboard }));
            } else if (data.type === 'leave_room') {
                // 离开房间
                ws.close();
            }
        } catch (err) {
            console.error('消息处理错误:', err);
        }
    });

    ws.on('close', () => {
        if (currentRoom && currentPlayer) {
            const room = currentRoom;
            const player = currentPlayer;
            
            // 从房间中移除玩家
            const index = room.players.indexOf(player);
            if (index !== -1) {
                room.players.splice(index, 1);
            }
            room.playerMap.delete(ws);
            
            // 通知其他玩家
            broadcastToRoom(room, {
                type: 'player_left',
                playerName: player.name,
                playerCount: room.players.length
            });
            
            // 如果房间为空，标记活动时间，等待定时清理
            if (room.players.length === 0) {
                updateRoomActivity(room); // 更新活动时间，但房间仍保留，定时器会清理
            } else {
                // 如果游戏正在进行，重置游戏
                if (room.game) {
                    room.game = null;
                    broadcastToRoom(room, {
                        type: 'game_reset',
                        message: '有玩家离开，游戏已重置'
                    });
                }
            }
        }
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`HTTP 服务器运行在 http://localhost:${PORT}`);
    console.log(`WebSocket 服务器运行在 ws://localhost:${PORT}`);
    console.log('支持房间码系统，可创建/加入房间进行两两联机对战');
    console.log('房间无操作5分钟自动删除');
});

// 定期清理空房间（每分钟检查一次）
setInterval(() => {
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000; // 5分钟
    let deleted = 0;
    
    for (const [code, room] of rooms.entries()) {
        // 如果房间没有玩家，且超过5分钟无活动，则删除
        if (room.players.length === 0 && (now - room.lastActivity) > FIVE_MINUTES) {
            rooms.delete(code);
            deleted++;
            console.log(`清理空房间: ${code} (无玩家)`);
        }
        // 如果有玩家但房间超过5分钟无活动，则强制解散房间
        else if (room.players.length > 0 && (now - room.lastActivity) > FIVE_MINUTES) {
            // 通知所有玩家房间已超时
            broadcastToRoom(room, {
                type: 'room_timeout',
                message: '房间长时间无活动，已被系统解散'
            });
            // 断开所有玩家的连接
            room.players.forEach(p => p.ws.close());
            rooms.delete(code);
            deleted++;
            console.log(`清理超时房间: ${code} (${room.players.length} 名玩家)`);
        }
    }
    
    if (deleted > 0) {
        console.log(`清理了 ${deleted} 个房间`);
    }
}, 60000); // 1分钟检查一次

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const FlipCardGame = require('./games/FlipCardGame');
const ThreePileGame = require('./games/ThreePileGame');

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    // 处理静态文件
    const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    const contentType = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json'
    }[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 房间管理
const rooms = new Map(); // roomCode -> room object

// 生成4位数字房间码
function generateRoomCode() {
    let code;
    do {
        code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms.has(code));
    return code;
}

// 更新房间活动时间
function updateRoomActivity(room) {
    room.lastActivity = Date.now();
}

// 广播到房间内的所有玩家
function broadcastToRoom(room, data) {
    room.players.forEach(p => {
        if (p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(JSON.stringify(data));
        }
    });
}

// 创建房间
function createRoom(ws, playerName, gameType = 'flip_card') {
    const roomCode = generateRoomCode();
    const room = {
        code: roomCode,
        players: [],
        game: null,
        leaderboard: [],
        playerMap: new Map(),
        nextPlayerId: 1,
        lastActivity: Date.now(),
        gameType: gameType  // 保存房间默认游戏类型
    };
    rooms.set(roomCode, room);
    
    // 创建房主玩家
    const playerId = room.nextPlayerId++;
    const player = {
        id: playerId,
        name: playerName || `玩家${playerId}`,
        ws,
        penaltyCount: 0,
        isHost: true
    };
    room.players.push(player);
    room.playerMap.set(ws, player);
    
    updateRoomActivity(room);
    return { room, player };
}

// 加入房间
function joinRoom(ws, roomCode, playerName) {
    const room = rooms.get(roomCode);
    if (!room) {
        throw new Error('房间不存在');
    }
    if (room.players.length >= 2) {
        throw new Error('房间已满');
    }
    
    const playerId = room.nextPlayerId++;
    const player = {
        id: playerId,
        name: playerName || `玩家${playerId}`,
        ws,
        penaltyCount: 0,
        isHost: false
    };
    room.players.push(player);
    room.playerMap.set(ws, player);
    
    updateRoomActivity(room);
    return { room, player };
}

// 开始游戏
function startGame(room, gameType = 'flip_card') {
    if (room.players.length < 2) {
        throw new Error('需要2位玩家才能开始游戏');
    }
    if (room.game) {
        throw new Error('游戏已在进行中');
    }
    
    // 根据游戏类型创建游戏实例
    if (gameType === 'three_pile') {
        room.game = new ThreePileGame(room);
    } else {
        // 默认翻牌对战
        room.game = new FlipCardGame(room);
    }
    const gameState = room.game.init();
    
    updateRoomActivity(room);
    return gameState;
}

// WebSocket连接处理
wss.on('connection', ws => {
    let currentRoom = null;
    let currentPlayer = null;

    ws.on('message', async msg => {
        try {
            const data = JSON.parse(msg);
            
            switch (data.type) {
                case 'create_room':
                    try {
                        const gameType = data.gameType || 'flip_card';
                        const { room, player } = createRoom(ws, data.playerName, gameType);
                        currentRoom = room;
                        currentPlayer = player;
                        
                        ws.send(JSON.stringify({
                            type: 'room_created',
                            roomCode: room.code,
                            playerId: player.id,
                            playerName: player.name,
                            pid: room.players.indexOf(player), // 添加pid
                            isHost: player.isHost,
                            playerCount: room.players.length,
                            gameType: room.gameType,  // 返回游戏类型
                            message: `房间创建成功！房间码：${room.code}，等待其他玩家加入...`
                        }));
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', message: err.message }));
                    }
                    break;
                    
                case 'join_room':
                    try {
                        const { room, player } = joinRoom(ws, data.roomCode, data.playerName);
                        currentRoom = room;
                        currentPlayer = player;
                        
                        ws.send(JSON.stringify({
                            type: 'room_joined',
                            roomCode: room.code,
                            playerId: player.id,
                            playerName: player.name,
                            pid: room.players.indexOf(player),
                            isHost: player.isHost,
                            playerCount: room.players.length
                        }));
                        
                        // 通知房间内其他玩家
                        broadcastToRoom(room, {
                            type: 'player_joined',
                            playerName: player.name,
                            playerCount: room.players.length
                        });
                        
                        // 发送排行榜
                        ws.send(JSON.stringify({ type: 'leaderboard', leaderboard: room.leaderboard }));
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', message: err.message }));
                    }
                    break;
                    
                case 'start_game':
                    if (!currentRoom || !currentPlayer) {
                        ws.send(JSON.stringify({ type: 'error', message: '未加入房间' }));
                        return;
                    }
                    if (!currentPlayer.isHost) {
                        ws.send(JSON.stringify({ type: 'error', message: '只有房主可以开始游戏' }));
                        return;
                    }
                    
                    try {
                        // 优先使用客户端指定的游戏类型，否则使用房间默认游戏类型
                        const gameType = data.gameType || currentRoom.gameType || 'flip_card';
                        const gameState = startGame(currentRoom, gameType);
                        broadcastToRoom(currentRoom, {
                            type: 'start',
                            game: currentRoom.game.getClientState(),
                            gameName: currentRoom.game.getGameName()
                        });
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', message: err.message }));
                    }
                    break;
                    
                case 'game_action':
                    if (!currentRoom || !currentPlayer || !currentRoom.game) {
                        ws.send(JSON.stringify({ type: 'error', message: '游戏未开始' }));
                        return;
                    }
                    
                    try {
                        const playerIndex = currentRoom.players.indexOf(currentPlayer);
                        const gameState = currentRoom.game.handleAction(playerIndex, data.action);
                        
                        updateRoomActivity(currentRoom);
                        
                        // 广播更新
                        const broadcastData = {
                            type: 'update',
                            game: currentRoom.game.getClientState()
                        };
                        
                        if (currentRoom.game.isFinished()) {
                            broadcastData.type = 'end';
                            broadcastData.leaderboard = currentRoom.leaderboard;
                            broadcastData.winners = currentRoom.game.getWinners();
                        }
                        
                        broadcastToRoom(currentRoom, broadcastData);
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', message: err.message }));
                    }
                    break;
                    
                case 'restart':
                    if (!currentRoom || !currentPlayer || !currentRoom.game) {
                        ws.send(JSON.stringify({ type: 'error', message: '游戏未开始' }));
                        return;
                    }
                    if (!currentPlayer.isHost) {
                        ws.send(JSON.stringify({ type: 'error', message: '只有房主可以重新开始游戏' }));
                        return;
                    }
                    
                    try {
                        currentRoom.game.restart();
                        broadcastToRoom(currentRoom, {
                            type: 'start',
                            game: currentRoom.game.getClientState(),
                            gameName: currentRoom.game.getGameName()
                        });
                    } catch (err) {
                        ws.send(JSON.stringify({ type: 'error', message: err.message }));
                    }
                    break;
                    
                case 'get_room_status':
                    if (!currentRoom || !currentPlayer) {
                        ws.send(JSON.stringify({ type: 'error', message: '未加入房间' }));
                        return;
                    }
                    
                    ws.send(JSON.stringify({
                        type: 'room_status',
                        roomCode: currentRoom.code,
                        players: currentRoom.players.map(p => ({
                            name: p.name,
                            isHost: p.isHost,
                            id: p.id
                        })),
                        playerCount: currentRoom.players.length,
                        gameStarted: !!currentRoom.game,
                        gameName: currentRoom.game ? currentRoom.game.getGameName() : null,
                        gameType: currentRoom.gameType || 'flip_card',
                        isHost: currentPlayer.isHost
                    }));
                    break;
                    
                case 'get_leaderboard':
                    if (!currentRoom) {
                        ws.send(JSON.stringify({ type: 'error', message: '未加入房间' }));
                        return;
                    }
                    
                    ws.send(JSON.stringify({
                        type: 'leaderboard',
                        leaderboard: currentRoom.leaderboard
                    }));
                    break;
                    
                case 'leave_room':
                    ws.close();
                    break;
                    
                default:
                    ws.send(JSON.stringify({ type: 'error', message: '未知消息类型' }));
            }
        } catch (err) {
            console.error('消息处理错误:', err);
            ws.send(JSON.stringify({ type: 'error', message: '服务器内部错误' }));
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
            
            // 如果房间为空，更新活动时间等待清理
            if (room.players.length === 0) {
                updateRoomActivity(room);
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

// 定期清理空房间（5分钟无活动）
setInterval(() => {
    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;
    let deleted = 0;
    
    for (const [code, room] of rooms.entries()) {
        if (room.players.length === 0 && (now - room.lastActivity) > FIVE_MINUTES) {
            rooms.delete(code);
            deleted++;
            console.log(`清理空房间: ${code}`);
        } else if (room.players.length > 0 && (now - room.lastActivity) > FIVE_MINUTES) {
            // 通知玩家房间超时
            broadcastToRoom(room, {
                type: 'room_timeout',
                message: '房间长时间无活动，已被系统解散'
            });
            room.players.forEach(p => p.ws.close());
            rooms.delete(code);
            deleted++;
            console.log(`清理超时房间: ${code} (${room.players.length}名玩家)`);
        }
    }
    
    if (deleted > 0) {
        console.log(`清理了 ${deleted} 个房间`);
    }
}, 60000); // 每分钟检查一次

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`WebSocket 服务器运行在 ws://localhost:${PORT}`);
    console.log('房间系统已启用，支持翻牌对战游戏');
    console.log('房间无操作5分钟自动删除');
});

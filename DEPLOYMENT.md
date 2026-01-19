# 翻牌对战游戏 - 部署指南

本指南将帮助您将翻牌对战游戏部署到服务器上，以便可以通过互联网访问。

## 一、系统要求

- Node.js 14.0 或更高版本
- npm 6.0 或更高版本
- 服务器需开放端口：3000（WebSocket）和可选的80/443（HTTP/HTTPS）

## 二、本地测试部署

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务器
```bash
npm start
# 或直接运行
node server.js
```

### 3. 本地访问
- 打开浏览器访问：`http://localhost:3000`
- WebSocket 服务器运行在：`ws://localhost:3000`

## 三、服务器部署（Linux/Ubuntu）

### 1. 将项目上传到服务器
```bash
# 使用 scp 或 sftp 上传文件
scp -r . user@your-server-ip:/opt/pock-game/
```

### 2. 登录服务器并安装依赖
```bash
ssh user@your-server-ip
cd /opt/pock-game
npm install
```

### 3. 使用 PM2 管理进程（推荐）
```bash
# 安装 PM2
npm install -g pm2

# 使用 PM2 启动应用
pm2 start server.js --name "pock-game"

# 设置开机自启动
pm2 startup
pm2 save
```

### 4. 配置防火墙
```bash
# 开放端口 3000
sudo ufw allow 3000/tcp
sudo ufw reload
```

### 5. 访问游戏
- 通过浏览器访问：`http://your-server-ip:3000`
- WebSocket 地址：`ws://your-server-ip:3000`

## 四、使用 Nginx 反向代理（支持 HTTPS）

### 1. 安装 Nginx
```bash
sudo apt update
sudo apt install nginx
```

### 2. 配置 Nginx
创建配置文件 `/etc/nginx/sites-available/pock-game`：
```nginx
server {
    listen 80;
    server_name your-domain.com; # 替换为您的域名

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 启用站点并重启 Nginx
```bash
sudo ln -s /etc/nginx/sites-available/pock-game /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 配置 HTTPS（可选但推荐）
使用 Let's Encrypt 免费 SSL 证书：
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 五、云服务部署

### 1. Heroku 部署
```bash
# 创建 Procfile
echo "web: node server.js" > Procfile

# 登录 Heroku
heroku login

# 创建应用
heroku create your-app-name

# 部署
git push heroku main

# 打开应用
heroku open
```

### 2. Vercel 部署
```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel
```

## 六、内网穿透方案（无需服务器）

### 1. 使用 ngrok（最简单）
```bash
# 安装 ngrok
# 访问 https://ngrok.com 注册并获取 token

# 启动本地服务器
npm start

# 在新的终端中运行（确保 ngrok 已安装）
ngrok http 3000
```

ngrok 会生成一个公共 URL（如 `https://abc123.ngrok.io`），分享此链接给其他玩家即可。

### 2. 使用 Cloudflare Tunnel
```bash
# 安装 cloudflared
# 参考：https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/

# 创建隧道
cloudflared tunnel create pock-game

# 配置隧道
# 编辑配置文件，将本地 3000 端口映射到公网

# 运行隧道
cloudflared tunnel run pock-game
```

### 3. 使用 frp（自行搭建）
适合有 VPS 的用户，配置较复杂但更灵活。

## 七、Docker 部署

### 1. 创建 Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

### 2. 构建和运行
```bash
docker build -t pock-game .
docker run -p 3000:3000 -d pock-game
```

### 3. Docker Compose 示例
```yaml
version: '3.8'
services:
  pock-game:
    build: .
    ports:
      - "3000:3000"
    restart: always
```

## 八、访问游戏和联机

### 1. 单机访问
- 直接访问部署后的 URL

### 2. 联机对战
- **两位玩家需要连接到相同的服务器地址**
- 第一位玩家进入后等待，第二位玩家进入后游戏自动开始
- 确保网络环境允许 WebSocket 连接（某些企业网络可能限制）

### 3. 测试连接
- 打开浏览器开发者工具，查看 Console 是否有连接错误
- 确认 WebSocket 连接状态为 "OPEN"

## 九、故障排除

### 常见问题 1：无法连接 WebSocket 或显示 "Upgrade Required"
- **原因**：旧版服务器只处理 WebSocket 连接，不提供 HTTP 服务
- **解决方案**：确保使用最新的 server.js（已包含 HTTP 静态文件服务）
- 检查防火墙是否开放端口 3000
- 确认服务器安全组规则允许入站连接
- 如果是 HTTPS 站点，确保 WebSocket 使用 wss:// 协议
- **验证方法**：直接访问 `http://你的域名:3000` 应该能看到游戏界面

### 常见问题 2：玩家无法互相看到
- 确保两位玩家连接到相同的服务器 URL
- 检查服务器日志是否有错误信息
- 确认没有超过最大玩家数（当前设置为 2 人）

### 常见问题 3：游戏卡住
- 刷新页面重新连接
- 检查网络延迟
- 查看服务器控制台是否有错误输出

## 十、维护和更新

### 1. 更新代码
```bash
git pull origin main
npm install
pm2 restart pock-game
```

### 2. 查看日志
```bash
pm2 logs pock-game
# 或直接查看
tail -f server.log
```

### 3. 备份数据
游戏数据目前存储在内存中，重启服务器会重置。如需持久化存储，可修改 server.js 中的 `leaderboard` 数组为数据库存储。

## 十一、安全注意事项

1. **使用 HTTPS**：生产环境务必启用 HTTPS，保护数据传输安全
2. **限制访问**：可通过 Nginx 配置 IP 白名单
3. **定期更新**：保持 Node.js 和依赖包更新到最新版本
4. **监控资源**：监控服务器 CPU、内存和网络使用情况

## 十二、联系和支持

如有部署问题，请检查：
- 服务器是否正常运行：`systemctl status nginx` 或 `pm2 status`
- 端口是否开放：`netstat -tulpn | grep 3000`
- 防火墙设置：`sudo ufw status`

---

**部署成功标志**：两位不同网络的玩家可以访问相同 URL 并开始游戏对局，游戏结束后排行榜正常更新。

## 十三、关于 "Upgrade Required" 错误

### 错误原因
当使用旧版 server.js（仅 WebSocket 服务器）时，通过 HTTP 访问会收到 "Upgrade Required" 响应，因为服务器只接受 WebSocket 连接升级请求。

### 解决方案
1. **使用最新版 server.js**：当前版本已包含完整的 HTTP 服务器，可同时提供：
   - 静态文件服务（HTML、CSS、JS）
   - WebSocket 游戏连接

2. **验证部署**：
   ```bash
   # 启动服务器
   node server.js
   
   # 在浏览器访问
   curl http://localhost:3000
   # 应该返回 HTML 页面内容
   ```

3. **内网穿透注意事项**：
   - ngrok 等工具会自动处理 HTTP/WebSocket 协议转换
   - 确保穿透的是 HTTP 端口（3000），而不是单纯的 WebSocket 端口
   - 如果使用 HTTPS，WebSocket 会自动升级为 WSS 协议

### 快速测试
1. 本地测试：`http://localhost:3000` 应该显示游戏界面
2. 远程测试：通过内网穿透 URL 访问应该显示相同界面
3. 连接测试：打开浏览器开发者工具，查看 Console 中 WebSocket 连接状态

## 十四、房间系统使用指南

### 1. 创建房间
1. 打开游戏页面，在"创建房间"部分输入昵称
2. 点击"创建房间"按钮
3. 系统会生成4位数字房间码（如：1234）
4. 将房间码分享给好友

### 2. 加入房间
1. 打开游戏页面，在"加入房间"部分输入昵称和房间码
2. 点击"加入房间"按钮
3. 等待房主开始游戏

### 3. 游戏流程
- 房间满2人后游戏自动开始
- 每位玩家有5张牌，依次进行5个回合的猜测
- 每回合根据提示猜测自己的牌
- 猜错则牌进入惩罚堆，并补充新牌
- 五回合后比较双方惩罚牌数量，少者胜利
- 游戏结束后可点击"重新开始"再次对战

### 4. 手机适配说明
- 游戏已全面适配移动设备
- 支持触摸操作，按钮尺寸适合手指点击
- 横屏和竖屏自动调整布局
- 卡片和按钮在手机上会适当缩小以确保可见性

### 5. 无需Node.js的测试方法
如果本地没有Node.js环境，可以使用以下方法测试：

**方法一：使用在线演示（如已部署）**
1. 访问已部署的游戏URL
2. 在两个不同的浏览器或设备上打开
3. 创建房间并加入，测试联机功能

**方法二：使用ngrok（需要安装ngrok）**
```bash
# 如果有Node.js环境
npm install
node server.js

# 另一个终端运行
ngrok http 3000
# 分享ngrok生成的URL给其他设备测试
```

**方法三：直接文件测试（仅测试界面）**
1. 直接双击打开 `public/index.html` 文件
2. 可以测试房间选择界面和UI适配
3. 注意：直接文件打开时WebSocket连接会失败，需要服务器环境

### 6. 故障排除
- **无法创建/加入房间**：检查WebSocket连接状态，确保服务器运行
- **游戏卡住**：刷新页面重新连接
- **手机显示异常**：检查是否使用最新版浏览器，清除缓存
- **房间人数不足**：确保两位玩家都成功加入同一房间

**最低配置**：1核 CPU，1GB 内存，10GB 存储空间即可运行。

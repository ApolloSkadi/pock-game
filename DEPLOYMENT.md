# 翻牌对战游戏（React版） - 部署与PM2管理指南

本指南帮助您将翻牌对战游戏部署到服务器，并使用PM2进行进程管理。

## 一、系统要求

### 基础环境
- Node.js 16.0 或更高版本
- npm 8.0 或更高版本
- 服务器开放端口：3000（HTTP + WebSocket）

### 项目结构
```
pock-old/
├── server.js              # Node.js后端服务器（HTTP + WebSocket）
├── games/                 # 游戏逻辑模块
├── client/                # React前端应用
│   ├── package.json      # React依赖
│   ├── public/           # 静态资源
│   └── src/              # React源代码
└── client/build/         # React构建输出（部署时需要）
```

## 二、PM2进程管理完整指南

### 1. 安装PM2
```bash
# 全局安装PM2
npm install -g pm2

# 验证安装
pm2 --version
```

### 2. 使用PM2管理项目

#### 启动项目
```bash
# 启动服务器（在项目根目录执行）
pm2 start server.js --name "pock-game"

# 或指定端口和日志文件
pm2 start server.js --name "pock-game" -- --port 3000

# 启动并设置日志
pm2 start server.js --name "pock-game" --log pock-game.log --error pock-game-error.log
```

#### 查看项目状态
```bash
# 查看所有进程
pm2 list

# 查看特定进程
pm2 info pock-game

# 查看实时日志
pm2 logs pock-game

# 查看最近日志（不带实时流）
pm2 logs pock-game --lines 100
```

#### 停止项目
```bash
# 停止单个项目
pm2 stop pock-game

# 停止所有项目
pm2 stop all
```

#### 重启项目
```bash
# 重启单个项目
pm2 restart pock-game

# 重启所有项目
pm2 restart all
```

#### 删除项目
```bash
# 从PM2列表中删除（不会停止进程）
pm2 delete pock-game

# 停止并删除
pm2 stop pock-game && pm2 delete pock-game
```

#### 设置开机自启
```bash
# 生成启动脚本
pm2 startup

# 保存当前进程列表
pm2 save

# 取消开机自启
pm2 unstartup
```

### 3. PM2高级管理

#### 监控仪表板
```bash
# 启动PM2监控界面
pm2 monit
```

#### 进程集群模式（多核CPU）
```bash
# 启动集群模式（自动负载均衡）
pm2 start server.js -i max --name "pock-game-cluster"
```

#### 环境变量管理
```bash
# 使用环境变量启动
pm2 start server.js --name "pock-game" --env production

# 通过配置文件设置环境变量
pm2 ecosystem
```

#### 性能监控
```bash
# 查看资源使用情况
pm2 show pock-game

# 生成性能报告
pm2 report
```

### 4. 常见PM2问题解决

#### 进程意外停止
```bash
# 查看进程退出原因
pm2 logs pock-game --lines 50

# 自动重启（崩溃时）
pm2 start server.js --name "pock-game" --watch --max-memory-restart 200M
```

#### 内存泄漏监控
```bash
# 设置内存限制自动重启
pm2 start server.js --name "pock-game" --max-memory-restart 300M

# 监控内存使用
pm2 monit
```

#### 日志管理
```bash
# 清空日志
pm2 flush pock-game

# 设置日志轮转（需要安装pm2-logrotate）
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

## 三、完整部署流程

### 步骤1：准备服务器环境
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js（如果未安装）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version
npm --version
```

### 步骤2：上传项目到服务器
```bash
# 使用SCP上传（本地执行）
scp -r ./ user@your-server-ip:/opt/pock-game/

# 或使用Git（服务器上执行）
git clone https://github.com/your-repo/pock-game.git /opt/pock-game
cd /opt/pock-game
```

### 步骤3：安装项目依赖
```bash
# 在项目根目录执行
npm install

# 安装React客户端依赖
cd client
npm install
cd ..
```

### 步骤4：构建React应用
```bash
# 进入client目录并构建
cd client
npm run build

# 返回根目录
cd ..
```

**注意**：如果系统未安装npm，可以跳过构建步骤，使用预生成的基本页面。
```bash
# 创建基本构建目录
mkdir -p client/build
echo '<!DOCTYPE html><html><head><title>扑克游戏</title></head><body><h1>游戏正在构建中...</h1></body></html>' > client/build/index.html
```

### 步骤5：使用PM2启动服务
```bash
# 全局安装PM2（如果未安装）
npm install -g pm2

# 启动服务器
pm2 start server.js --name "pock-game" --log pock-game.log --error pock-game-error.log

# 设置开机自启
pm2 startup
pm2 save
```

### 步骤6：配置防火墙
```bash
# 开放3000端口
sudo ufw allow 3000/tcp
sudo ufw reload

# 查看端口状态
sudo ufw status
```

### 步骤7：验证部署
```bash
# 检查PM2状态
pm2 status

# 检查服务是否运行
curl -I http://localhost:3000

# 检查WebSocket连接
# 可以使用浏览器访问 http://服务器IP:3000 测试
```

## 四、Nginx反向代理配置（HTTPS支持）

### 1. 安装Nginx
```bash
sudo apt install nginx -y
```

### 2. 创建Nginx配置文件
`/etc/nginx/sites-available/pock-game`：
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

### 3. 启用配置
```bash
sudo ln -s /etc/nginx/sites-available/pock-game /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 配置SSL证书
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 五、内网穿透方案（无公网IP）

### 方案1：ngrok（最简单）
```bash
# 本地安装ngrok
# 访问 https://ngrok.com 注册获取token

# 启动本地服务
npm start

# 内网穿透（新终端）
ngrok http 3000
# 分享生成的https URL即可
```

### 方案2：Cloudflare Tunnel
```bash
# 安装cloudflared
# 参考：https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/

cloudflared tunnel create pock-game
cloudflared tunnel run pock-game
```

### 方案3：frp（自建服务器）
需要一台有公网IP的VPS，配置较复杂但稳定。

## 六、项目维护指南

### 1. 日常维护命令
```bash
# 查看服务状态
pm2 status

# 查看实时日志
pm2 logs pock-game

# 重启服务（更新后）
pm2 restart pock-game

# 停止服务（维护时）
pm2 stop pock-game
```

### 2. 更新项目代码
```bash
# 拉取最新代码
git pull origin main

# 更新依赖
npm install
cd client && npm install && npm run build && cd ..

# 重启服务
pm2 restart pock-game

# 查看更新日志
pm2 logs pock-game --lines 50
```

### 3. 备份与恢复
```bash
# 备份项目目录
tar -czf pock-game-backup-$(date +%Y%m%d).tar.gz /opt/pock-game

# 备份PM2配置
pm2 save

# 恢复项目
tar -xzf pock-game-backup-20250120.tar.gz -C /
pm2 resurrect
```

### 4. 性能监控
```bash
# 查看资源使用
pm2 monit

# 生成系统报告
pm2 report

# 设置资源限制
pm2 start server.js --name "pock-game" --max-memory-restart 300M
```

## 七、故障排除

### 1. PM2相关问题
```bash
# PM2进程消失
pm2 resurrect

# 日志文件过大
pm2 flush pock-game
pm2 install pm2-logrotate

# 服务无法启动
pm2 delete pock-game
pm2 start server.js --name "pock-game" --watch
```

### 2. 部署问题
- **端口占用**：`sudo lsof -i :3000` 查看占用进程
- **权限问题**：确保Node.js有读取项目文件的权限
- **内存不足**：增加虚拟内存或优化代码

### 3. 连接问题
- **无法访问**：检查防火墙和安全组规则
- **WebSocket失败**：确保代理配置正确（Nginx需要WebSocket支持）
- **跨域问题**：server.js已配置CORS，无需额外设置

### 4. 游戏功能问题
- **房间无法创建**：检查WebSocket连接状态
- **玩家无法加入**：确保两位玩家连接相同服务器
- **游戏卡住**：重启服务或刷新页面

## 八、安全建议

1. **使用HTTPS**：生产环境务必启用SSL
2. **防火墙配置**：仅开放必要端口（3000, 80, 443）
3. **定期更新**：保持Node.js和npm版本更新
4. **监控日志**：定期检查PM2日志，发现异常行为
5. **备份配置**：定期备份PM2配置和项目文件

## 九、快速参考命令

### PM2常用命令
```bash
# 启动
pm2 start server.js --name "pock-game"

# 停止
pm2 stop pock-game

# 重启
pm2 restart pock-game

# 删除
pm2 delete pock-game

# 日志
pm2 logs pock-game

# 状态
pm2 status
```

### 系统管理命令
```bash
# 查看进程
ps aux | grep node

# 查看端口
netstat -tulpn | grep :3000

# 强制终止进程
kill -9 $(lsof -t -i:3000)

# 查看系统资源
htop
```

### 项目维护命令
```bash
# 构建React应用
cd client && npm run build && cd ..

# 安装依赖
npm install && cd client && npm install && cd ..

# 测试运行
node server.js
```

## 十、支持与联系

如果遇到问题，请按以下步骤排查：
1. 检查PM2状态：`pm2 status`
2. 查看错误日志：`pm2 logs pock-game --lines 100`
3. 验证端口是否开放：`curl -I http://localhost:3000`
4. 检查系统资源：`free -h` 和 `df -h`

**部署成功标志**：
- PM2显示pock-game状态为online
- 浏览器访问服务器IP:3000显示游戏界面
- 两个不同网络的玩家可以创建/加入房间并开始游戏

---

**注意**：本项目使用React前端 + Node.js后端，需要构建React应用才能获得完整功能。如果只使用基础HTML页面，部分交互功能可能受限。

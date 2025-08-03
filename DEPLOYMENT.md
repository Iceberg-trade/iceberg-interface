# Iceberg Interface 部署指南

## 🚀 快速部署

### 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 服务器或云实例 (推荐 2GB+ RAM)

### 一键部署

```bash
# 1. 克隆代码
git clone <repository-url>
cd iceberg-interface

# 2. 配置环境变量
cp .env.production .env
# 编辑 .env 文件，设置您的API密钥

# 3. 运行部署脚本
./deploy.sh deploy production
```

应用将在几分钟内启动，访问 `http://your-server-ip` 即可使用。

## 📋 详细部署步骤

### 1. 服务器准备

#### Ubuntu/Debian
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 添加用户到docker组
sudo usermod -aG docker $USER
```

#### CentOS/RHEL
```bash
# 安装Docker
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl start docker
sudo systemctl enable docker

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. 代码部署

```bash
# 克隆代码
git clone <repository-url>
cd iceberg-interface

# 配置环境变量
cp .env.production .env
nano .env  # 编辑配置文件
```

### 3. 环境配置

编辑 `.env` 文件，至少需要设置：

```env
# 必需配置
REACT_APP_ONEINCH_API_KEY=your_real_api_key_here
REACT_APP_NETWORK=arbitrum

# 可选配置
HTTP_PORT=80
HTTPS_PORT=443
DOMAIN=yourdomain.com
```

### 4. 启动服务

```bash
# 部署
./deploy.sh deploy production

# 检查状态
./deploy.sh status

# 查看日志
./deploy.sh logs
```

## 🔧 管理命令

### 常用操作

```bash
# 部署/重新部署
./deploy.sh deploy production

# 停止服务
./deploy.sh stop

# 重启服务
./deploy.sh restart production

# 查看日志
./deploy.sh logs

# 查看服务状态
./deploy.sh status

# 完全清理
./deploy.sh cleanup
```

### 手动Docker命令

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f

# 查看运行状态
docker-compose ps
```

## 🌐 HTTPS/SSL 配置

### 使用Let's Encrypt

```bash
# 安装certbot
sudo apt install certbot

# 获取证书
sudo certbot certonly --standalone -d yourdomain.com

# 创建SSL目录
mkdir -p ssl

# 复制证书
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
sudo chown $USER:$USER ssl/*.pem

# 更新nginx配置启用HTTPS
# 编辑 nginx.conf 文件，添加SSL配置
```

### 自签名证书（测试用）

```bash
# 创建SSL目录
mkdir -p ssl

# 生成自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem \
  -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

## 🔄 更新部署

```bash
# 拉取最新代码
git pull origin main

# 重新部署
./deploy.sh deploy production
```

## 🐛 故障排除

### 常见问题

1. **端口已被占用**
   ```bash
   # 检查端口占用
   sudo netstat -tlnp | grep :80
   
   # 修改端口
   echo "HTTP_PORT=8080" >> .env
   ```

2. **内存不足**
   ```bash
   # 检查内存使用
   free -h
   
   # 添加swap
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

3. **Docker权限问题**
   ```bash
   # 添加用户到docker组
   sudo usermod -aG docker $USER
   
   # 重新登录或运行
   newgrp docker
   ```

4. **构建失败**
   ```bash
   # 清理Docker缓存
   docker system prune -af
   
   # 重新构建
   docker-compose build --no-cache
   ```

### 日志分析

```bash
# 查看应用日志
./deploy.sh logs

# 查看nginx日志
docker-compose exec iceberg-frontend tail -f /var/log/nginx/access.log

# 查看系统资源
docker stats

# 检查健康状态
curl http://localhost/health
```

## 📊 监控和维护

### 健康检查

应用提供健康检查端点：
- `GET /health` - 应用健康状态

### 日志管理

```bash
# 轮转日志（定期执行）
docker-compose logs --no-color > app.log
docker-compose logs --no-color > /dev/null

# 设置logrotate
sudo nano /etc/logrotate.d/docker-compose
```

### 定期维护

创建定期维护脚本：

```bash
#!/bin/bash
# 定期清理无用镜像和容器
docker system prune -f

# 检查磁盘空间
df -h

# 检查应用健康状态
curl -f http://localhost/health || echo "Health check failed"
```

## 🚀 性能优化

### 服务器优化

```bash
# 调整系统参数
echo 'net.core.somaxconn = 65535' >> /etc/sysctl.conf
echo 'net.ipv4.tcp_max_syn_backlog = 65535' >> /etc/sysctl.conf
sysctl -p
```

### Docker优化

```yaml
# docker-compose.override.yml
version: '3.8'
services:
  iceberg-frontend:
    deploy:
      resources:
        limits:
          memory: 512M
        reservations:
          memory: 256M
```

## 📞 支持

如遇问题，请：

1. 检查日志：`./deploy.sh logs`
2. 查看状态：`./deploy.sh status`
3. 重启服务：`./deploy.sh restart production`
4. 提交Issue到项目仓库

---

## 🎯 生产环境检查清单

- [ ] 服务器资源充足 (2GB+ RAM, 20GB+ 磁盘)
- [ ] Docker和Docker Compose已安装
- [ ] 防火墙已配置 (开放80/443端口)
- [ ] 域名已解析到服务器IP
- [ ] SSL证书已配置 (推荐)
- [ ] API密钥已正确设置
- [ ] 备份策略已建立
- [ ] 监控告警已设置
- [ ] 日志轮转已配置
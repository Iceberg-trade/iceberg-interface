# 🚀 Iceberg Interface - Quick Deployment

## One-Click Deployment (Recommended)

```bash
# 1. Download code
git clone <repository-url>
cd iceberg-interface

# 2. Configure environment
cp .env.production .env
# Edit .env file to set API keys

# 3. One-click deploy
./deploy.sh deploy production

# 4. Access application
# HTTP: http://your-server-ip
# HTTPS: https://your-domain.com (SSL configuration required)
```

## 📋 Quick Checklist

### Server Requirements
- [ ] Ubuntu 18.04+ / CentOS 7+ / Debian 9+
- [ ] 2GB+ RAM, 20GB+ disk space
- [ ] Docker 20.10+
- [ ] Docker Compose 2.0+

### Network Requirements
- [ ] Port 80 open (HTTP)
- [ ] Port 443 open (HTTPS, optional)
- [ ] Port 8080 open (CORS proxy, optional)

### Configuration Requirements
- [ ] 1inch API key (required)
- [ ] Domain name resolution (required for HTTPS)
- [ ] SSL certificate (required for HTTPS)

## 🛠️ Install Docker (if not installed)

### Ubuntu/Debian
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### CentOS/RHEL
```bash
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

## ⚙️ Environment Configuration

Edit the `.env` file:

```env
# Required settings
REACT_APP_ONEINCH_API_KEY=your_1inch_api_key

# Optional settings
HTTP_PORT=80
HTTPS_PORT=443
DOMAIN=yourdomain.com
```

## 🔧 Management Commands

```bash
# Deploy/Update
./deploy.sh deploy production

# Check status
./deploy.sh status

# View logs
./deploy.sh logs

# Stop services
./deploy.sh stop

# Restart services
./deploy.sh restart production

# Complete cleanup
./deploy.sh cleanup
```

## 🌐 Enable HTTPS

### Method 1: Let's Encrypt (Recommended)
```bash
# Install certbot
sudo apt install certbot

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com

# Setup SSL
./deploy.sh ssl

# Redeploy
./deploy.sh deploy production
```

### Method 2: Self-signed Certificate (Testing)
```bash
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/CN=localhost"
```

## 🚨 Troubleshooting

### Application Not Accessible
```bash
# Check service status
./deploy.sh status

# Check logs
./deploy.sh logs

# Check ports
sudo netstat -tlnp | grep :80
```

### Insufficient Memory
```bash
# Check memory
free -h

# Add swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
```

### Docker Permission Issues
```bash
sudo usermod -aG docker $USER
newgrp docker
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost/health
```

### Resource Monitoring
```bash
docker stats
```

### Application Logs
```bash
./deploy.sh logs
```

## 🔄 Update Application

```bash
# Pull latest code
git pull origin main

# Redeploy
./deploy.sh deploy production
```

## 📞 Get Help

```bash
# View deployment script help
./deploy.sh help

# View detailed deployment documentation
cat DEPLOYMENT.md
```

---

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   Nginx Proxy    │────│  React App      │
│   (Optional)    │    │   + SSL/TLS      │    │  (Frontend)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                       ┌──────────────────┐
                       │   CORS Proxy     │
                       │   (Optional)     │
                       └──────────────────┘
```

## 🔐 Security Features

- **SSL/TLS Encryption** - HTTPS support with modern cipher suites
- **Security Headers** - HSTS, X-Frame-Options, CSP, etc.
- **CORS Configuration** - Proper cross-origin resource sharing
- **Rate Limiting** - Built-in nginx rate limiting
- **Health Monitoring** - Application health checks

## 🚀 Performance Optimizations

- **Static Asset Caching** - Long-term caching for static resources
- **Gzip Compression** - Reduced bandwidth usage
- **HTTP/2 Support** - Improved connection efficiency
- **Docker Multi-stage Build** - Optimized image size
- **Resource Limits** - Controlled memory and CPU usage

## 📈 Scaling Options

### Horizontal Scaling
```bash
# Scale with Docker Swarm
docker swarm init
docker stack deploy -c docker-compose.yml iceberg

# Scale with Kubernetes
kubectl apply -f k8s/
kubectl scale deployment iceberg-frontend --replicas=3
```

### Vertical Scaling
```bash
# Adjust resource limits in docker-compose.yml
services:
  iceberg-frontend:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
```

## 🌍 Multi-Environment Support

### Development
```bash
./deploy.sh deploy development
```

### Staging
```bash
cp .env.production .env.staging
# Edit staging-specific configurations
./deploy.sh deploy staging
```

### Production
```bash
./deploy.sh deploy production
```

## 📝 Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REACT_APP_ONEINCH_API_KEY` | 1inch API key | - | Yes |
| `REACT_APP_NETWORK` | Blockchain network | arbitrum | No |
| `HTTP_PORT` | HTTP port | 80 | No |
| `HTTPS_PORT` | HTTPS port | 443 | No |
| `DOMAIN` | Domain name | - | No |
| `ENABLE_HTTPS` | Enable HTTPS | false | No |

## 🎯 Production Deployment Checklist

- [ ] Server provisioned with adequate resources
- [ ] Docker and Docker Compose installed
- [ ] Firewall configured (ports 80/443 open)
- [ ] Domain name points to server IP
- [ ] SSL certificate obtained and configured
- [ ] API keys properly set in environment
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured
- [ ] Log rotation configured
- [ ] Security updates scheduled

---

**🎉 After deployment, your Iceberg Interface will be ready for production use!**

Access URLs:
- HTTP: `http://your-server-ip`
- HTTPS: `https://your-domain.com` (after SSL configuration)

For issues, please refer to `DEPLOYMENT.md` for detailed guidance.
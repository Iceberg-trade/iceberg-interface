#!/bin/bash

# Iceberg Interface 一键部署脚本
# 使用方法: ./deploy.sh [production|development]

set -e  # 出错时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker和Docker Compose
check_requirements() {
    log_info "检查系统要求..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log_success "系统要求检查通过"
}

# 环境变量设置
setup_environment() {
    local env=${1:-production}
    log_info "设置 $env 环境..."
    
    # 创建.env文件（如果不存在）
    if [ ! -f .env ]; then
        log_info "创建 .env 文件..."
        cat > .env << EOF
# 生产环境配置
NODE_ENV=$env
REACT_APP_NETWORK=arbitrum
REACT_APP_ONEINCH_API_KEY=your_api_key_here

# 可选：自定义端口
HTTP_PORT=80
HTTPS_PORT=443
CORS_PROXY_PORT=8080
EOF
        log_warning "请编辑 .env 文件设置您的API密钥"
    fi
}

# 构建和启动服务
deploy() {
    local env=${1:-production}
    
    log_info "开始部署 $env 环境..."
    
    # 停止现有容器
    log_info "停止现有容器..."
    docker-compose down --remove-orphans || true
    
    # 清理旧镜像（可选）
    if [ "$env" = "production" ]; then
        log_info "清理未使用的镜像..."
        docker system prune -f || true
    fi
    
    # 构建和启动
    log_info "构建镜像..."
    docker-compose build --no-cache
    
    log_info "启动服务..."
    docker-compose up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10
    
    # 健康检查
    health_check
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost/health > /dev/null 2>&1; then
            log_success "应用启动成功！"
            log_success "访问地址: http://localhost"
            return 0
        fi
        
        log_info "等待应用启动... ($attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_error "健康检查失败，请检查日志: docker-compose logs"
    return 1
}

# 显示日志
show_logs() {
    log_info "显示应用日志..."
    docker-compose logs -f --tail=50
}

# 停止服务
stop() {
    log_info "停止服务..."
    docker-compose down
    log_success "服务已停止"
}

# 完全清理
cleanup() {
    log_warning "这将删除所有容器、镜像和数据，是否继续？(y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "清理所有资源..."
        docker-compose down -v --rmi all --remove-orphans
        docker system prune -af
        log_success "清理完成"
    else
        log_info "取消清理操作"
    fi
}

# SSL证书设置 (可选)
setup_ssl() {
    log_info "设置SSL证书..."
    
    if [ ! -d "ssl" ]; then
        mkdir -p ssl
        log_info "SSL目录已创建，请将证书文件放入 ssl/ 目录"
        log_info "需要的文件: ssl/cert.pem, ssl/key.pem"
    fi
}

# 显示帮助
show_help() {
    echo "Iceberg Interface 部署脚本"
    echo ""
    echo "使用方法:"
    echo "  $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  deploy [env]     部署应用 (env: production|development, 默认: production)"
    echo "  stop             停止服务"
    echo "  restart [env]    重启服务"
    echo "  logs             显示日志"
    echo "  status           显示服务状态"
    echo "  cleanup          清理所有资源"
    echo "  ssl              设置SSL证书"
    echo "  help             显示帮助"
    echo ""
    echo "示例:"
    echo "  $0 deploy production    # 部署生产环境"
    echo "  $0 deploy development   # 部署开发环境"
    echo "  $0 logs                 # 查看日志"
    echo "  $0 stop                 # 停止服务"
}

# 显示服务状态
show_status() {
    log_info "服务状态:"
    docker-compose ps
    echo ""
    log_info "资源使用:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
}

# 主函数
main() {
    local command=${1:-deploy}
    local env=${2:-production}
    
    case $command in
        deploy)
            check_requirements
            setup_environment $env
            deploy $env
            ;;
        stop)
            stop
            ;;
        restart)
            stop
            sleep 2
            deploy $env
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        cleanup)
            cleanup
            ;;
        ssl)
            setup_ssl
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
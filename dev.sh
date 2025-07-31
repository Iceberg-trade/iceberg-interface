#!/bin/bash

echo "🚀 Starting Iceberg Interface with hot reload..."

# 函数：清理进程
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    pkill -f "cors-proxy-server.js" 2>/dev/null || true
    pkill -f "react-scripts start" 2>/dev/null || true
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM

# 停止现有进程
pkill -f "cors-proxy-server.js" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true
sleep 2

echo "🔄 Starting CORS Proxy Server..."
node cors-proxy-server.js &
CORS_PID=$!

# 等待代理服务器启动
sleep 3

echo "🔄 Starting React Development Server with hot reload..."
echo "📝 Press Ctrl+C to stop all services"
echo ""

# 前台运行React（支持热加载）
npm start

# 如果React退出，清理代理进程
cleanup
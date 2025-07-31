#!/bin/bash

echo "🚀 Starting Iceberg Development Environment..."

# 清理所有相关进程
echo "🧹 Cleaning up existing processes..."
pkill -f "cors-proxy-server.js" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true
sleep 3

# 启动CORS代理服务器
echo "🔄 Starting CORS Proxy Server..."
node cors-proxy-server.js > cors-proxy.log 2>&1 &
CORS_PID=$!
echo "✅ CORS Proxy started (PID: $CORS_PID)"

# 等待代理服务器启动
sleep 5

# 测试代理服务器
if curl -s "http://localhost:8080/api/1inch/swap/v6.0/42161/tokens" > /dev/null; then
    echo "✅ CORS Proxy is responding"
else
    echo "❌ CORS Proxy failed to start"
fi

# 启动React开发服务器
echo "🔄 Starting React Development Server..."
echo "📝 Frontend will be available at: http://localhost:3000"
echo "📝 API Proxy available at: http://localhost:8080"
echo ""
echo "🔥 Hot reload enabled - modify files to see changes"
echo "🛑 Press Ctrl+C to stop all services"
echo ""

# 前台运行React
BROWSER=none npm start
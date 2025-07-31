#!/bin/bash

echo "🔧 Setting up CORS proxy server..."

# 安装代理服务器依赖
echo "📦 Installing proxy dependencies..."
npm install express http-proxy-middleware cors --save-dev

echo "✅ CORS proxy dependencies installed!"
echo ""
echo "🚀 To start the CORS proxy server:"
echo "   node cors-proxy-server.js"
echo ""
echo "💡 Then update frontend to use:"
echo "   http://localhost:8080/api/1inch/swap/v6.1/42161/tokens"
echo ""
echo "🎯 This will bypass CORS restrictions!"
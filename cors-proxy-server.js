/**
 * 简单的CORS代理服务器
 * 使用方法: node cors-proxy-server.js
 * 然后前端请求: http://localhost:8080/api/1inch/tokens
 */

require('dotenv').config()
const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')
const cors = require('cors')

const app = express()
const PORT = 8080

// 启用CORS
app.use(cors())

// 代理1inch API - 简化版本，确保认证正确
app.use('/api/1inch', createProxyMiddleware({
  target: 'https://api.1inch.dev',
  changeOrigin: true,
  pathRewrite: {
    '^/api/1inch': ''
  },
  headers: {
    'Authorization': 'Bearer 5gU4nBVNQtfpyq9BTthSflfIR9cbVTgR',
    'Accept': 'application/json'
  },
  onProxyReq: (proxyReq, req, res) => {
    // 强制设置认证头
    proxyReq.setHeader('Authorization', 'Bearer 5gU4nBVNQtfpyq9BTthSflfIR9cbVTgR')
    proxyReq.setHeader('Accept', 'application/json')
    console.log(`🔄 Proxying: ${req.method} ${proxyReq.path}`)
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`📡 Response: ${proxyRes.statusCode} for ${req.url}`)
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error:', err.message)
    res.status(500).json({ error: 'Proxy error', message: err.message })
  }
}))

app.listen(PORT, () => {
  console.log(`🚀 CORS Proxy server running on http://localhost:${PORT}`)
  console.log(`📡 Proxying 1inch API requests`)
  console.log(`💡 Frontend can now call: http://localhost:${PORT}/api/1inch/swap/v6.0/42161/tokens`)
  console.log(`⚠️  Note: Using API v6.0 (v6.1 may not be available yet)`)
})
const express = require('express')
const cors = require('cors')
const axios = require('axios')

const app = express()
const PORT = 8080

app.use(cors())
app.use(express.json())

// 1inch代币列表API
app.get('/api/1inch/swap/v6.1/42161/tokens', async (req, res) => {
  try {
    const apiUrl = 'https://api.1inch.dev/swap/v6.1/42161/tokens'
    const apiKey = '5gU4nBVNQtfpyq9BTthSflfIR9cbVTgR'
    
    console.log(`🔄 Proxying tokens: ${apiUrl}`)
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      }
    })
    
    console.log(`✅ Tokens success: ${response.status}`)
    res.json(response.data)
    
  } catch (error) {
    console.error('❌ Tokens proxy error:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Tokens proxy failed',
      message: error.message
    })
  }
})

// 1inch价格报价API
app.get('/api/1inch/swap/v6.1/42161/quote', async (req, res) => {
  try {
    const apiUrl = 'https://api.1inch.dev/swap/v6.1/42161/quote'
    const apiKey = '5gU4nBVNQtfpyq9BTthSflfIR9cbVTgR'
    
    console.log(`🔄 Proxying quote: ${apiUrl}`, req.query)
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      params: req.query
    })
    
    console.log(`✅ Quote success: ${response.status}`)
    res.json(response.data)
    
  } catch (error) {
    console.error('❌ Quote proxy error:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Quote proxy failed',
      message: error.message,
      details: error.response?.data
    })
  }
})

// 1inch交换API (用于获取实际swap交易数据传递给合约)
app.get('/api/1inch/swap/v6.1/42161/swap', async (req, res) => {
  try {
    const apiUrl = 'https://api.1inch.dev/swap/v6.1/42161/swap'
    const apiKey = '5gU4nBVNQtfpyq9BTthSflfIR9cbVTgR'
    
    console.log(`🔄 Proxying swap: ${apiUrl}`, req.query)
    
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      params: req.query
    })
    
    console.log(`✅ Swap success: ${response.status}`)
    res.json(response.data)
    
  } catch (error) {
    console.error('❌ Swap proxy error:', error.message)
    res.status(error.response?.status || 500).json({
      error: 'Swap proxy failed',
      message: error.message,
      details: error.response?.data
    })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Simple CORS proxy running on http://localhost:${PORT}`)
  console.log(`📡 Ready to proxy 1inch API requests`)
})
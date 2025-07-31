import { Input, Button, Spin, message } from 'antd'
import { ArrowDownOutlined, CopyOutlined } from '@ant-design/icons'
import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { useProvider, useSigner } from 'wagmi'
import { executeIcebergSwap, get1inchQuote as getIcebergQuote } from '../utils/icebergSwap'
import axios from 'axios'

function SwapStep({ depositData, onNext, isConnected, address, setCurrentTransaction }) {
  const [targetToken, setTargetToken] = useState(null)
  const [targetTokens, setTargetTokens] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchToken, setSearchToken] = useState('')
  const [messageApi, contextHolder] = message.useMessage()
  const [secret, setSecret] = useState('')
  const [estimatedOutput, setEstimatedOutput] = useState('0')
  const [isLoadingPrice, setIsLoadingPrice] = useState(false)
  const provider = useProvider()
  const { data: signer } = useSigner()

  // 初始化时设置默认目标代币
  useEffect(() => {
    const sourceToken = depositData.tokenA
    
    // 设置一个默认的目标代币（通常选择USDC）
    const defaultTargetToken = {
      address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      name: 'USD Coin',
      ticker: 'USDC',
      decimals: 6,
      img: 'https://tokens.1inch.io/0xaf88d065e77c8cc2239327c5edb3a432268e5831.png'
    }
    
    // 如果源代币不是USDC，则设置USDC为默认目标
    if ((sourceToken.tokenAddress || sourceToken.address || '').toLowerCase() !== defaultTargetToken.address.toLowerCase()) {
      setTargetToken(defaultTargetToken)
    } else {
      // 如果源代币是USDC，则设置ETH为默认目标
      setTargetToken({
        address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        name: 'Ether',
        ticker: 'ETH',
        decimals: 18,
        img: 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
      })
    }
    
    console.log('✅ Default target token set')
  }, [depositData])


  // 获取模拟价格
  const getMockPrice = (sourceToken, targetToken, amount) => {
    const mockRates = {
      'usdc-usdt': '0.999', 'usdt-usdc': '1.001',
      'usdc-eth': '0.0004', 'eth-usdc': '2500',
      'usdt-eth': '0.0004', 'eth-usdt': '2500',
      'usdc-weth': '0.0004', 'weth-usdc': '2500',
      'usdc-wbtc': '0.000016', 'wbtc-usdc': '62500',
      'usdc-arb': '0.6', 'arb-usdc': '1.67',
      'eth-arb': '1500', 'arb-eth': '0.00067'
    }
    
    const srcSymbol = getTokenSymbol(sourceToken)
    const dstSymbol = getTokenSymbol(targetToken)
    const rateKey = `${srcSymbol}-${dstSymbol}`
    const rate = mockRates[rateKey] || '1.0'
    
    const inputAmount = parseFloat(ethers.utils.formatUnits(amount, sourceToken.decimals || 18))
    const outputAmount = inputAmount * parseFloat(rate)
    const result = ethers.utils.parseUnits(outputAmount.toFixed(targetToken.decimals || 18), targetToken.decimals || 18)
    
    return {
      raw: result.toString(),
      formatted: outputAmount.toFixed(6),
      rate: rate
    }
  }

  // 获取代币符号用于模拟价格
  const getTokenSymbol = (token) => {
    const address = token.tokenAddress || token.address || ''
    if (address === ethers.constants.AddressZero || address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
      return 'eth'
    }
    if (address.toLowerCase() === '0xaf88d065e77c8cc2239327c5edb3a432268e5831') return 'usdc'
    if (address.toLowerCase() === '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9') return 'usdt'
    if (address.toLowerCase() === '0x82af49447d8a07e3bd95bd0d56f35241523fbab1') return 'weth'
    if (address.toLowerCase() === '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f') return 'wbtc'
    if (address.toLowerCase() === '0x912ce59144191c1204e64559fe8253a0e49e6548') return 'arb'
    return token.ticker?.toLowerCase() || 'unknown'
  }

  // 获取1inch真实价格
  const get1inchPrice = async (srcToken, dstToken, amount) => {
    try {
      setIsLoadingPrice(true)
      
      console.log('🔄 Getting real 1inch price quote...')
      console.log('  Source:', srcToken)
      console.log('  Destination:', dstToken)
      console.log('  Amount:', amount)
      
      const result = await getIcebergQuote(srcToken, dstToken, amount, 42161)
      
      console.log('✅ 1inch price result:', result)
      return result
      
    } catch (error) {
      console.error('❌ Failed to get 1inch price:', error)
      
      // 如果API失败，回退到模拟价格
      console.log('🎭 Falling back to mock pricing...')
      
      const mockRates = {
        'usdc-usdt': '0.999',
        'usdt-usdc': '1.001',
        'usdc-eth': '0.0004',
        'eth-usdc': '2500',
        'usdt-eth': '0.0004', 
        'eth-usdt': '2500'
      }
      
      const srcSymbol = srcToken === ethers.constants.AddressZero ? 'eth' : 
                       srcToken === '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' ? 'usdc' : 'usdt'
      const dstSymbol = dstToken === ethers.constants.AddressZero ? 'eth' :
                       dstToken === '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' ? 'usdc' : 'usdt'
      
      const rateKey = `${srcSymbol}-${dstSymbol}`
      const rate = mockRates[rateKey] || '1.0'
      
      const inputAmount = parseFloat(ethers.utils.formatUnits(amount, srcSymbol === 'eth' ? 18 : 6))
      const outputAmount = inputAmount * parseFloat(rate)
      const outputDecimals = dstSymbol === 'eth' ? 18 : 6
      const result = ethers.utils.parseUnits(outputAmount.toFixed(outputDecimals), outputDecimals)
      
      return result.toString()
      
    } finally {
      setIsLoadingPrice(false)
    }
  }

  // 当默认目标代币设置后获取价格
  useEffect(() => {
    if (targetToken && depositData.tokenA) {
      getRealPrice(targetToken)
    }
  }, [targetToken, depositData.tokenAAmount])

  const handleSwap = async () => {
    if (!isConnected) {
      messageApi.error('Please connect your wallet first')
      return
    }

    if (!secret) {
      messageApi.error('Please enter secret')
      return
    }

    if (!targetToken) {
      messageApi.error('Please select target token')
      return
    }

    try {
      messageApi.loading('Executing swap...', 0)
      
      // 获取源代币信息
      const sourceToken = depositData.tokenA
      const tokenIn = sourceToken.tokenAddress || sourceToken.address || ethers.constants.AddressZero
      const tokenOut = targetToken.address // 使用1inch API的原始地址格式
      const fixedAmount = ethers.utils.parseUnits(
        depositData.tokenAAmount || '1',
        sourceToken.decimals || 18
      )
      const swapConfigId = depositData.depositData?.swapConfigId || depositData.tokenA?.configId || 1

      // 使用封装的 Iceberg swap 函数
      const swapResult = await executeIcebergSwap({
        secret,
        swapConfigId,
        tokenIn,
        tokenOut,
        fixedAmount,
        decimalsIn: sourceToken.decimals || 18,
        decimalsOut: targetToken.decimals || 18,
        signer,
        provider,
        userAddress: address
      })
      
      messageApi.destroy()
      messageApi.success('Swap executed successfully!')
      
      // 构建完整的 swap 结果数据
      const completeSwapResult = {
        tokenOut: targetToken,
        amountOut: swapResult.formattedOutput,
        nullifierHashHex: swapResult.nullifierHashHex,
        swapConfigId: swapResult.swapConfigId,
        transactionHash: swapResult.transactionHash,
        timestamp: swapResult.timestamp,
        gasUsed: swapResult.gasUsed,
        executor: swapResult.executor,
        expectedOutput: swapResult.expectedOutput
      }
      
      // 设置交易数据并跳转到下一步
      const completeSwapData = {
        ...depositData,
        swapResult: completeSwapResult,
        step: 'withdraw'
      }
      
      // 获取网络信息用于transaction notification
      const network = await provider.getNetwork()
      
      // 为TransactionNotification设置正确的transaction对象结构
      setCurrentTransaction({
        hash: swapResult.transactionHash,
        network: network.chainId === 42161 ? 'arbitrum' : 'ethereum',
        type: 'swap',
        status: 'success'
      })
      
      onNext(completeSwapData)
      
    } catch (error) {
      console.error('❌ Swap failed:', error)
      messageApi.destroy()
      
      if (error.message.includes('1inch API')) {
        messageApi.error('1inch API error: ' + error.message)
      } else if (error.message.includes('CORS')) {
        messageApi.error('CORS proxy error - please ensure proxy server is running')
      } else {
        messageApi.error('Swap execution failed: ' + error.message)
      }
    }
  }

  // 在用户点击时获取真实1inch代币列表
  const loadRealTokenList = async () => {
    if (targetTokens.length > 0) {
      // 如果已经加载过代币列表，直接返回
      return
    }
    
    try {
      console.log('🔄 Loading real token list from 1inch API...')
      setIsLoading(true)
      
      const apiUrl = 'https://api.1inch.dev/swap/v6.0/42161/tokens'
      const apiKey = process.env.REACT_APP_ONEINCH_API_KEY
      
      // 尝试多种CORS代理方法
      const proxyMethods = [
        // 方法1: 本地CORS代理 (最佳方案)
        {
          name: 'local-proxy',
          url: 'http://localhost:8080/api/1inch/swap/v6.0/42161/tokens'
        },
        // 方法2: allorigins (公共代理)
        {
          name: 'allorigins',
          url: `https://api.allorigins.win/get?url=${encodeURIComponent(apiUrl)}`,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        },
        // 方法3: cors-anywhere (需要激活)
        {
          name: 'cors-anywhere',
          url: `https://cors-anywhere.herokuapp.com/${apiUrl}`,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        },
        // 方法4: corsproxy
        {
          name: 'corsproxy',
          url: `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`,
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json'
          }
        }
      ]
      
      let response = null
      let lastError = null
      
      for (const method of proxyMethods) {
        try {
          console.log(`🔄 Trying ${method.name} proxy...`)
          
          const requestConfig = {
            timeout: 10000,
            headers: method.headers || {}
          }
          
          response = await axios.get(method.url, requestConfig)
          
          // 特殊处理allorigins返回格式
          if (method.name === 'allorigins' && response.data && response.data.contents) {
            try {
              response.data = JSON.parse(response.data.contents)
            } catch (e) {
              console.log('Failed to parse allorigins response')
              continue
            }
          }
          
          if (response.data) {
            console.log(`✅ Success with ${method.name} proxy!`)
            break
          }
        } catch (error) {
          console.log(`❌ ${method.name} proxy failed:`, error.message)
          lastError = error
          continue
        }
      }
      
      if (!response || !response.data) {
        throw lastError || new Error('All proxy methods failed')
      }
      
      const tokenData = response.data.tokens || response.data
      console.log(`✅ Successfully loaded ${Object.keys(tokenData).length} tokens from 1inch API`)
      
      // 转换为组件需要的格式
      const sourceToken = depositData.tokenA
      const availableTokens = Object.values(tokenData)
        .map(token => ({
          address: token.address, // 保持1inch API的原始地址格式
          name: token.name,
          ticker: token.symbol,
          decimals: token.decimals,
          img: token.logoURI || `https://tokens.1inch.io/${token.address.toLowerCase()}.png`
        }))
        .filter(token => 
          token.address.toLowerCase() !== (sourceToken.tokenAddress || sourceToken.address || '').toLowerCase()
        )
      
      setTargetTokens(availableTokens)
      messageApi.success(`Successfully loaded ${availableTokens.length} tokens from 1inch API`)
      
    } catch (error) {
      console.error('❌ Failed to load 1inch token list:', error)
      
      if (error.code === 'ERR_NETWORK' || error.message.includes('CORS')) {
        messageApi.error('1inch API blocked by CORS policy. Unable to fetch real token list.')
      } else if (error.response?.status === 401) {
        messageApi.error('1inch API authentication failed. Please check API key.')
      } else {
        messageApi.error('Failed to load token list from 1inch API.')
      }
      
      console.log('ℹ️ User requested real API call - this error is expected due to CORS')
    } finally {
      setIsLoading(false)
    }
  }

  // 打开代币选择模态框
  const openTokenModal = async () => {
    setIsModalOpen(true)
    await loadRealTokenList()
  }

  const selectToken = async (token) => {
    setTargetToken(token)
    setIsModalOpen(false)
    setSearchToken('')
    
    // 选中代币后立即获取真实价格
    await getRealPrice(token)
  }

  // 获取真实1inch价格
  const getRealPrice = async (token) => {
    if (!token || !depositData.tokenA) return

    try {
      setIsLoadingPrice(true)
      console.log('🔄 Getting real 1inch price for selected token...')
      
      const sourceToken = depositData.tokenA
      const sourceAmount = ethers.utils.parseUnits(
        depositData.tokenAAmount || '1',
        sourceToken.decimals || 18
      ).toString()
      
      // 标准化代币地址
      const srcAddress = (sourceToken.tokenAddress || sourceToken.address || '').toLowerCase()
      const dstAddress = token.address === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
        : token.address.toLowerCase()
      
      console.log('Price request:', {
        src: srcAddress,
        dst: dstAddress, 
        amount: sourceAmount
      })
      
      // 使用封装的 Iceberg quote 函数获取1inch真实价格
      const outputAmount = await getIcebergQuote(srcAddress, dstAddress, sourceAmount, 42161)
      
      if (outputAmount) {
        const formatted = ethers.utils.formatUnits(outputAmount, token.decimals)
        setEstimatedOutput(parseFloat(formatted).toFixed(5))
        
        console.log('✅ Real 1inch price received:', formatted)
        messageApi.success(`Real-time price updated via 1inch API`)
      } else {
        throw new Error('Invalid response format')
      }
      
    } catch (error) {
      console.error('❌ Failed to get real 1inch price:', error)
      
      // 降级到模拟价格
      console.log('🎭 Falling back to mock pricing...')
      const mockPrice = getMockPrice(depositData.tokenA, token, ethers.utils.parseUnits(
        depositData.tokenAAmount || '1',
        depositData.tokenA.decimals || 18
      ).toString())
      
      setEstimatedOutput(mockPrice.formatted)
      messageApi.warning('Using mock price (1inch API unavailable)')
      
    } finally {
      setIsLoadingPrice(false)
    }
  }

  const filteredTokens = targetTokens.filter(token => 
    token.name.toLowerCase().includes(searchToken.toLowerCase()) ||
    token.ticker.toLowerCase().includes(searchToken.toLowerCase())
  )

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    messageApi.success('Secret copied to clipboard!')
  }


  if (isLoading) {
    return (
      <div className="tradeBox" style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px', fontSize: '16px' }}>
          Swapping tokens...
        </div>
      </div>
    )
  }

  return (
    <>
      {contextHolder}
      {isModalOpen && (
        <div className="modalOverlay" onClick={() => {setIsModalOpen(false); setSearchToken('')}}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h4>Select a token</h4>
              <div className="modalClose" onClick={() => {setIsModalOpen(false); setSearchToken('')}}>
                ×
              </div>
            </div>
            
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px', fontSize: '14px', color: '#8B949E' }}>
                  Loading tokens from 1inch API...
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px', color: '#ff4d4f' }}>
                  Note: May fail due to CORS restrictions
                </div>
              </div>
            ) : filteredTokens.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8B949E' }}>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                  No tokens loaded
                </div>
                <div style={{ fontSize: '12px' }}>
                  1inch API call failed due to browser CORS policy
                </div>
              </div>
            ) : null}
            
            {!isLoading && filteredTokens?.map((token, index) => (
              <div 
                className='tokenChoice' 
                key={index} 
                onClick={() => selectToken(token)}
              >
                <img src={token.img} alt={token.ticker} className="tokenLogo"/>
                <div className='tokenChoiceNames'>
                  <div className='tokenName'>{token.name}</div>
                  <div className='tokenTicker'>{token.ticker}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='tradeBox'>
        <div className='tradeBoxHeader'>
          <h4>Swap</h4>
        </div>
        
        <div className='inputs'>
          {/* Source Token (From Deposit) - Read Only */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#8B949E' }}>
              From (Source Asset)
            </div>
            <input 
              className='tokenAmountInput'
              placeholder='0' 
              value={depositData.tokenAAmount} 
              disabled={true}
              style={{ 
                backgroundColor: '#1a1d26', 
                cursor: 'not-allowed',
                marginBottom: '10px'
              }}
            />
            <div className='assetOne' style={{ position: 'relative', top: 0, right: 0, marginBottom: '10px' }}>
              <img src={depositData.tokenA.img} alt="sourcelogo" className='logo'/>
              {depositData.tokenA.ticker}
              {depositData.tokenA.configId && (
                <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '4px' }}>
                  (#{depositData.tokenA.configId})
                </span>
              )}
            </div>
          </div>

          <div className="switchButton" style={{ position: 'relative', margin: '10px auto' }}>
            <ArrowDownOutlined className='switchArrow'/>
          </div>

          {/* Target Token Selection */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#8B949E' }}>
              To (Target Asset)
            </div>
            <input 
              className='tokenAmountInput'
              placeholder='0' 
              value={isLoadingPrice ? 'Loading...' : estimatedOutput} 
              disabled={true}
              style={{ 
                backgroundColor: '#1a1d26', 
                cursor: 'not-allowed',
                marginBottom: '10px'
              }}
            />
            <div className='assetTwo' onClick={openTokenModal} style={{ position: 'relative', top: 0, right: 0 }}>
              {targetToken ? (
                <>
                  <img src={targetToken.img} alt="targetlogo" className='logo' />
                  {targetToken.ticker}
                </>
              ) : (
                'Select Token'
              )}
            </div>
          </div>

          {/* Secret Input */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#8B949E' }}>
              Secret (from deposit)
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Input.Password 
                placeholder='Enter your secret from deposit step'
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                style={{ flex: 1 }}
              />
              {secret && (
                <Button 
                  icon={<CopyOutlined />} 
                  onClick={copySecret}
                  title="Copy secret"
                  size="large"
                  type="primary"
                />
              )}
            </div>
            <div style={{ 
              fontSize: '12px', 
              color: '#ff4d4f', 
              marginTop: '4px',
              fontStyle: 'italic'
            }}>
              * Use the same secret from your deposit step
            </div>
          </div>
        </div>

        <Button 
          className='swapButton'
          onClick={handleSwap}
          disabled={!isConnected || !secret || !targetToken}
          block
          size="large"
          type="primary"
        >
          Swap
        </Button>

        <div style={{ 
          marginTop: '15px', 
          padding: '10px', 
          backgroundColor: '#212429', 
          borderRadius: '8px',
          fontSize: '12px',
          color: '#8B949E'
        }}>
          <div>From: {depositData.depositAddress}</div>
          {targetToken && (
            <div>
              Rate: 1 {depositData.tokenA.ticker} ≈ {
                estimatedOutput && parseFloat(estimatedOutput) > 0 
                  ? (parseFloat(estimatedOutput) / parseFloat(depositData.tokenAAmount || 1)).toFixed(6)
                  : '...'
              } {targetToken.ticker} {isLoadingPrice && '(Loading...)'}
            </div>
          )}
          <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
            💡 {
              isLoadingPrice ? 'Loading prices...' : 
              targetTokens.length > 0 ? `Real token list: ${targetTokens.length} tokens from 1inch API` :
              'Click target asset to load real 1inch token list'
            }
          </div>
        </div>
      </div>
    </>
  )
}

export default SwapStep
import { Input, Button, Spin, message, Modal } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import tokenList from '../tokenList.json'
import { useProvider, useSigner } from 'wagmi'
import { getDepositAssets, getIcebergAddress } from '../utils/getDepositAssets'
import { executeDeposit, checkTokenBalance } from '../utils/depositUtils'
import { ethers } from 'ethers'

function Deposit({ onNext, isConnected, address, setCurrentTransaction }) {
  const [selectedToken, setSelectedToken] = useState(null)
  const [tokenAmount, setTokenAmount] = useState('')
  const [secret, setSecret] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchToken, setSearchToken] = useState('')
  const [isGeneratingSecret, setIsGeneratingSecret] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  const [depositAssets, setDepositAssets] = useState([])
  const [isLoadingAssets, setIsLoadingAssets] = useState(false)
  const [isDepositing, setIsDepositing] = useState(false)
  const [depositProgress, setDepositProgress] = useState('')
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const provider = useProvider()
  const { data: signer } = useSigner()
  
  // 获取可用的存款资产列表
  useEffect(() => {
    const fetchDepositAssets = async () => {
      // 如果没有连接，使用默认列表
      if (!provider || !isConnected) {
        setDepositAssets(tokenList)
        setSelectedToken(tokenList[0])
        setTokenAmount('') // 未连接时使用默认列表
        return
      }
      
      setIsLoadingAssets(true)
      try {
        console.log('Fetching deposit assets...')
        console.log('Provider:', provider)
        console.log('Connected:', isConnected)
        
        const poolAddress = await getIcebergAddress()
        console.log('Pool address:', poolAddress)
        
        // 获取网络信息
        const network = await provider.getNetwork()
        console.log('Network:', network.name, 'Chain ID:', network.chainId)
        
        const assets = await getDepositAssets(poolAddress, provider)
        console.log('Fetched assets:', assets)
        
        if (assets.length > 0) {
          // 将资产列表转换为与 tokenList 兼容的格式
          const formattedAssets = assets.map(asset => ({
            ...asset,
            name: asset.tokenName,
            ticker: asset.tokenSymbol,
            decimals: asset.decimals
          }))
          
          setDepositAssets(formattedAssets)
          setSelectedToken(formattedAssets[0])
          // 设置第一个资产的固定金额
          setTokenAmount(formattedAssets[0]?.fixedAmountFormatted || '')
          messageApi.success(`Loaded ${assets.length} deposit configurations`)
        } else {
          // 如果没有找到资产，使用默认列表
          setDepositAssets(tokenList)
          setSelectedToken(tokenList[0])
          setTokenAmount('') // 默认列表没有固定金额
          messageApi.warning('No deposit configurations found, using default tokens')
        }
      } catch (error) {
        console.error('Failed to fetch deposit assets:', error)
        console.error('Error details:', error.message)
        messageApi.error(`Failed to load available assets: ${error.message}`)
        setDepositAssets(tokenList)
        setSelectedToken(tokenList[0])
        setTokenAmount('') // 错误情况下使用默认列表
      } finally {
        setIsLoadingAssets(false)
      }
    }
    
    fetchDepositAssets()
  }, [provider, isConnected, messageApi])
  

  const generateSecret = () => {
    setIsGeneratingSecret(true)
    
    // 使用本地加密安全的方法生成唯一secret
    let generatedSecret
    
    if (window.crypto && window.crypto.randomUUID) {
      // 现代浏览器支持crypto.randomUUID()
      generatedSecret = window.crypto.randomUUID()
    } else if (window.crypto && window.crypto.getRandomValues) {
      // 使用crypto.getRandomValues()生成更安全的随机数
      const array = new Uint8Array(16)
      window.crypto.getRandomValues(array)
      generatedSecret = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
    } else {
      // 降级方案：使用时间戳和高质量随机数组合
      const timestamp = Date.now().toString(36)
      const randomPart1 = Math.random().toString(36).substring(2, 15)
      const randomPart2 = Math.random().toString(36).substring(2, 15)
      generatedSecret = `${timestamp}-${randomPart1}-${randomPart2}`
    }
    
    setSecret(generatedSecret)
    messageApi.success('Secret generated successfully! Please save it for withdrawal.')
    setIsGeneratingSecret(false)
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    messageApi.success('Secret copied to clipboard!')
  }

  // 表单验证：对于有固定金额的资产，不需要用户输入金额
  const isFormValid = address && secret && selectedToken && 
    (selectedToken?.fixedAmountFormatted || tokenAmount)

  const handleDeposit = async () => {
    if (!isConnected) {
      messageApi.error('Please connect your wallet first')
      return
    }
    
    if (!isFormValid) {
      messageApi.error('Please fill in all fields')
      return
    }

    if (!signer) {
      messageApi.error('Signer not available')
      return
    }

    // Show confirmation modal first
    setIsConfirmModalOpen(true)
  }

  const executeDepositTransaction = async () => {
    try {
      console.log('🚀 Starting executeDepositTransaction...')
      console.log('Selected token:', selectedToken)
      console.log('User address:', address)
      console.log('Secret:', secret)
      console.log('Signer:', signer)
      
      if (!selectedToken) {
        console.error('❌ No token selected')
        messageApi.error('Please select a token first')
        setIsDepositing(false)
        return
      }
      
      if (!address) {
        console.error('❌ No user address')
        messageApi.error('Please connect your wallet')
        setIsDepositing(false)
        return
      }
      
      if (!secret) {
        console.error('❌ No secret generated')
        messageApi.error('Please generate a secret first')
        setIsDepositing(false)
        return
      }
      
      if (!signer) {
        console.error('❌ No signer available')
        messageApi.error('Wallet signer not available')
        setIsDepositing(false)
        return
      }
      
      setIsDepositing(true)
      setIsConfirmModalOpen(false)
      setDepositProgress('Please sign the transaction in your wallet...')
      
      // 验证signer账户与连接的账户是否一致
      const signerAddress = await signer.getAddress()
      console.log('Signer account:', signerAddress)
      console.log('Connected account:', address)
      
      if (signerAddress.toLowerCase() !== address.toLowerCase()) {
        console.error('❌ Account mismatch:', { signerAddress, connectedAddress: address })
        messageApi.error(`Account mismatch! Please switch to account ${address} in your wallet and try again.`)
        setIsDepositing(false)
        return
      }
      
      console.log('✅ Account verification passed')
      
      // 首先请求用户签名确认
      console.log('✍️ Requesting user signature...')
      const message = `Confirm deposit of ${selectedToken?.fixedAmountFormatted || tokenAmount} ${selectedToken?.ticker} to Iceberg Protocol\n\nAccount: ${address}`
      
      try {
        const signature = await signer.signMessage(message)
        console.log('✅ User signed the message:', signature)
        setDepositProgress('Signature confirmed, executing real transaction...')
      } catch (signError) {
        console.error('❌ User rejected signature:', signError)
        messageApi.error('Transaction cancelled by user')
        await showErrorNotification('Transaction cancelled by user', `Deposit ${selectedToken?.fixedAmountFormatted || tokenAmount} ${selectedToken?.ticker}`)
        setIsDepositing(false)
        return
      }
      
      console.log('🚀 Signature completed, now executing real blockchain transaction...')
      
      console.log('📡 Getting pool address...')
      const poolAddress = await getIcebergAddress()
      console.log('Pool address:', poolAddress)
      
      if (!poolAddress) {
        console.error('❌ Failed to get pool address')
        messageApi.error('Failed to get contract address')
        setIsDepositing(false)
        return
      }
      
      console.log('💰 Checking user balance...')
      console.log('Token address:', selectedToken.tokenAddress)
      console.log('Fixed amount:', selectedToken.fixedAmount)
      console.log('Provider:', provider)
      
      if (!selectedToken.fixedAmount) {
        console.error('❌ No fixed amount found for selected token')
        messageApi.error('Invalid token configuration - no fixed amount')
        setIsDepositing(false)
        return
      }
      
      // Check if user has enough balance for the selected asset
      const hasBalance = await checkTokenBalance(
        selectedToken.tokenAddress,
        address,
        ethers.BigNumber.from(selectedToken.fixedAmount),
        provider
      )
      
      console.log('Balance check result:', hasBalance)
      
      if (!hasBalance) {
        console.error('❌ Insufficient balance')
        messageApi.error('Insufficient balance for this deposit')
        
        // 显示失败的交易通知
        await showErrorNotification('Insufficient balance for this deposit', `Deposit ${selectedToken?.fixedAmountFormatted || tokenAmount} ${selectedToken?.ticker}`)
        
        setIsDepositing(false)
        return
      }
      
      console.log('✅ Balance check passed, starting deposit execution...')
      console.log('🔧 Calling executeDeposit with parameters:')
      console.log('  - poolAddress:', 'will be fetched')
      console.log('  - selectedAsset:', selectedToken)
      console.log('  - secret:', secret)
      console.log('  - signer:', signer ? 'available' : 'not available')
      
      console.log('🚀 About to call executeDeposit...')
      console.log('Parameters:', {
        poolAddress,
        selectedAsset: selectedToken,
        secret: secret ? 'present' : 'missing',
        signer: signer ? 'present' : 'missing'
      })
      
      // 执行真实的deposit交易
      const result = await executeDeposit({
        poolAddress,
        selectedAsset: selectedToken,
        secret,
        signer,
        onProgress: (progress) => {
          setDepositProgress(progress)
        },
        onTransactionSent: (txHash) => {
          console.log('📤 Transaction sent:', txHash)
          // 设置pending通知
          getCurrentNetwork().then(network => {
            setCurrentTransaction({
              hash: txHash,
              status: 'pending',
              type: `Deposit ${selectedToken?.fixedAmountFormatted || tokenAmount} ${selectedToken?.ticker}`,
              network
            })
          })
        }
      })
      
      if (result.success) {
        console.log('✅ Deposit successful:', result)
        messageApi.success('Deposit completed successfully!')
        
        // 设置成功通知
        const currentNetwork = await getCurrentNetwork()
        setCurrentTransaction({
          hash: result.receipt.transactionHash,
          status: 'success',
          type: `Deposit ${selectedToken?.fixedAmountFormatted || tokenAmount} ${selectedToken?.ticker}`,
          network: currentNetwork
        })
        
        // 跳转到下一步
        setTimeout(() => {
          console.log('✅ Redirecting to swap interface...')
          setIsDepositing(false)
          onNext({
            depositAddress: address,
            tokenA: selectedToken,
            tokenAAmount: selectedToken?.fixedAmountFormatted || tokenAmount,
            secret,
            depositData: result.data,
            transactionHash: result.receipt.transactionHash
          })
        }, 2000)
      } else {
        throw new Error('Deposit failed')
      }
      
    } catch (error) {
      console.error('❌ Deposit failed:', error)
      console.error('Error stack:', error.stack)
      messageApi.error(`Deposit failed: ${error.message}`)
      await showErrorNotification(`Deposit failed: ${error.message}`, `Deposit ${selectedToken?.fixedAmountFormatted || tokenAmount} ${selectedToken?.ticker}`)
      setIsDepositing(false)
      setDepositProgress('')
    }
  }

  const selectToken = (token) => {
    setSelectedToken(token)
    // 自动设置该资产的固定金额
    setTokenAmount(token.fixedAmountFormatted || '')
    setIsModalOpen(false)
    setSearchToken('')
  }

  // 获取当前网络名称
  const getCurrentNetwork = async () => {
    if (!provider) return 'arbitrum'
    try {
      const network = await provider.getNetwork()
      if (network.chainId === 42161) return 'arbitrum'
      if (network.chainId === 1) return 'ethereum'
      return 'arbitrum' // 默认
    } catch {
      return 'arbitrum'
    }
  }


  // 显示错误通知的辅助函数
  const showErrorNotification = async (errorMessage, transactionType = 'Transaction') => {
    try {
      const currentNetwork = await getCurrentNetwork()
      setCurrentTransaction({
        hash: '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        status: 'failed',
        type: transactionType,
        network: currentNetwork,
        error: errorMessage
      })
    } catch (error) {
      console.error('Failed to show error notification:', error)
    }
  }

  const filteredTokens = depositAssets.filter(token => 
    token.name.toLowerCase().includes(searchToken.toLowerCase()) ||
    token.ticker.toLowerCase().includes(searchToken.toLowerCase())
  )

  if (isDepositing) {
    return (
      <div className="tradeBox" style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px', fontSize: '16px' }}>
          {depositProgress || 'Processing deposit...'}
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
            {filteredTokens?.map((token, index) => (
              <div 
                className='tokenChoice' 
                key={index} 
                onClick={() => selectToken(token)}
              >
                <img src={token.img} alt={token.ticker} className="tokenLogo"/>
                <div className='tokenChoiceNames'>
                  <div className='tokenName'>{token.name}</div>
                  <div className='tokenTicker'>
                    {token.ticker}
                    {token.configId && (
                      <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '4px' }}>
                        Config #{token.configId}
                      </span>
                    )}
                  </div>
                  {token.fixedAmountFormatted && (
                    <div style={{ fontSize: '10px', color: '#666' }}>
                      Fixed: {token.fixedAmountFormatted} {token.ticker}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className='tradeBox'>
        <div className='tradeBoxHeader'>
          <h4>Deposit</h4>
        </div>
        
        <div className='inputs'>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#8B949E' }}>
              Deposit Address (Current Wallet)
            </div>
            <Input 
              placeholder='Connect wallet to see address' 
              value={address || ''} 
              disabled={true}
              style={{ backgroundColor: '#1a1d26', color: '#999' }}
            />
          </div>

          <div className='inputs'>
            <input 
              className='tokenAmountInput'
              placeholder={selectedToken?.fixedAmountFormatted ? selectedToken.fixedAmountFormatted : '0'} 
              value={tokenAmount} 
              onChange={(e) => setTokenAmount(e.target.value)}
              readOnly={!!selectedToken?.fixedAmountFormatted}
              style={{ 
                backgroundColor: selectedToken?.fixedAmountFormatted ? '#1a1d26' : 'transparent',
                cursor: selectedToken?.fixedAmountFormatted ? 'not-allowed' : 'text'
              }}
            />
            <div 
              className='assetOne' 
              onClick={() => setIsModalOpen(true)}
            >
              {isLoadingAssets ? (
                <Spin size="small" />
              ) : selectedToken ? (
                <>
                  <img src={selectedToken.img} alt="assetOnelogo" className='logo'/>
                  {selectedToken.ticker}
                  {selectedToken.configId && (
                    <span style={{ fontSize: '10px', opacity: 0.7, marginLeft: '4px' }}>
                      (#{selectedToken.configId})
                    </span>
                  )}
                </>
              ) : (
                'Select Token'
              )}
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexDirection: 'column' }}>
              {!secret ? (
                <Button 
                  onClick={generateSecret}
                  loading={isGeneratingSecret}
                  block
                  size="large"
                  type="primary"
                  style={{ marginBottom: '8px' }}
                >
                  Generate Secret Code
                </Button>
              ) : (
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <Input.Password 
                      value={secret} 
                      readOnly
                      style={{ flex: 1 }}
                    />
                    <Button 
                      icon={<CopyOutlined />} 
                      onClick={copySecret}
                      title="Copy secret"
                      size="large"
                      type="primary"
                    />
                  </div>
                  <div style={{ 
                    fontSize: '12px', 
                    color: '#ff4d4f', 
                    background: '#fff2f0', 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    border: '1px solid #ffccc7',
                    textAlign: 'center',
                    fontWeight: '500'
                  }}>
                    💾 Please save this secret code! You will need it for withdrawal.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <Button 
          className='swapButton' 
          onClick={handleDeposit}
          disabled={!isFormValid || !isConnected}
          block
          size="large"
          type="primary"
        >
          Deposit
        </Button>
      </div>

      {/* Deposit Confirmation Modal */}
      <Modal
        title="Confirm Deposit"
        open={isConfirmModalOpen}
        onOk={executeDepositTransaction}
        onCancel={() => setIsConfirmModalOpen(false)}
        okText="Confirm Deposit"
        cancelText="Cancel"
        okType="primary"
      >
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: '12px' }}>
            <strong>Deposit Details:</strong>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#8b949e' }}>Token:</span> {selectedToken?.ticker}
            {selectedToken?.configId && (
              <span style={{ fontSize: '12px', opacity: 0.7, marginLeft: '4px' }}>
                (Config #{selectedToken.configId})
              </span>
            )}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#8b949e' }}>Amount:</span> {selectedToken?.fixedAmountFormatted || tokenAmount} {selectedToken?.ticker}
            {selectedToken?.fixedAmountFormatted && (
              <span style={{ fontSize: '12px', color: '#52c41a', marginLeft: '8px' }}>
                (Fixed Amount)
              </span>
            )}
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#8b949e' }}>From Address:</span> {address}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <span style={{ color: '#8b949e' }}>Secret Hash:</span> {secret?.substring(0, 10)}...
          </div>
          <div style={{ 
            background: '#fff2f0', 
            border: '1px solid #ffccc7', 
            borderRadius: '6px', 
            padding: '12px',
            fontSize: '14px',
            color: '#ff4d4f'
          }}>
            ⚠️ This will execute a real transaction on the blockchain. Make sure all details are correct.
          </div>
        </div>
      </Modal>

    </>
  )
}

export default Deposit
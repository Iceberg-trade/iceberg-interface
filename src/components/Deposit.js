import { Input, Button, Spin, message } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { useState } from 'react'
import tokenList from '../tokenList.json'
import { useSignMessage } from 'wagmi'

function Deposit({ onNext, isConnected, address }) {
  const [selectedToken, setSelectedToken] = useState(tokenList[0])
  const [tokenAmount, setTokenAmount] = useState('')
  const [secret, setSecret] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchToken, setSearchToken] = useState('')
  const [isGeneratingSecret, setIsGeneratingSecret] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()
  
  const { signMessage } = useSignMessage({
    onSuccess(data) {
      console.log('Signature:', data)
      messageApi.success('Transaction signed successfully!')
      
      // Simulate deposit processing
      setTimeout(() => {
        messageApi.success('Deposit successful!')
        onNext({
          depositAddress: address,
          tokenA: selectedToken,
          tokenAAmount: tokenAmount,
          secret,
          signature: data
        })
        setIsLoading(false)
      }, 2000)
    },
    onError(error) {
      console.error('Signing error:', error)
      messageApi.error('Signature rejected')
      setIsLoading(false)
    }
  })

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

  const isFormValid = address && tokenAmount && secret && selectedToken

  const handleDeposit = async () => {
    if (!isConnected) {
      messageApi.error('Please connect your wallet first')
      return
    }
    
    if (!isFormValid) {
      messageApi.error('Please fill in all fields')
      return
    }

    try {
      setIsLoading(true)
      
      // Create message to sign
      const message = `Deposit ${tokenAmount} ${selectedToken.ticker} to address ${address} with secret hash`
      
      messageApi.loading('Please sign the transaction...', 0)
      
      // Trigger wallet signature
      signMessage({ message })
      
    } catch (error) {
      messageApi.error('Deposit failed')
      setIsLoading(false)
    }
  }

  const selectToken = (token) => {
    setSelectedToken(token)
    setIsModalOpen(false)
    setSearchToken('')
  }

  const filteredTokens = tokenList.filter(token => 
    token.name.toLowerCase().includes(searchToken.toLowerCase()) ||
    token.ticker.toLowerCase().includes(searchToken.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="tradeBox" style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px', fontSize: '16px' }}>
          Depositing tokens...
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
                  <div className='tokenTicker'>{token.ticker}</div>
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
              placeholder='0' 
              value={tokenAmount} 
              onChange={(e) => setTokenAmount(e.target.value)}
            />
            <div 
              className='assetOne' 
              onClick={() => setIsModalOpen(true)}
            >
              <img src={selectedToken.img} alt="assetOnelogo" className='logo'/>
              {selectedToken.ticker}
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
    </>
  )
}

export default Deposit
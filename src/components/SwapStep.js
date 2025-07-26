import { Input, Modal, Button, Spin, message } from 'antd'
import { ArrowDownOutlined, DownOutlined } from '@ant-design/icons'
import { useState } from 'react'
import tokenList from '../tokenList.json'

function SwapStep({ depositData, onNext, isConnected }) {
  const [tokenTwo, setTokenTwo] = useState(tokenList[1])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [searchToken, setSearchToken] = useState('')
  const [messageApi, contextHolder] = message.useMessage()

  // Calculate estimated output (mock calculation)
  const estimatedOutput = (parseFloat(depositData.tokenAAmount) * 0.95).toFixed(2)

  const handleSwap = async () => {
    if (!isConnected) {
      messageApi.error('Please connect your wallet first')
      return
    }

    try {
      setIsLoading(true)
      
      // Mock signing transaction
      messageApi.loading('Please sign the swap transaction...', 2)
      
      // Simulate swap delay
      setTimeout(() => {
        messageApi.success('Swap successful!')
        // Pass swap data to next step
        onNext({
          ...depositData,
          tokenB: tokenTwo,
          tokenBAmount: estimatedOutput
        })
      }, 3000)
      
    } catch (error) {
      messageApi.error('Swap failed')
      setIsLoading(false)
    }
  }

  const selectToken = (token) => {
    setTokenTwo(token)
    setIsModalOpen(false)
    setSearchToken('')
  }

  const filteredTokens = tokenList.filter(token => 
    token.address !== depositData.tokenA.address &&
    (token.name.toLowerCase().includes(searchToken.toLowerCase()) ||
     token.ticker.toLowerCase().includes(searchToken.toLowerCase()))
  )

  const switchTokens = () => {
    // This function is not needed in this step but keeping for consistency
  }

  const openModal = (asset) => {
    // This function is not needed in this step but keeping for consistency
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
          <h4>Swap</h4>
        </div>
        
        <div className='inputs'>
          <input 
            className='tokenAmountInput'
            placeholder='0' 
            value={depositData.tokenAAmount} 
            disabled={true}
            style={{ marginBottom: '10px' }}
          />
          <input 
            className='tokenAmountInput'
            placeholder='0' 
            value={estimatedOutput} 
            disabled={true} 
          />
          <div className="switchButton" onClick={switchTokens}>
            <ArrowDownOutlined className='switchArrow'/>
          </div>
          <div className='assetOne' onClick={() => openModal(1)}>
            <img src={depositData.tokenA.img} alt="assetOnelogo" className='logo'/>
            {depositData.tokenA.ticker}
          </div>
          <div className='assetTwo' onClick={() => setIsModalOpen(true)}>
            <img src={tokenTwo.img} alt="assetTwologo" className='logo' />
            {tokenTwo.ticker}
          </div>
        </div>

        <Button 
          className='swapButton'
          onClick={handleSwap}
          disabled={!isConnected}
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
          <div>Rate: 1 {depositData.tokenA.ticker} ≈ 0.95 {tokenTwo.ticker} (estimated)</div>
        </div>
      </div>
    </>
  )
}

export default SwapStep
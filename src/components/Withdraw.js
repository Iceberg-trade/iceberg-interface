import { Input, Button, Spin, message, Result } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'

function Withdraw({ swapData, isConnected }) {
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [secret, setSecret] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [messageApi, contextHolder] = message.useMessage()

  const isFormValid = withdrawAddress && secret

  const handleWithdraw = async () => {
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
      
      // Mock signing transaction
      messageApi.loading('Please sign the withdrawal transaction...', 2)
      
      // Simulate withdrawal delay
      setTimeout(() => {
        messageApi.success('Withdrawal successful!')
        setIsCompleted(true)
        setIsLoading(false)
      }, 3000)
      
    } catch (error) {
      messageApi.error('Withdrawal failed')
      setIsLoading(false)
    }
  }

  if (isCompleted) {
    return (
      <div className="tradeBox">
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
          title={<span style={{ color: '#FFFFFF' }}>Transaction Completed Successfully!</span>}
          subTitle={
            <div style={{ color: '#FFFFFF' }}>
              <p>Successfully withdrawn {swapData.tokenBAmount} {swapData.tokenB.ticker}</p>
              <p>To address: {withdrawAddress}</p>
              <p style={{ fontSize: '12px', color: '#8B949E', marginTop: '15px' }}>
                Transaction processed through secure multi-step protocol
              </p>
            </div>
          }
        />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="tradeBox" style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: '20px', fontSize: '16px' }}>
          Processing withdrawal...
        </div>
      </div>
    )
  }

  return (
    <>
      {contextHolder}
      <div className='tradeBox'>
        <div className='tradeBoxHeader'>
          <h4>Withdraw</h4>
        </div>
        
        <div className='inputs'>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#8B949E' }}>
              Withdraw Address
            </div>
            <Input 
              placeholder='Enter destination wallet address' 
              value={withdrawAddress} 
              onChange={(e) => setWithdrawAddress(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#8B949E' }}>
              Withdrawal Amount
            </div>
            <div className='inputs'>
              <input 
                className='tokenAmountInput'
                placeholder='0' 
                value={swapData.tokenBAmount} 
                disabled={true}
              />
              <div 
                className='assetOne' 
                style={{ cursor: 'not-allowed', opacity: 0.7 }}
              >
                <img src={swapData.tokenB.img} alt="tokenlogo" className='logo'/>
                <span>{swapData.tokenB.ticker}</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#8B949E' }}>
              Secret Code
            </div>
            <Input.Password 
              placeholder='Enter your secret code' 
              value={secret} 
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>
        </div>

        <Button 
          className='swapButton'
          onClick={handleWithdraw}
          disabled={!isFormValid || !isConnected}
          block
          size="large"
          type="primary"
        >
          Withdraw
        </Button>

        <div style={{ 
          marginTop: '15px',
          padding: '10px', 
          backgroundColor: '#212429', 
          borderRadius: '8px',
          fontSize: '12px',
          color: '#8B949E'
        }}>
          <div>Original deposit: {swapData.tokenAAmount} {swapData.tokenA.ticker}</div>
          <div>From: {swapData.depositAddress}</div>
          <div>Swapped to: {swapData.tokenBAmount} {swapData.tokenB.ticker}</div>
        </div>
      </div>
    </>
  )
}

export default Withdraw
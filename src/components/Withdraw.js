import { Input, Button, Spin, message, Result } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { useProvider, useSigner } from 'wagmi'
import { executeIcebergWithdrawUsingProof, checkWithdrawableAmount } from '../utils/icebergWithdraw'

function Withdraw({ swapData, isConnected, address }) {
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [secret, setSecret] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [withdrawableInfo, setWithdrawableInfo] = useState(null)
  
  const [messageApi, contextHolder] = message.useMessage()
  const provider = useProvider()
  const { data: signer } = useSigner()
  
  // Check withdrawable amount when component loads
  useEffect(() => {
    const checkWithdrawable = async () => {
      if (swapData?.nullifierHash && provider) {
        try {
          console.log('🔍 Checking withdrawable amount for:', swapData.nullifierHash)
          const info = await checkWithdrawableAmount(swapData.nullifierHash, provider)
          setWithdrawableInfo(info)
          console.log('✅ Withdrawable info loaded:', info)
        } catch (error) {
          console.error('❌ Failed to check withdrawable amount:', error)
          messageApi.error('Failed to load withdrawal information')
        }
      }
    }
    
    checkWithdrawable()
  }, [swapData?.nullifierHash, provider, messageApi])

  // Check if we have valid withdrawable amount from on-chain data
  const hasValidWithdrawableAmount = withdrawableInfo && withdrawableInfo.hasAmount && parseFloat(withdrawableInfo.formattedAmount) > 0
  
  console.log('🔍 Withdraw data check:', {
    hasValidWithdrawableAmount,
    withdrawableInfo
  })
  
  const withdrawToken = hasValidWithdrawableAmount ? {
    ticker: withdrawableInfo.tokenSymbol,
    img: withdrawableInfo.isETH 
      ? 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
      : 'https://tokens.1inch.io/0xaf88d065e77c8cc2239327c5edb3a432268e5831.png'
  } : null
  
  const withdrawAmount = hasValidWithdrawableAmount ? withdrawableInfo.formattedAmount : '0'
  
  console.log('✅ Final withdraw display:', { withdrawToken, withdrawAmount })

  // Form validation
  const isFormValid = withdrawAddress && secret
  
  // Display error if no valid withdrawal data is available
  if (!withdrawToken) {
    return (
      <>
        {contextHolder}
        <div className="tradeBox" style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ color: '#ff4d4f', fontSize: '16px' }}>
            No withdrawable amount found
          </div>
          <div style={{ color: '#8B949E', fontSize: '14px', marginTop: '10px' }}>
            The swap may not have been executed yet or has already been withdrawn
          </div>
        </div>
      </>
    )
  }

  const handleWithdraw = async () => {
    if (!isConnected) {
      messageApi.error('Please connect your wallet first')
      return
    }

    if (!isFormValid) {
      messageApi.error('Please fill in all required fields')
      return
    }

    if (!signer) {
      messageApi.error('Signer not available. Please reconnect your wallet')
      return
    }

    try {
      setIsLoading(true)
      messageApi.loading('Executing withdrawal transaction...', 0)
      
      console.log('💸 Starting withdrawal with secret:', secret)
      console.log('  recipientAddress:', withdrawAddress)
      
      // Execute withdrawal without requiring pre-generated proof
      const withdrawResult = await executeIcebergWithdrawUsingProof({
        secret: secret,
        recipientAddress: withdrawAddress,
        signer,
        provider,
        userAddress: address,
        swapData: swapData
      })
      
      messageApi.destroy()
      messageApi.success('Withdrawal executed successfully!')
      
      console.log('✅ Withdrawal completed:', withdrawResult)
      
      setIsCompleted(true)
      
    } catch (error) {
      console.error('❌ Withdrawal failed:', error)
      messageApi.destroy()
      
      if (error.message.includes('Invalid proof')) {
        messageApi.error('Invalid proof data. Please check your secret')
      } else if (error.message.includes('No amount available')) {
        messageApi.error('No funds available for withdrawal. Swap may not be executed or already withdrawn')
      } else if (error.message.includes('insufficient funds')) {
        messageApi.error('Insufficient balance for gas fees. Need at least 0.000001 ETH')
      } else {
        messageApi.error('Withdrawal failed: ' + error.message)
      }
      
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
              <p>Successfully withdrawn {withdrawAmount} {withdrawToken.ticker}</p>
              <p>To address: {withdrawAddress}</p>
              <p style={{ fontSize: '12px', color: '#8B949E', marginTop: '15px' }}>
                Transaction processed through secure protocol
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
                value={withdrawAmount} 
                disabled={true}
                style={{ 
                  backgroundColor: '#1a1d26', 
                  cursor: 'not-allowed',
                  opacity: 0.8
                }}
              />
              <div 
                className='assetOne' 
                style={{ cursor: 'not-allowed', opacity: 0.7 }}
              >
                <img src={withdrawToken.img} alt="tokenlogo" className='logo'/>
                <span>{withdrawToken.ticker}</span>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#8B949E' }}>
              Secret Code
            </div>
            <Input.Password 
              placeholder='Enter your secret code from deposit step' 
              value={secret} 
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ 
              fontSize: '12px', 
              color: '#8B949E', 
              textAlign: 'center',
              padding: '12px',
              backgroundColor: '#1a1d26',
              borderRadius: '6px',
              border: '1px solid #333'
            }}>
              🔐 Use the same secret code you generated during deposit
            </div>
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
          {swapData?.tokenAAmount && swapData?.tokenA?.ticker && (
            <div>Original deposit: {swapData.tokenAAmount} {swapData.tokenA.ticker}</div>
          )}
          {swapData?.depositAddress && (
            <div>From: {swapData.depositAddress}</div>
          )}
          <div>Available to withdraw: {withdrawAmount} {withdrawToken?.ticker}</div>
          {swapData?.swapResult?.transactionHash && (
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
              Swap Tx: {swapData.swapResult.transactionHash.substring(0, 16)}...
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default Withdraw
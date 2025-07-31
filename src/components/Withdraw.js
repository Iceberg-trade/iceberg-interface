import { Input, Button, Spin, message, Result } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { useState, useEffect } from 'react'
import { useProvider, useSigner } from 'wagmi'
import { executeIcebergWithdraw, checkWithdrawableAmount } from '../utils/icebergWithdraw'

function Withdraw({ swapData, isConnected, address }) {
  // 所有hooks必须在组件顶部调用
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [secret, setSecret] = useState('')
  const [proof, setProof] = useState('')
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

  // 适配swap结果数据，使用withdrawableInfo优先
  const withdrawToken = withdrawableInfo ? {
    ticker: withdrawableInfo.tokenSymbol,
    img: withdrawableInfo.isETH 
      ? 'https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png'
      : 'https://tokens.1inch.io/0xaf88d065e77c8cc2239327c5edb3a432268e5831.png'
  } : (swapData?.swapResult?.tokenOut || swapData?.tokenB || null)
  
  const withdrawAmount = withdrawableInfo?.formattedAmount || swapData?.swapResult?.amountOut || swapData?.tokenBAmount || '0'
  
  // 如果没有有效的token数据，显示错误
  if (!withdrawToken) {
    return (
      <>
        {contextHolder}
        <div className="tradeBox" style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ color: '#ff4d4f', fontSize: '16px' }}>
            Error: No token data available for withdrawal
          </div>
          <div style={{ color: '#8B949E', fontSize: '14px', marginTop: '10px' }}>
            Please complete the swap step first
          </div>
        </div>
      </>
    )
  }

  const isFormValid = withdrawAddress && secret && proof && swapData?.nullifierHash

  const handleWithdraw = async () => {
    if (!isConnected) {
      messageApi.error('Please connect your wallet first')
      return
    }

    if (!isFormValid) {
      messageApi.error('Please fill in all fields including ZK proof')
      return
    }

    if (!signer) {
      messageApi.error('Signer not available. Please reconnect your wallet')
      return
    }

    try {
      setIsLoading(true)
      messageApi.loading('Executing withdrawal transaction...', 0)
      
      // Parse proof from string to array
      let proofArray
      try {
        proofArray = JSON.parse(proof.trim())
        if (!Array.isArray(proofArray) || proofArray.length !== 8) {
          throw new Error('Proof must be an array of 8 elements')
        }
      } catch (parseError) {
        messageApi.destroy()
        messageApi.error('Invalid proof format. Please provide a valid JSON array with 8 elements')
        setIsLoading(false)
        return
      }
      
      console.log('💸 Starting withdrawal with parameters:')
      console.log('  nullifierHash:', swapData.nullifierHash)
      console.log('  recipientAddress:', withdrawAddress)
      console.log('  proof length:', proofArray.length)
      
      // Execute real withdrawal using the utility function
      const withdrawResult = await executeIcebergWithdraw({
        nullifierHash: swapData.nullifierHash,
        recipientAddress: withdrawAddress,
        proof: proofArray,
        signer,
        provider,
        userAddress: address
      })
      
      messageApi.destroy()
      messageApi.success('Withdrawal executed successfully!')
      
      console.log('✅ Withdrawal completed:', withdrawResult)
      
      setIsCompleted(true)
      
    } catch (error) {
      console.error('❌ Withdrawal failed:', error)
      messageApi.destroy()
      
      if (error.message.includes('Invalid proof')) {
        messageApi.error('Invalid ZK proof. Please check your proof data')
      } else if (error.message.includes('No amount available')) {
        messageApi.error('No funds available for withdrawal. Swap may not be executed or already withdrawn')
      } else if (error.message.includes('insufficient funds')) {
        messageApi.error('Insufficient balance for gas fees. Need at least 0.0002 ETH')
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
              placeholder='Enter your secret code' 
              value={secret} 
              onChange={(e) => setSecret(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px', fontSize: '14px', color: '#8B949E' }}>
              ZK Proof (8 elements array)
            </div>
            <Input.TextArea 
              placeholder='Paste your ZK proof here (8 comma-separated numbers)'
              value={proof}
              onChange={(e) => setProof(e.target.value)}
              rows={4}
              style={{ fontFamily: 'monospace', fontSize: '12px' }}
            />
            <div style={{ 
              fontSize: '12px', 
              color: '#8B949E', 
              marginTop: '4px'
            }}>
              Example: ["123...", "456...", "789...", "012...", "345...", "678...", "901...", "234..."]
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
          <div>Original deposit: {swapData?.tokenAAmount} {swapData?.tokenA?.ticker}</div>
          <div>From: {swapData?.depositAddress}</div>
          <div>Swapped to: {withdrawAmount} {withdrawToken?.ticker}</div>
          {swapData.swapResult?.transactionHash && (
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
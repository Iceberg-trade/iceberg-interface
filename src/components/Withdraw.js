import { Input, Button, Spin, message, Result } from 'antd'
import { CheckCircleOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useSigner } from 'wagmi'
import { executeIcebergWithdrawUsingProof } from '../utils/icebergWithdraw'
import { getIcebergAddress } from '../utils/getDepositAssets'
import { ethers } from 'ethers'

function Withdraw({ swapData, isConnected, address }) {
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [secret, setSecret] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  
  const [messageApi, contextHolder] = message.useMessage()
  const { data: signer } = useSigner()
  
  // 从swapData中获取目标资产信息
  const withdrawToken = swapData?.swapResult?.tokenOut || {
    ticker: "USDC",
    img: 'https://tokens.1inch.io/0xaf88d065e77c8cc2239327c5edb3a432268e5831.png'
  }
  
  const withdrawAmount = swapData?.swapResult?.amountOut || "0.25000"

  // Form validation
  const isFormValid = withdrawAddress && secret
  

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
      
      // Get pool address
      const poolAddress = await getIcebergAddress()
      console.log('🏠 Pool address:', poolAddress)
      
      // Generate nullifier from secret (following depositUtils.js logic)
      console.log('🔄 Generating nullifier and secret from user input')
      console.log('🔧 User input secret:', secret)
      
      // Calculate nullifier (reversed secret)
      const reversedSecret = secret.split('').reverse().join('')
      console.log('🔧 Nullifier (reversed secret):', reversedSecret)
      
      // Convert to BigInt for calculation - same logic as depositUtils.js
      let secretBigInt, nullifierBigInt
      
      // For UUID format secret, use hash conversion (same as depositUtils.js)
      if (secret.match(/[^0-9]/)) {
        console.log('📋 Using hash conversion for non-numeric secret')
        const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(secret))
        const nullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(reversedSecret))
        secretBigInt = BigInt(secretHash)
        nullifierBigInt = BigInt(nullifierHash)
        console.log('  Secret hash:', secretHash)
        console.log('  Nullifier hash:', nullifierHash)
      } else {
        // For pure numeric secret, direct conversion
        console.log('📋 Using numeric conversion')
        secretBigInt = BigInt(secret)
        nullifierBigInt = BigInt(reversedSecret)
      }
      
      const nullifier = nullifierBigInt.toString()
      console.log('🔑 Generated nullifier BigInt:', nullifier)
      console.log('🔑 Generated secret BigInt:', secretBigInt.toString())
      
      // Execute withdrawal with correct parameters
      const withdrawResult = await executeIcebergWithdrawUsingProof(
        poolAddress,
        withdrawAddress,
        nullifier,
        secretBigInt.toString(),
        signer
      )
      
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
          {swapData?.tokenA && (
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
          {swapData?.swapResult && (
            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '4px' }}>
              💱 Swapped from {swapData.tokenA.ticker} to {withdrawToken.ticker}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default Withdraw
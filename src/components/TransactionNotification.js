import React, { useState, useEffect } from 'react'
import { Button, Card } from 'antd'
import { LinkOutlined, CloseOutlined } from '@ant-design/icons'

function TransactionNotification({ 
  transaction, 
  onClose, 
  network = 'arbitrum' 
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    console.log('🔍 TransactionNotification useEffect:', transaction)
    if (transaction) {
      console.log('🔍 Setting isVisible to true')
      setIsVisible(true)
    }
  }, [transaction])

  console.log('🔍 TransactionNotification render:', { transaction, isVisible })

  if (!transaction || !isVisible) {
    console.log('🔍 TransactionNotification returning null')
    return null
  }

  // 根据网络获取区块浏览器链接
  const getExplorerUrl = (txHash, network) => {
    const explorers = {
      arbitrum: `https://arbiscan.io/tx/${txHash}`,
      ethereum: `https://etherscan.io/tx/${txHash}`,
      mainnet: `https://etherscan.io/tx/${txHash}`
    }
    return explorers[network] || explorers.arbitrum
  }

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => {
      onClose && onClose()
    }, 300)
  }

  const openExplorer = () => {
    if (transaction.hash) {
      const url = getExplorerUrl(transaction.hash, network)
      window.open(url, '_blank')
    }
  }

  return (
    <div 
      className="transaction-notification"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 1000,
        transform: isVisible ? 'translateY(0)' : 'translateY(100%)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s ease',
        maxWidth: '400px'
      }}
    >
      <Card
        style={{
          backgroundColor: '#131a2a',
          border: '1px solid #293249',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
        }}
        bodyStyle={{ padding: '16px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, marginRight: '12px' }}>
            <div style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: '#fff',
              marginBottom: '8px'
            }}>
              {transaction.status === 'pending' && '⏳ Transaction Pending'}
              {transaction.status === 'success' && '✅ Transaction Confirmed'}
              {transaction.status === 'failed' && '❌ Transaction Failed'}
            </div>
            
            <div style={{ 
              fontSize: '14px', 
              color: '#8b949e', 
              marginBottom: '8px'
            }}>
              {transaction.type || 'Deposit Transaction'}
            </div>
            
            {transaction.error && (
              <div style={{ 
                fontSize: '12px', 
                color: '#ff4d4f',
                marginBottom: '8px',
                fontStyle: 'italic'
              }}>
                {transaction.error}
              </div>
            )}
            
            {transaction.hash && (
              <div style={{ 
                fontSize: '12px', 
                color: '#666',
                fontFamily: 'monospace',
                marginBottom: '12px',
                wordBreak: 'break-all'
              }}>
                {transaction.hash.substring(0, 10)}...{transaction.hash.substring(transaction.hash.length - 8)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button 
                type="primary"
                size="small"
                icon={<LinkOutlined />}
                onClick={openExplorer}
                style={{
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  border: 'none',
                  borderRadius: '6px'
                }}
              >
                View on Explorer
              </Button>
              
              <Button 
                size="small"
                onClick={handleClose}
                style={{
                  backgroundColor: '#1f2639',
                  borderColor: '#293249',
                  color: '#8b949e'
                }}
              >
                Close
              </Button>
            </div>
          </div>
          
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={handleClose}
            style={{
              color: '#8b949e',
              border: 'none',
              backgroundColor: 'transparent'
            }}
          />
        </div>
      </Card>

    </div>
  )
}

export default TransactionNotification
import React, { useState, useEffect, useRef } from 'react'
import Eth from '../eth.svg'
import Logo from '../logo.png'
import {Link} from 'react-router-dom'
import { useNetwork, useSwitchNetwork } from 'wagmi'

function Header(props) {
  const {connect, disconnect, connectors, isConnected, address, isLoading, pendingConnector} = props
  const { chain } = useNetwork()
  const { switchNetwork } = useSwitchNetwork()
  const [isNetworkMenuOpen, setIsNetworkMenuOpen] = useState(false)
  const [isWalletMenuOpen, setIsWalletMenuOpen] = useState(false)
  const networkMenuRef = useRef(null)
  const walletMenuRef = useRef(null)

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(event) {
      if (networkMenuRef.current && !networkMenuRef.current.contains(event.target)) {
        setIsNetworkMenuOpen(false)
      }
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target)) {
        setIsWalletMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const networks = [
    { id: 42161, name: 'Arbitrum', icon: '🔷' },
    { id: 1, name: 'Ethereum', icon: 'Ⓔ' }
  ]

  const getCurrentNetwork = () => {
    if (!chain) return { name: 'Unknown', icon: '❓' }
    const network = networks.find(n => n.id === chain.id)
    return network || { name: chain.name || 'Unknown', icon: '❓' }
  }

  const handleNetworkSwitch = (networkId) => {
    if (switchNetwork) {
      switchNetwork(networkId)
    }
    setIsNetworkMenuOpen(false)
  }

  const handleWalletConnect = (connector) => {
    connect({ connector })
    setIsWalletMenuOpen(false)
  }

  const handleDisconnect = () => {
    disconnect()
    setIsWalletMenuOpen(false)
  }

  const getWalletName = (connector) => {
    if (connector.name === 'MetaMask') return 'MetaMask'
    if (connector.name === 'WalletConnect') return 'WalletConnect'
    if (connector.name === 'Injected') return 'Browser Wallet'
    return connector.name
  }

  const getWalletIcon = (connector) => {
    if (connector.name === 'MetaMask') return '🦊'
    if (connector.name === 'WalletConnect') return '🔗'
    if (connector.name === 'Injected') return '🌐'
    return '💳'
  }

  return (
    <header>
      <div className='leftH'>
        <img src={Logo} alt='eth' className='logo' />
        <Link to='/' className='link'>
        <div className='headerItem'>Swap</div>  
        </Link>
        <Link to='/tokens' className='link'>
        <div className='headerItem'>Tokens</div>
        </Link>
        <Link to='/docs' className='link'>
        <div className='headerItem'>Docs</div>
        </Link>
        </div>
      <div className='rightH'>
        <div className='headerItem' style={{ position: 'relative' }} ref={networkMenuRef}>
          <div 
            className='networkSelector'
            onClick={() => setIsNetworkMenuOpen(!isNetworkMenuOpen)}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: isNetworkMenuOpen ? '#2d3748' : 'transparent',
              border: '1px solid #4a5568'
            }}
          >
            <span style={{ fontSize: '16px' }}>{getCurrentNetwork().icon}</span>
            <span>{getCurrentNetwork().name}</span>
            <span style={{ fontSize: '12px', opacity: 0.7 }}>▼</span>
          </div>
          
          {isNetworkMenuOpen && (
            <div className='networkMenu' style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              marginTop: '4px',
              backgroundColor: '#1a202c',
              border: '1px solid #4a5568',
              borderRadius: '8px',
              minWidth: '150px',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              {networks.map((network) => (
                <div
                  key={network.id}
                  className='networkMenuItem'
                  onClick={() => handleNetworkSwitch(network.id)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    borderBottom: '1px solid #2d3748',
                    backgroundColor: chain?.id === network.id ? '#2d3748' : 'transparent'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#2d3748'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = chain?.id === network.id ? '#2d3748' : 'transparent'}
                >
                  <span style={{ fontSize: '16px' }}>{network.icon}</span>
                  <span>{network.name}</span>
                  {chain?.id === network.id && <span style={{ marginLeft: 'auto', color: '#48bb78' }}>✓</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className='headerItem' style={{ position: 'relative' }} ref={walletMenuRef}>
          {!isConnected ? (
            <div
              className='connectButton'
              onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
              style={{
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#3182ce',
                color: 'white',
                border: 'none'
              }}
            >
              {isLoading && pendingConnector ? 'Connecting...' : 'Connect Wallet'}
            </div>
          ) : (
            <div
              className='connectButton'
              onClick={() => setIsWalletMenuOpen(!isWalletMenuOpen)}
              style={{
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#4a5568',
                color: 'white',
                border: '1px solid #718096'
              }}
            >
              {address.slice(0,4) + "..." + address.slice(38)}
            </div>
          )}
          
          {isWalletMenuOpen && (
            <div className='walletMenu' style={{
              position: 'absolute',
              top: '100%',
              right: '0',
              marginTop: '4px',
              backgroundColor: '#1a202c',
              border: '1px solid #4a5568',
              borderRadius: '8px',
              minWidth: '200px',
              zIndex: 1000,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
            }}>
              {!isConnected ? (
                <>
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: '#a0aec0', borderBottom: '1px solid #2d3748' }}>
                    Select Wallet
                  </div>
                  {connectors.map((connector) => (
                    <div
                      key={connector.id}
                      className='walletMenuItem'
                      onClick={() => handleWalletConnect(connector)}
                      style={{
                        padding: '12px 16px',
                        cursor: connector.ready ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        borderBottom: '1px solid #2d3748',
                        opacity: connector.ready ? 1 : 0.5,
                        backgroundColor: 'transparent'
                      }}
                      onMouseEnter={(e) => connector.ready && (e.target.style.backgroundColor = '#2d3748')}
                      onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ fontSize: '16px' }}>{getWalletIcon(connector)}</span>
                      <span>{getWalletName(connector)}</span>
                      {!connector.ready && <span style={{ fontSize: '10px', color: '#ff6b6b' }}>(Not Available)</span>}
                      {isLoading && connector.id === pendingConnector?.id && <span style={{ fontSize: '10px', color: '#ffd93d' }}>Connecting...</span>}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ padding: '8px 12px', fontSize: '12px', color: '#a0aec0', borderBottom: '1px solid #2d3748' }}>
                    Wallet Options
                  </div>
                  <div
                    className='walletMenuItem'
                    onClick={handleDisconnect}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: '#ff6b6b',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#2d3748'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    <span style={{ fontSize: '16px' }}>🚪</span>
                    <span>Disconnect</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        </div>
    </header>
  )
}

export default Header
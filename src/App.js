import "./App.css";
import Header from "./components/Header";
import StepProgress from "./components/StepProgress";
import Deposit from "./components/Deposit";
import SwapStep from "./components/SwapStep";
import Withdraw from "./components/Withdraw";
import {Routes, Route} from "react-router-dom";
import Tokens from "./components/Tokens";
import Docs from "./components/Docs";
import {useConnect, useAccount, useDisconnect} from "wagmi"
import { useState, useEffect } from 'react'
import TransactionNotification from "./components/TransactionNotification"

function App() {
  const {address, isConnected} = useAccount()
  const {connect, connectors, isLoading, pendingConnector} = useConnect()
  const {disconnect} = useDisconnect()
  
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])
  const [depositData, setDepositData] = useState(null)
  const [swapData, setSwapData] = useState(null)
  const [currentTransaction, setCurrentTransaction] = useState(null)

  // 监听账户变化
  useEffect(() => {
    // 如果账户发生变化，可以在这里添加必要的逻辑
    if (isConnected && address) {
      console.log('Wallet connected:', address)
    }
  }, [isConnected, address])

  const handleDepositNext = (data) => {
    setDepositData(data)
    setCompletedSteps([0])
    setCurrentStep(1)
  }

  const handleSwapNext = (data) => {
    setSwapData(data)
    setCompletedSteps([0, 1])
    setCurrentStep(2)
  }

  const handleCloseTransaction = () => {
    setCurrentTransaction(null)
  }

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return <Deposit 
          onNext={handleDepositNext} 
          isConnected={isConnected} 
          address={address}
          setCurrentTransaction={setCurrentTransaction}
        />
      case 1:
        return depositData ? 
          <SwapStep 
            depositData={depositData} 
            onNext={handleSwapNext} 
            isConnected={isConnected}
            address={address}
            setCurrentTransaction={setCurrentTransaction}
          /> : null
      case 2:
        return swapData ? 
          <Withdraw 
            swapData={swapData} 
            isConnected={isConnected}
            setCurrentTransaction={setCurrentTransaction}
          /> : null
      default:
        return <Deposit 
          onNext={handleDepositNext} 
          isConnected={isConnected} 
          address={address}
          setCurrentTransaction={setCurrentTransaction}
        />
    }
  }

  return (
    <div className="App">
      <Header 
        connect={connect} 
        disconnect={disconnect}
        connectors={connectors}
        isConnected={isConnected} 
        address={address}
        isLoading={isLoading}
        pendingConnector={pendingConnector}
      />
      <div className="mainWindow">
        <Routes>
          <Route path="/" element={
            <>
              <StepProgress currentStep={currentStep} completedSteps={completedSteps} />
              {renderCurrentStep()}
            </>
          }/>
          <Route path="/tokens" element={<Tokens/>}/>
          <Route path="/docs" element={<Docs/>}/>
        </Routes>
      </div>
      
      {/* Global Transaction Notification */}
      <TransactionNotification
        transaction={currentTransaction}
        onClose={handleCloseTransaction}
        network={currentTransaction?.network || 'arbitrum'}
      />
    </div>
  )
}

export default App;

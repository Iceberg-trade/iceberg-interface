import "./App.css";
import Header from "./components/Header";
import StepProgress from "./components/StepProgress";
import Deposit from "./components/Deposit";
import SwapStep from "./components/SwapStep";
import Withdraw from "./components/Withdraw";
import {Routes, Route} from "react-router-dom";
import Tokens from "./components/Tokens";
import Docs from "./components/Docs";
import {useConnect, useAccount} from "wagmi"
import {MetaMaskConnector} from "@wagmi/connectors/metaMask"
import { useState } from 'react'

function App() {
  const {address, isConnected} = useAccount()
  const {connect} = useConnect({
    connector: new MetaMaskConnector(),
  })
  
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState([])
  const [depositData, setDepositData] = useState(null)
  const [swapData, setSwapData] = useState(null)

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

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return <Deposit onNext={handleDepositNext} isConnected={isConnected} address={address} />
      case 1:
        return depositData ? 
          <SwapStep 
            depositData={depositData} 
            onNext={handleSwapNext} 
            isConnected={isConnected} 
          /> : null
      case 2:
        return swapData ? 
          <Withdraw 
            swapData={swapData} 
            isConnected={isConnected} 
          /> : null
      default:
        return <Deposit onNext={handleDepositNext} isConnected={isConnected} address={address} />
    }
  }

  return (
    <div className="App">
      <Header connect={connect} isConnected={isConnected} address={address}/>
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
    </div>
  )
}

export default App;

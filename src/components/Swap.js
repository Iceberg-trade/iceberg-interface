import {Input, Popover, Radio, Modal, message} from 'antd'
import {ArrowDownOutlined, SettingOutlined} from '@ant-design/icons'
import { useState, useEffect } from 'react'
import tokenList from '../tokenList.json'
import axios from 'axios'
import {useSendTransaction, useWaitForTransaction} from "wagmi"


function Swap(props) {
  const {address, isConnected} = props
const [slippage, setSlippage] = useState(2.5)
const [messageApi, contextHolder] = message.useMessage()
const [tokenOneAmount, setTokenOneAmount] = useState(0)
const [tokenTwoAmount, setTokenTwoAmount] = useState(0)
const [tokenOne, setTokenOne] = useState(tokenList[0])
const [tokenTwo, setTokenTwo] = useState(tokenList[1])
const [isOpen, setIsOpen] = useState(false)
const [changeToken, setChangeToken] = useState(1)
const [prices, setPrices] = useState({})
const [txDetails, setTxDetails] = useState({
  to: null, 
  data: null,
  value: null
})
const [showConfirmation, setShowConfirmation] = useState(false)
const [pendingTx, setPendingTx] = useState(null)

const {data, sendTransaction} = useSendTransaction({
  request: {
    from : address,
    to: String(txDetails.to),
    data: String(txDetails.data),
    value: String(txDetails.value)
  }
})

const {isLoading, isSuccess} = useWaitForTransaction({
  hash: data?.hash
}) 

const handleSlippage = (e) => {
  setSlippage(e.target.value)
}

const changeAmount = (e) => {
  setTokenOneAmount(e.target.value)
  if(e.target.value && prices) {
    const inputValue = parseFloat(e.target.value)
    const calculatedAmount = (inputValue * (prices.ratio || 1)).toFixed(2)
    setTokenTwoAmount(isNaN(calculatedAmount) ? '0' : calculatedAmount)
  } else {
    setTokenTwoAmount('0')
  }
}

const switchTokens = () => {
  setPrices(null)
  setTokenOneAmount(0)
  setTokenTwoAmount(0)
  setTokenOne(tokenTwo)
  setTokenTwo(tokenOne)
  fetchDexSwap(tokenTwo.address, tokenOne.address)
}

const openModal = (token) => {
  setChangeToken(token)
  setIsOpen(true)
}

const modifyToken = (i) => {
  setPrices(null)
  setTokenOneAmount(0)
  setTokenTwoAmount(0)
  if (changeToken === 1) {
    setTokenOne(tokenList[i])
    fetchDexSwap(tokenList[i].address, tokenTwo.address)
  } else {
    setTokenTwo(tokenList[i])
    fetchDexSwap(tokenOne.address, tokenList[i].address)
  }
  setIsOpen(false)
}

const fetchDexSwap = async (one, two) => {
  try {
    // Use 1inch API for price quotes (using 1 unit with proper decimals)
    const fromTokenInfo = tokenList.find(token => token.address.toLowerCase() === one.toLowerCase())
    const toTokenInfo = tokenList.find(token => token.address.toLowerCase() === two.toLowerCase())
    
    if (!fromTokenInfo) {
      throw new Error('From token not found in token list')
    }
    
    // Use 1 unit of the from token (with proper decimals)
    const oneUnit = Math.pow(10, fromTokenInfo.decimals).toString()
    
    const quoteRes = await axios.get(`https://api.1inch.io/v5.0/1/quote?fromTokenAddress=${one}&toTokenAddress=${two}&amount=${oneUnit}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    
    if (quoteRes.data && quoteRes.data.toTokenAmount) {
      // Calculate ratio: how many toTokens for 1 fromToken
      const toDecimals = toTokenInfo ? toTokenInfo.decimals : 18
      const toAmount = parseFloat(quoteRes.data.toTokenAmount) / Math.pow(10, toDecimals)
      
      setPrices({ 
        ratio: toAmount,
        fromToken: one,
        toToken: two,
        estimatedGas: quoteRes.data.estimatedGas
      })
      console.log(`1inch price: 1 ${fromTokenInfo.ticker} = ${toAmount} ${toTokenInfo?.ticker || 'tokens'}`)
    } else {
      throw new Error('Invalid 1inch quote response')
    }
  } catch (error) {
    console.error('1inch price fetch error:', error)
    messageApi.warning('Unable to fetch real-time prices from 1inch')
    
    // Set a default 1:1 ratio as fallback
    setPrices({ 
      ratio: 1.0,
      fromToken: one,
      toToken: two
    })
  }
}

const fetchDex = async () => {
  try {
    // Validate inputs
    if (!tokenOne.address || !tokenTwo.address || !address || !tokenOneAmount) {
      messageApi.error('Missing required transaction data')
      return
    }
    
    const allowance = await axios.get(`https://api.1inch.io/v5.0/1/approve/allowance?tokenAddress=${tokenOne.address}&walletAddress=${address}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })
    
    // Validate API response
    if (!allowance.data || allowance.data.allowance === undefined) {
      messageApi.error('Failed to check token allowance')
      return
    }

    if(allowance.data.allowance == 0) {
      // Use reasonable approval amount instead of unlimited (2x the swap amount)
      const rawApprovalAmount = parseFloat(tokenOneAmount) * 2 * Math.pow(10, tokenOne.decimals)
      const approvalAmount = Math.floor(rawApprovalAmount).toString()
      const approve = await axios.get(`https://api.1inch.io/v5.0/1/approve/transaction?tokenAddress=${tokenOne.address}&amount=${approvalAmount}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      
      if (!approve.data || !approve.data.to) {
        messageApi.error('Failed to get approval transaction')
        return
      }
      
      setPendingTx(approve.data)
      setShowConfirmation(true)
      console.log("Approval needed") 
      return
    }
  

console.log("make swap", allowance.data.allowance)

    // Calculate proper amount with decimals for 1inch API
    const rawAmount = parseFloat(tokenOneAmount) * Math.pow(10, tokenOne.decimals)
    const swapAmount = Math.floor(rawAmount).toString()
    
    console.log(`Preparing swap: ${tokenOneAmount} ${tokenOne.ticker} (${swapAmount} wei) -> ${tokenTwo.ticker}`)
    
    const swap = await axios.get(`https://api.1inch.io/v5.0/1/swap?fromTokenAddress=${tokenOne.address}&toTokenAddress=${tokenTwo.address}&amount=${swapAmount}&fromAddress=${address}&slippage=${slippage}`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    // Validate swap response
    if (!swap.data || !swap.data.tx || !swap.data.toTokenAmount) {
      messageApi.error('Failed to get swap quote')
      return
    }

    console.log("swap", swap.data)

    let decimals = Number(`1E${tokenTwo.decimals}`)
    const calculatedAmount = (Number(swap.data.toTokenAmount)/decimals).toFixed(2)
    
    // Validate calculated amount
    if (isNaN(calculatedAmount) || calculatedAmount <= 0) {
      messageApi.error('Invalid swap calculation')
      return
    }

    setTokenTwoAmount(calculatedAmount)
    setPendingTx(swap.data.tx)
    setShowConfirmation(true)
  } catch (error) {
    console.error('Swap error:', error)
    messageApi.error('Failed to prepare swap transaction')
  }

}

useEffect(() => {
  fetchDexSwap(tokenList[0].address, tokenList[1].address)
}, [])

useEffect(() => {
  messageApi.destroy()
  if (isLoading) {
    messageApi.open({
      content: 'Waiting for transaction to be mined',
      type: 'loading',
      duration: 0
    })
  }},[isLoading])

  useEffect(() => {
    messageApi.destroy()
    if (isSuccess) {
      messageApi.open({
        type: 'success',
        content: 'Transaction Success',
        duration: 2
      })
    } else if (txDetails.to){
      messageApi.open({
        type: 'error',
        content: 'Transaction Failed',
        duration: 2
      })
    }
  }, [isSuccess]) 

const confirmTransaction = () => {
  if (pendingTx && isConnected) {
    setTxDetails(pendingTx)
    setShowConfirmation(false)
    setPendingTx(null)
  }
}

const cancelTransaction = () => {
  setShowConfirmation(false)
  setPendingTx(null)
}

useEffect(() => {
  if (txDetails.to && isConnected) {
    sendTransaction()
    message.success('Transaction sent')
  }
}, [txDetails])

  const settingsContent = (
    <>
    <div>Slippage Tolerance</div>
    <div>
      <Radio.Group onChange={handleSlippage} value={slippage}>
        <Radio.Button value={0.5}>0.5%</Radio.Button>
        <Radio.Button value={2.5}>2.5%</Radio.Button>
        <Radio.Button value={5}>5%</Radio.Button>
      </Radio.Group>
    </div>
    </>
  )

  return (
    <>
    {contextHolder}
    <Modal 
      open={showConfirmation} 
      onOk={confirmTransaction}
      onCancel={cancelTransaction}
      title="Confirm Transaction"
      okText="Confirm"
      cancelText="Cancel"
      okButtonProps={{danger: true}}
    >
      <div>
        <p><strong>⚠️ Please review this transaction carefully:</strong></p>
        <p>From: {tokenOneAmount} {tokenOne.ticker}</p>
        <p>To: ~{tokenTwoAmount} {tokenTwo.ticker}</p>
        <p>Slippage: {slippage}%</p>
        <p>Network: Ethereum Mainnet</p>
        <p style={{color: 'red', fontSize: '12px'}}>
          This will execute a real blockchain transaction. Make sure you're on testnet!
        </p>
      </div>
    </Modal>
    <Modal open={isOpen} footer={null} onCancel={()=> {setIsOpen(false)}} title="Select a token">
    <div className='modalContent'>
      {tokenList?.map((token, index) => {
        return (
          <div className='tokenChoice' key={index} 
          onClick={() => modifyToken(index)}
          >
            <img src={token.img} alt={token.ticker} className="tokenLogo"/>
            <div className='tokenChoiceNames'>
              <div className='tokenName'> 
                {token.name}
              </div>
              <div className='tokenTicker'>
                {token.ticker}
                </div>
            </div>
            </div>
        )
      })}
    </div>
    </Modal>
    <div className='tradeBox'>
      <div className='tradeBoxHeader'>
        <h4>Swap</h4>
        <Popover
        title='Settings'
        trigger='click'
        placement='bottomRight'
        content={settingsContent}
        >
        <SettingOutlined className='cog'/>
        </Popover>
      </div>
      <div className='inputs'>
      <Input placeholder='0' value={tokenOneAmount} onChange={changeAmount} disabled={!prices}/>
      <Input placeholder='0' value={tokenTwoAmount} disabled={true} />
      <div className="switchButton" onClick={switchTokens}>
        <ArrowDownOutlined className='switchArrow'/>
          </div> 
      <div className='assetOne' onClick={()=> openModal(1)}>
        <img src={tokenOne.img} alt="assetOnelogo" className='logo'/>
        {tokenOne.ticker}
      </div>
      <div className='assetTwo' onClick={()=> openModal(2)}>
      <img src={tokenTwo.img} alt="assetTwologo" className='logo' />
        {tokenTwo.ticker}
      </div>
    </div>
    <div className='swapButton' onClick={fetchDex} disabled={!tokenOneAmount || !isConnected}>
      Swap
      </div>
    </div>
    </>
  )
}

export default Swap
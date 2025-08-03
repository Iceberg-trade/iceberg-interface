/**
 * Iceberg Swap utility function
 * Encapsulated from scripts/mainnet/executeSwap.ts for direct frontend usage
 * Executes swap operations through Iceberg contract with 1inch integration
 */

import { ethers } from 'ethers'
import axios from 'axios'
const { poseidon1 } = require("poseidon-lite")

// Iceberg contract address
const ICEBERG_CONTRACT_ADDRESS = "0x3db30702b8BCb691aa146069479a20E553FB5F4A"

/**
 * Execute swap through Iceberg contract
 * @param {Object} params - Swap parameters
 * @param {string} params.secret - User's secret from deposit step
 * @param {number} params.swapConfigId - Swap configuration ID
 * @param {string} params.tokenIn - Source token address (ETH: 0x0000000000000000000000000000000000000000)
 * @param {string} params.tokenOut - Target token address (ETH: 0x0000000000000000000000000000000000000000)
 * @param {string} params.fixedAmount - Amount to swap (in wei)
 * @param {number} params.decimalsIn - Source token decimals
 * @param {number} params.decimalsOut - Target token decimals
 * @param {Object} params.signer - Ethers signer object
 * @param {Object} params.provider - Ethers provider object
 * @param {string} params.userAddress - User's wallet address
 * @returns {Promise<Object>} Swap result with transaction details
 */
export async function executeIcebergSwap(params) {
  const {
    secret,
    swapConfigId,
    tokenIn,
    tokenOut,
    fixedAmount,
    decimalsIn,
    decimalsOut,
    signer,
    provider,
    userAddress
  } = params

  console.log("🔄 Executing Iceberg Swap operations...")
  
  // Get network information
  const network = await provider.getNetwork()
  console.log("🌐 Current network:", network.name, "Chain ID:", network.chainId)
  
  if (network.chainId !== 42161 && network.chainId !== 1) {
    throw new Error("⚠️ Not on mainnet environment (Ethereum or Arbitrum)")
  }

  // 1. Generate nullifier from secret (按照executeSwap.ts逻辑)
  const reversedSecret = secret.split('').reverse().join('')
  console.log('🔄 Reversed secret for nullifier generation')
  
  // Convert reversed secret to BigNumber for poseidon calculation
  const nullifier = ethers.BigNumber.from(ethers.utils.keccak256(ethers.utils.toUtf8Bytes(reversedSecret))).toString()
  
  // 2. Calculate nullifierHash = poseidon1(nullifier)
  const nullifierHash = poseidon1([nullifier])
  const nullifierHashHex = "0x" + ethers.BigNumber.from(nullifierHash.toString()).toHexString().slice(2).padStart(64, '0')
  console.log("🔑 Calculated NullifierHash:", nullifierHashHex)

  console.log('\n📋 Swap parameters:')
  console.log('  SwapConfigId:', swapConfigId)
  console.log('  TokenIn:', tokenIn === ethers.constants.AddressZero ? "ETH" : tokenIn)
  console.log('  TokenOut:', tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? "ETH" : tokenOut)
  console.log('  FixedAmount:', ethers.utils.formatUnits(fixedAmount, decimalsIn))

  // 3. Get 1inch swap data
  console.log("\n🔄 Getting 1inch real quotes...")
  
  const swapParams = {
    chainId: network.chainId,
    src: tokenIn,
    dst: tokenOut,
    amount: fixedAmount.toString(),
    from: ICEBERG_CONTRACT_ADDRESS, // Iceberg作为调用者
    slippage: 1, // 1%滑点
    disableEstimate: true
  }
  
  // Get 1inch real transaction data
  console.log("🔄 Getting 1inch transaction data...")
  
  const swapResponse = await axios.get('http://localhost:8080/api/1inch/swap/v6.0/42161/swap', {
    params: {
      src: tokenIn === ethers.constants.AddressZero ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : tokenIn,
      dst: tokenOut === ethers.constants.AddressZero ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : tokenOut,
      amount: fixedAmount.toString(),
      from: ICEBERG_CONTRACT_ADDRESS,
      slippage: 1,
      disableEstimate: true
    },
    timeout: 15000
  })
  
  if (!swapResponse.data || !swapResponse.data.tx) {
    throw new Error('1inch API错误')
  }
  
  const swapData = swapResponse.data
  
  // Parse 1inch transaction data
  const abi = [
    "function swap(address executor, tuple(address srcToken, address dstToken, address srcReceiver, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags) desc, bytes data)"
  ]
  const iface = new ethers.utils.Interface(abi)
  const parsed = iface.parseTransaction({ data: swapData.tx.data })
  const executor = parsed.args[0]
  const desc = parsed.args[1]
  const innerData = parsed.args[2] // 真正要传进合约的 data 参数
  const expectedOutput = ethers.BigNumber.from(swapData.dstAmount)

  // Security confirmation
  console.log("\n🔒 Security confirmation:")
  console.log("📍 Network:", network.name)
  console.log("👤 User address:", userAddress)
  console.log("🔑 NullifierHash:", nullifierHashHex)
  console.log("🎯 TokenOut:", tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? "ETH" : tokenOut)
  console.log("💱 Estimated output:", ethers.utils.formatUnits(
    expectedOutput,
    tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 18 : decimalsOut
  ), tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? "ETH" : "TOKEN")
  console.log("🔄 Mixing service: Operator executes swap on behalf of user")
  console.log("\n⚠️ This is a real mainnet transaction executed by operator!")
  console.log("✅ Please confirm all information is correct")

  // 4. Prepare API call signature - api/v1/swap(chainIndex, swapConfigId, nullifierHashHex, outTokenAddress, address, sign)
  console.log("\n🔄 Preparing swap signature...")
  
  const chainIndex = network.chainId
  const messageToSign = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256', 'bytes32', 'address', 'address'],
    [chainIndex, swapConfigId, nullifierHashHex, tokenOut, userAddress]
  )
  
  console.log('📝 Message to sign:', messageToSign)
  console.log('🔄 Requesting user signature...')
  
  let signature
  try {
    signature = await signer.signMessage(ethers.utils.arrayify(messageToSign))
    console.log('✅ Signature obtained:', signature)
  } catch (signError) {
    console.error('❌ User rejected signature:', signError)
    throw new Error('User rejected transaction signature')
  }

  // 5. Execute swap through Iceberg API
  console.log("\n🔄 Executing swap through API...")
  console.log('📝 API call parameters:')
  console.log('  chainIndex:', chainIndex)
  console.log('  swapConfigId:', swapConfigId) 
  console.log('  nullifierHashHex:', nullifierHashHex)
  console.log('  outTokenAddress:', tokenOut)
  console.log('  address:', userAddress)
  console.log('  signature:', signature)

  // Execute swap directly through Iceberg contract
  console.log("\n🔄 Executing swap directly on blockchain...")
  
  // Define Iceberg contract ABI
  const ICEBERG_ABI = [
    'function getSwapConfig(uint256 configId) external view returns (tuple(address tokenIn, uint256 fixedAmount))',
    'function nullifierHashUsed(bytes32 nullifierHash) external view returns (bool)',
    'function executeSwap(bytes32 nullifierHash, uint256 swapConfigId, address tokenOut, address executor, tuple(address srcToken, address dstToken, address srcReceiver, address dstReceiver, uint256 amount, uint256 minReturnAmount, uint256 flags) desc, bytes data) external',
    'function getSwapResult(bytes32 nullifierHash) external view returns (tuple(address tokenOut, uint256 amount))',
    'event SwapResultRecorded(bytes32 indexed nullifierHash, address tokenOut, uint256 amountOut)'
  ]
  
  // Create operator signer using deployer private key
  console.log("🔑 Creating operator signer...")
  const DEPLOYER_PRIVATE_KEY = process.env.REACT_APP_OPERATOR_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY
  
  if (!DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not found in environment variables")
  }
  const operatorSigner = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider)
  
  console.log("👮 Operator address:", operatorSigner.address)
  console.log("👤 User address:", userAddress)
  
  // Check operator balance
  const operatorBalance = await operatorSigner.getBalance()
  console.log("💰 Operator balance:", ethers.utils.formatEther(operatorBalance), "ETH")
  
  const minBalance = ethers.utils.parseEther("0.00001")
  if (operatorBalance.lt(minBalance)) {
    throw new Error("Operator insufficient balance, at least 0.00001 ETH needed for gas fees")
  }
  
  // Connect to Iceberg contract using operator signer
  const pool = new ethers.Contract(ICEBERG_CONTRACT_ADDRESS, ICEBERG_ABI, operatorSigner)
  
  // Check if nullifierHash has been used
  const isUsed = await pool.nullifierHashUsed(nullifierHashHex)
  if (isUsed) {
    throw new Error('NullifierHash already used, cannot repeat swap')
  }
  
  // Get swap config to verify
  const config = await pool.getSwapConfig(swapConfigId)
  console.log('📋 Swap config verification:')
  console.log('  TokenIn:', config.tokenIn === ethers.constants.AddressZero ? 'ETH' : config.tokenIn)
  console.log('  FixedAmount:', ethers.utils.formatUnits(config.fixedAmount, decimalsIn))
  
  // Gas estimation
  console.log('\n⛽ Estimating gas fees...')
  const gasEstimate = await pool.estimateGas.executeSwap(
    nullifierHashHex,
    swapConfigId,
    tokenOut,
    executor,
    desc,
    innerData
  )
  const gasPrice = await provider.getGasPrice()
  const estimatedCost = gasEstimate.mul(gasPrice)
  
  console.log('⛽ Estimated gas:', gasEstimate.toString())
  console.log('⛽ Gas price:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'Gwei')
  console.log('⛽ Estimated cost:', ethers.utils.formatEther(estimatedCost), 'ETH')
  
  // Execute swap through Iceberg using operator account
  console.log('🔄 Executing swap transaction using operator account...')
  console.log('👮 Transaction will be sent by operator:', operatorSigner.address)
  console.log('👤 Swap is for user:', userAddress)
  
  const tx = await pool.executeSwap(
    nullifierHashHex,
    swapConfigId,
    tokenOut,
    executor,
    desc,
    innerData,
    {
      gasLimit: gasEstimate.add(20000)  // 使用 estimation + 20k 缓冲，进一步减少 gas limit
    }
  )
  
  console.log('📤 Transaction sent:', tx.hash)
  console.log('⏳ Waiting for confirmation...')
  
  const receipt = await tx.wait()

  console.log("✅ Swap recorded successfully!")
  console.log("📄 Transaction hash:", receipt.transactionHash)
  console.log("⛽ Gas used:", receipt.gasUsed.toString())
  console.log("🌐 Block explorer:", `https://${network.chainId === 42161 ? 'arbiscan.io' : 'etherscan.io'}/tx/${receipt.transactionHash}`)

  // Check events for actual output amount
  const swapEvent = receipt.events?.find((e) => e.event === "SwapResultRecorded")
  let actualOutputAmount = expectedOutput
  
  if (swapEvent) {
    actualOutputAmount = swapEvent.args.amountOut
    console.log("📊 Swap record event:")
    console.log("  NullifierHash:", swapEvent.args.nullifierHash)
    console.log("  TokenOut:", swapEvent.args.tokenOut)
    console.log("  AmountOut:", ethers.utils.formatUnits(
      actualOutputAmount,
      tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 18 : decimalsOut
    ))
  }

  // Return swap result with actual transaction data
  const formattedAmount = ethers.utils.formatUnits(actualOutputAmount, decimalsOut)
  const roundedAmount = parseFloat(formattedAmount).toFixed(5)

  const swapResult = {
    nullifierHashHex,
    swapConfigId,
    transactionHash: receipt.transactionHash,
    timestamp: new Date().toISOString(),
    gasUsed: receipt.gasUsed.toString(),
    executor,
    expectedOutput: expectedOutput.toString(),
    actualOutput: actualOutputAmount.toString(),
    formattedOutput: roundedAmount,
    tokenOut,
    success: true,
    // 标记为真实交易
    isRealTransaction: true
  }

  console.log('\n🎉 Iceberg Swap execution completed!')
  console.log('💡 Now user can withdraw funds')
  console.log('🔗 Transaction link:', `https://${network.chainId === 42161 ? 'arbiscan.io' : 'etherscan.io'}/tx/${receipt.transactionHash}`)

  return swapResult
}

/**
 * Get 1inch price quote for swap estimation
 * @param {string} srcToken - Source token address
 * @param {string} dstToken - Destination token address  
 * @param {string} amount - Amount to swap (in wei)
 * @param {number} chainId - Network chain ID
 * @returns {Promise<string>} Estimated output amount
 */
export async function get1inchQuote(srcToken, dstToken, amount, chainId = 42161) {
  try {
    console.log('🔄 Getting 1inch price quote...')
    
    // 使用本地代理服务器避免CORS问题
    const response = await axios.get('http://localhost:8080/api/1inch/swap/v6.0/42161/quote', {
      params: {
        src: srcToken === ethers.constants.AddressZero ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : srcToken,
        dst: dstToken === ethers.constants.AddressZero ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : dstToken,
        amount: amount.toString(),
        includeTokensInfo: true,
        includeProtocols: true
      },
      timeout: 10000
    })
    
    if (response.data && response.data.dstAmount) {
      console.log('✅ 1inch quote received:', response.data.dstAmount)
      return response.data.dstAmount
    } else {
      throw new Error('Invalid response format')
    }
    
  } catch (error) {
    console.error('❌ Failed to get 1inch quote:', error)
    throw error
  }
}
import { ethers } from 'ethers'
const { poseidon2 } = require("poseidon-lite")

// Iceberg 合约 ABI - 添加 deposit 方法
const ICEBERG_ABI = [
  'function nextSwapConfigId() external view returns (uint256)',
  'function getSwapConfig(uint256 configId) external view returns (tuple(address tokenIn, uint256 fixedAmount))',
  'function deposit(bytes32 commitment, uint256 swapConfigId) external payable',
  'function getMerkleRoot() external view returns (bytes32)',
  'event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 swapConfigId)'
]

// ERC20 ABI for approve
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)'
]

/**
 * 执行存款操作 - 完全按照 deposit.ts 逻辑
 * @param {Object} params - 存款参数
 * @param {string} params.poolAddress - 合约地址
 * @param {Object} params.selectedAsset - 选中的资产
 * @param {string} params.secret - 用户生成的 secret 字符串
 * @param {Object} params.signer - 钱包签名器
 * @param {function} params.onProgress - 进度回调
 * @returns {Promise<Object>} 存款结果
 */
export async function executeDeposit({
  poolAddress,
  selectedAsset,
  secret,
  signer,
  onProgress = () => {},
  onTransactionSent = () => {}
}) {
  try {
    onProgress('Starting deposit process...')
    console.log('💰 Execute deposit...')

    // 网络安全检查
    const network = await signer.provider.getNetwork()
    console.log('🌐 Current network:', network.name, 'Chain ID:', network.chainId)
    
    if (network.chainId !== 42161 && network.chainId !== 1) {
      console.log('⚠️ Warning: current network is not mainnet')
    }

    // 获取用户地址和余额
    const userAddress = await signer.getAddress()
    const balance = await signer.getBalance()
    console.log('👤 User address:', userAddress)
    console.log('💰 User balance:', ethers.utils.formatEther(balance), 'ETH')

    // 余额检查 - 降低最低ETH要求
    const minBalance = ethers.utils.parseEther('0.0001') // 降低到0.0001 ETH
    if (balance.lt(minBalance)) {
      const currentBalance = ethers.utils.formatEther(balance)
      throw new Error(`Insufficient ETH for gas fees. Current: ${currentBalance} ETH, Required: at least 0.0001 ETH. Please add ETH to your wallet.`)
    }

    onProgress('Connecting to contract...')
    
    // 连接到Iceberg合约
    console.log('📡 Connecting to Iceberg contract...')
    const pool = new ethers.Contract(poolAddress, ICEBERG_ABI, signer)

    // 使用selectedAsset中已有的配置信息
    const requestedId = selectedAsset.configId
    
    // 使用selectedAsset中的真实配置数据
    const config = {
      tokenIn: selectedAsset.tokenAddress || ethers.constants.AddressZero,
      fixedAmount: ethers.BigNumber.from(selectedAsset.fixedAmount || '1000000000000000000')
    }
    
    console.log('📋 使用的 SwapConfig:')
    console.log('  ConfigID:', requestedId)
    console.log('  TokenIn:', config.tokenIn === ethers.constants.AddressZero ? 'ETH' : config.tokenIn)
    console.log('  TokenName:', selectedAsset.tokenSymbol)
    console.log('  FixedAmount:', selectedAsset.fixedAmountFormatted, selectedAsset.tokenSymbol)
    console.log('✅ Config is valid, ready to deposit')

    onProgress('Generating commitment data...')
    
    // 按照用户要求：secret = 用户输入的secret，nullifier = secret字符串的倒置
    console.log('🔐 Generate commitment data using user secret...')
    console.log('🔧 User input secret:', secret)
    
    // 计算nullifier（secret字符串的倒置）
    const reversedSecret = secret.split('').reverse().join('')
    console.log('🔧 Nullifier (reversed secret):', reversedSecret)
    
    // 转换为BigInt用于poseidon计算
    let secretBigInt, nullifierBigInt
    
    // 对于UUID格式的secret，使用keccak256哈希
    if (secret.match(/[^0-9]/)) {
      console.log('📋 Using hash conversion for non-numeric secret')
      const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(secret))
      const nullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(reversedSecret))
      secretBigInt = BigInt(secretHash)
      nullifierBigInt = BigInt(nullifierHash)
      console.log('  Secret hash:', secretHash)
      console.log('  Nullifier hash:', nullifierHash)
    } else {
      // 对于纯数字secret，直接转换
      console.log('📋 Using numeric conversion')
      secretBigInt = BigInt(secret)
      nullifierBigInt = BigInt(reversedSecret)
    }
    
    console.log('  Secret BigInt:', secretBigInt.toString())
    console.log('  Nullifier BigInt:', nullifierBigInt.toString())
    
    // 计算commitment = poseidon2(nullifier, secret)
    const commitment = poseidon2([
      nullifierBigInt.toString(),
      secretBigInt.toString()
    ])
    const commitmentHex = "0x" + ethers.BigNumber.from(commitment.toString()).toHexString().slice(2).padStart(64, '0')

    console.log('🔑 Generated commitment data:')
    console.log('  User secret:', secret)
    console.log('  Nullifier (reversed):', reversedSecret)
    console.log('  Secret BigInt:', secretBigInt.toString())
    console.log('  Nullifier BigInt:', nullifierBigInt.toString())
    console.log('  Commitment:', commitmentHex)

    // 对于ERC20代币，先检查并处理approve
    if (config.tokenIn !== ethers.constants.AddressZero) {
      const token = new ethers.Contract(config.tokenIn, ERC20_ABI, signer)
      
      console.log('🔍 Checking token allowance...')
      const currentAllowance = await token.allowance(userAddress, poolAddress)
      console.log('Current allowance:', ethers.utils.formatUnits(currentAllowance, selectedAsset.decimals))
      console.log('Required amount:', ethers.utils.formatUnits(config.fixedAmount, selectedAsset.decimals))
      
      if (currentAllowance.lt(config.fixedAmount)) {
        console.log('🔓 Need to approve token spend...')
        onProgress('Approving token spend...')
        const approveTx = await token.approve(poolAddress, config.fixedAmount)
        await approveTx.wait()
        console.log('✅ Approve completed')
      } else {
        console.log('✅ Sufficient allowance already exists')
      }
    }

    onProgress('Estimating gas fees...')
    
    // Gas估算和费用计算
    console.log('⛽ Estimating gas fees...')
    let gasEstimate, gasPrice
    
    if (config.tokenIn === ethers.constants.AddressZero) {
      // ETH deposit gas估算
      gasEstimate = await pool.estimateGas.deposit(commitmentHex, requestedId, {
        value: config.fixedAmount
      })
    } else {
      // ERC20 deposit gas估算 - 现在应该有足够的allowance了
      gasEstimate = await pool.estimateGas.deposit(commitmentHex, requestedId)
    }
    
    gasPrice = await signer.provider.getGasPrice()
    const estimatedCost = gasEstimate.mul(gasPrice)
    
    console.log('⛽ Estimated gas:', gasEstimate.toString())
    console.log('⛽ Gas price:', ethers.utils.formatUnits(gasPrice, 'gwei'), 'Gwei')
    console.log('⛽ Estimated cost:', ethers.utils.formatEther(estimatedCost), 'ETH')

    // 安全确认信息
    const depositInfo = {
      network: network.name,
      depositAmount: selectedAsset.fixedAmountFormatted,
      tokenSymbol: selectedAsset.tokenSymbol,
      estimatedCost: ethers.utils.formatEther(estimatedCost),
      userAddress,
      configId: requestedId
    }

    console.log('🔒 Security confirmation:')
    console.log('📍 Network:', depositInfo.network)
    console.log('💰 Deposit amount:', depositInfo.depositAmount, depositInfo.tokenSymbol)
    console.log('⛽ Estimated cost:', depositInfo.estimatedCost, 'ETH')
    console.log('⚠️ This is a real transaction on mainnet, will consume real funds!')

    onProgress('Executing deposit transaction...')

    // 执行真实的deposit交易
    console.log('💸 Execute mainnet deposit transaction...')
    
    let tx
    if (config.tokenIn === ethers.constants.AddressZero) {
      // ETH deposit
      tx = await pool.connect(signer).deposit(commitmentHex, requestedId, {
        value: config.fixedAmount
      })
    } else {
      // ERC20 deposit - approve已经在前面完成
      tx = await pool.connect(signer).deposit(commitmentHex, requestedId)
    }

    console.log('📤 Transaction sent:', tx.hash)
    
    // 立即触发pending通知
    onTransactionSent(tx.hash)
    
    // 等待交易确认
    onProgress('Waiting for transaction confirmation...')
    console.log('⏳ Wait for transaction confirmation...')
    
    const receipt = await tx.wait()
    
    console.log('✅ Deposit completed!')
    console.log('📄 Transaction hash:', receipt.transactionHash)
    console.log('⛽ Gas used:', receipt.gasUsed.toString())

    // 检查事件
    const depositEvent = receipt.events?.find((e) => e.event === "Deposit")
    let eventInfo = {}
    if (depositEvent) {
      eventInfo = {
        commitment: depositEvent.args.commitment,
        leafIndex: depositEvent.args.leafIndex.toString(),
        swapConfigId: depositEvent.args.swapConfigId.toString()
      }
      console.log('📊 Deposit event:', eventInfo)
    }

    // 检查merkle tree状态
    const merkleRoot = await pool.getMerkleRoot()
    console.log('🌲 Updated Merkle Root:', merkleRoot)

    // 准备存款数据用于后续步骤 - 使用真实的secret和nullifier
    const depositData = {
      userA: userAddress, // 与scripts中的字段名一致
      swapConfigId: requestedId.toString(), // 转换为字符串与scripts一致
      // 使用真实的nullifier和secret值
      nullifier: nullifierBigInt.toString(), // 保存BigInt字符串格式
      secret: secretBigInt.toString(), // 保存BigInt字符串格式
      nullifierHex: "0x" + nullifierBigInt.toString(16).padStart(64, '0'), // hex格式
      secretHex: "0x" + secretBigInt.toString(16).padStart(64, '0'), // hex格式
      commitment: commitmentHex,
      transactionHash: receipt.transactionHash,
      timestamp: new Date().toISOString(),
      network: network.name,
      chainId: network.chainId,
      configInfo: {
        tokenName: selectedAsset.tokenSymbol,
        tokenIn: config.tokenIn,
        fixedAmount: config.fixedAmount.toString(),
        fixedAmountFormatted: selectedAsset.fixedAmountFormatted,
        decimals: selectedAsset.decimals
      },
      eventInfo,
      merkleRoot: merkleRoot,
      gasUsed: receipt.gasUsed.toString(),
      // 添加用于前端的额外信息
      secretString: secret, // 保存原始字符串secret用于UI
      nullifierString: reversedSecret, // 保存原始字符串nullifier用于UI
      // 标记为真实交易并使用用户secret
      isRealTransaction: true,
      usesUserSecret: true
    }

    console.log('🎉 Deposit completed!')
    console.log('💡 User A has successfully deposited funds, can continue to execute swap operation')
    onProgress('Deposit completed successfully!')

    return {
      success: true,
      data: depositData,
      receipt: receipt
    }

  } catch (error) {
    console.error('❌ Deposit failed:', error)
    
    let errorMessage = error.message
    if (error.message.includes('Invalid ETH amount')) {
      errorMessage = 'Incorrect ETH amount, please check the fixed amount in swap configuration'
    } else if (error.message.includes('ERC20: insufficient allowance')) {
      errorMessage = 'Insufficient token allowance, please ensure user has enough token balance'
    } else if (error.message.includes('user rejected')) {
      errorMessage = 'User cancelled the transaction'
    }

    throw new Error(errorMessage)
  }
}

/**
 * 检查用户是否有足够的代币余额
 * @param {string} tokenAddress - 代币地址
 * @param {string} userAddress - 用户地址
 * @param {string} amount - 需要的金额
 * @param {Object} provider - Provider
 * @returns {Promise<boolean>} 是否有足够余额
 */
export async function checkTokenBalance(tokenAddress, userAddress, amount, provider) {
  try {
    if (tokenAddress === ethers.constants.AddressZero) {
      // ETH 余额检查
      const balance = await provider.getBalance(userAddress)
      return balance.gte(amount)
    } else {
      // ERC20 余额检查
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
      const balance = await token.balanceOf(userAddress)
      return balance.gte(amount)
    }
  } catch (error) {
    console.error('Balance check failed:', error)
    return false
  }
}
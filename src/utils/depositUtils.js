import { ethers } from 'ethers'

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

    // 余额检查
    const minBalance = ethers.utils.parseEther('0.0002')
    if (balance.lt(minBalance)) {
      throw new Error('Insufficient balance, at least 0.0002 ETH required for gas fees')
    }

    onProgress('Connecting to contract...')
    
    // 🎭 模拟合约连接和配置获取
    console.log('🎭 Simulating contract connection and config retrieval...')
    const pool = new ethers.Contract(poolAddress, ICEBERG_ABI, signer)

    // 使用selectedAsset中已有的配置信息，避免真实合约调用
    const requestedId = selectedAsset.configId
    
    // 模拟config对象，使用selectedAsset中的数据
    const config = {
      tokenIn: selectedAsset.tokenAddress || ethers.constants.AddressZero,
      fixedAmount: ethers.BigNumber.from(selectedAsset.fixedAmount || '1000000000000000000') // 默认1 ETH
    }
    
    console.log('📋 使用的 SwapConfig (模拟):')
    console.log('  ConfigID:', requestedId)
    console.log('  TokenIn:', config.tokenIn === ethers.constants.AddressZero ? 'ETH' : config.tokenIn)
    console.log('  TokenName:', selectedAsset.tokenSymbol)
    console.log('  FixedAmount:', selectedAsset.fixedAmountFormatted, selectedAsset.tokenSymbol)
    console.log('🎭 Note: Using mock config data for simulation')

    onProgress('Generating commitment data...')
    
    // 生成 nullifier 和处理 secret - 按照 scripts/mainnet/deposit.ts 逻辑
    console.log('🔐 Generate commitment data...')
    
    // 按照scripts逻辑：nullifier 为 secret 字符串的倒置，然后转换为bytes31
    const nullifierString = secret.split('').reverse().join('')
    
    // 将字符串转换为31字节的二进制数据（模拟scripts中的randomBytes(31)）
    const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(secret))
    const nullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(nullifierString))
    
    // 截取前31字节模拟randomBytes(31)的结果
    const secretBytes31 = secretHash.slice(0, 64) // 32 bytes hex -> 31 bytes
    const nullifierBytes31 = nullifierHash.slice(0, 64) // 32 bytes hex -> 31 bytes
    
    // 转换为BigNumber用于模拟poseidon2计算
    const secretBN = ethers.BigNumber.from(secretBytes31)
    const nullifierBN = ethers.BigNumber.from(nullifierBytes31)
    
    // 临时使用keccak256模拟poseidon2([nullifier, secret])
    // TODO: 在安装poseidon-lite后改为真正的poseidon2计算
    const commitment = ethers.utils.keccak256(
      ethers.utils.concat([
        ethers.utils.hexZeroPad(nullifierBN.toHexString(), 32),
        ethers.utils.hexZeroPad(secretBN.toHexString(), 32)
      ])
    )

    console.log('🔑 Generated data:')
    console.log('  Secret:', secret)
    console.log('  Nullifier:', nullifierString)
    console.log('  SecretBytes31:', secretBytes31)
    console.log('  NullifierBytes31:', nullifierBytes31)
    console.log('  Commitment:', commitment)
    console.log('⚠️ Using keccak256 instead of poseidon2 - for testing only!')

    onProgress('Simulating gas estimation...')
    
    // 🎭 模拟Gas预估 - 避免真实区块链调用
    console.log('🎭 Simulating gas fee estimation...')
    
    // 模拟gas参数
    const mockGasEstimate = ethers.BigNumber.from('150000') // 模拟gas估算
    const mockGasPrice = ethers.utils.parseUnits('20', 'gwei') // 模拟gas价格
    const mockEstimatedCost = mockGasEstimate.mul(mockGasPrice)
    
    console.log('⛽ Mock estimated gas:', mockGasEstimate.toString())
    console.log('⛽ Mock gas price:', ethers.utils.formatUnits(mockGasPrice, 'gwei'), 'Gwei')
    console.log('⛽ Mock estimated cost:', ethers.utils.formatEther(mockEstimatedCost), 'ETH')

    // 安全确认信息
    const depositInfo = {
      network: network.name,
      depositAmount: selectedAsset.fixedAmountFormatted,
      tokenSymbol: selectedAsset.tokenSymbol,
      estimatedCost: ethers.utils.formatEther(mockEstimatedCost),
      userAddress,
      configId: requestedId
    }

    console.log('🔒 Mock security confirmation:')
    console.log('📍 Network:', depositInfo.network)
    console.log('💰 Deposit amount:', depositInfo.depositAmount, depositInfo.tokenSymbol)
    console.log('⛽ Mock estimated cost:', depositInfo.estimatedCost, 'ETH')
    console.log('🎭 Note: This is a simulation - no real transaction will be sent')

    onProgress('Simulating deposit transaction...')

    // 🎭 模拟交易执行 - 不发出真实交易
    console.log('🎭 Simulating deposit transaction (no real blockchain transaction)...')
    
    // 生成模拟交易hash
    const mockTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')
    console.log('📤 Mock transaction hash:', mockTxHash)
    
    // 立即触发pending通知
    onTransactionSent(mockTxHash)
    
    // 模拟交易确认延迟
    onProgress('Waiting for transaction confirmation...')
    console.log('⏳ Simulating transaction confirmation...')
    
    await new Promise(resolve => setTimeout(resolve, 3000)) // 3秒延迟模拟确认
    
    // 模拟交易receipt
    const mockReceipt = {
      transactionHash: mockTxHash,
      blockNumber: Math.floor(Math.random() * 1000000) + 18000000, // 模拟区块号
      gasUsed: ethers.BigNumber.from('150000'), // 模拟gas使用量
      status: 1 // 成功状态
    }
    
    console.log('✅ Mock deposit completed!')
    console.log('📄 Mock transaction hash:', mockReceipt.transactionHash)
    console.log('⛽ Mock gas used:', mockReceipt.gasUsed.toString())

    // 模拟事件信息
    const eventInfo = {
      commitment: commitment,
      leafIndex: Math.floor(Math.random() * 1000).toString(), // 模拟leafIndex
      swapConfigId: requestedId.toString()
    }
    console.log('📊 Mock deposit event:', eventInfo)

    // 模拟merkle root
    const mockMerkleRoot = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')
    console.log('🌲 Mock merkle root:', mockMerkleRoot)

    // 准备存款数据用于后续步骤 - 按照scripts/mainnet/deposit.ts格式
    const depositData = {
      userA: userAddress, // 与scripts中的字段名一致
      swapConfigId: requestedId.toString(), // 转换为字符串与scripts一致
      nullifier: nullifierBytes31, // 保存bytes31格式
      secret: secretBytes31, // 保存bytes31格式
      commitment,
      transactionHash: mockReceipt.transactionHash,
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
      merkleRoot: mockMerkleRoot,
      gasUsed: mockReceipt.gasUsed.toString(),
      // 添加用于前端的额外信息
      secretString: secret, // 保存原始字符串secret用于UI
      nullifierString: nullifierString, // 保存倒置的nullifier字符串
      // 标记为模拟交易
      isMockTransaction: true
    }

    console.log('🎉 Mock deposit completed!')
    console.log('🎭 This was a simulated transaction - no real funds were moved')
    onProgress('Mock deposit completed!')

    return {
      success: true,
      data: depositData,
      receipt: mockReceipt
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
import { ethers } from 'ethers'

// Iceberg 合约 ABI (只包含需要的方法)
const ICEBERG_ABI = [
  'function nextSwapConfigId() external view returns (uint256)',
  'function getSwapConfig(uint256 configId) external view returns (tuple(address tokenIn, uint256 fixedAmount))'
]

// 验证方法签名
console.log('🔍 nextSwapConfigId method signature:', ethers.utils.id('nextSwapConfigId()').slice(0, 10))

/**
 * 获取可用的存款资产列表 - 完全按照 listSwapConfigs.ts 的逻辑
 * @param {string} poolAddress - Iceberg 合约地址
 * @param {object} provider - ethers provider
 * @returns {Promise<Array>} 资产配置列表
 */
export async function getDepositAssets(poolAddress, provider) {
  try {
    console.log('📋 Viewing deposit asset list...')
    console.log('🔗 Pool Address:', poolAddress)
    console.log('🌍 Provider:', provider)
    
    // 获取网络信息
    const network = await provider.getNetwork()
    console.log('🌐 Current network:', network.name, 'Chain ID:', network.chainId)
    console.log('🌐 Network details:', network)
    
    if (network.chainId !== 42161 && network.chainId !== 1) {
      console.log('⚠️ Warning: Currently not in mainnet environment')
    }
    
    // 设置代币地址 - 完全按照 listSwapConfigs.ts
    let usdcAddress, usdtAddress, daiAddress
    
    if (network.chainId === 42161) {
      // Arbitrum One mainnet token addresses
      usdcAddress = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" // USDC.e on Arbitrum
      usdtAddress = "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" // USDT on Arbitrum  
      daiAddress = "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"  // DAI on Arbitrum
    } else if (network.chainId === 1) {
      // Ethereum mainnet token addresses
      usdcAddress = "0xA0b86a33E6441B8d08A88C57226F14B1ead5BeF3" // USDC on Ethereum
      usdtAddress = "0xdAC17F958D2ee523a2206206994597C13D831ec7" // USDT on Ethereum
      daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"  // DAI on Ethereum
    } else {
      throw new Error("Unsupported network, please run on Arbitrum or Ethereum mainnet")
    }
    
    // 连接到 Iceberg 合约
    const pool = new ethers.Contract(poolAddress, ICEBERG_ABI, provider)
    console.log('🏠 Iceberg:', poolAddress)
    console.log('📋 Contract instance:', pool)
    
    // 先尝试获取网络的最新区块号来验证连接
    try {
      const blockNumber = await provider.getBlockNumber()
      console.log('📦 Current block number:', blockNumber)
    } catch (error) {
      console.error('❌ Failed to get block number:', error)
      throw new Error('Provider connection failed')
    }
    
    // 检查合约地址是否有代码
    try {
      const code = await provider.getCode(poolAddress)
      console.log('📄 Contract code length:', code.length)
      if (code === '0x') {
        throw new Error(`No contract found at address ${poolAddress}`)
      }
    } catch (error) {
      console.error('❌ Failed to get contract code:', error)
      throw error
    }
    
    // 获取下一个配置 ID，当前总配置数 = nextSwapConfigId - 1
    console.log('🔍 Calling nextSwapConfigId()...')
    try {
      const nextConfigId = await pool.nextSwapConfigId()
      const totalConfigs = nextConfigId.toNumber() - 1
      
      console.log('\n📊 SwapConfig statistics:')
      console.log(`📈 Total config count: ${totalConfigs}`)
      console.log(`🔢 Next config ID: ${nextConfigId.toString()}`)
      
      if (totalConfigs === 0) {
        console.log('\n❌ Currently no SwapConfig exists')
        return []
      }
      
      const assets = []
      let validConfigs = 0
      
      for (let i = 1; i <= totalConfigs; i++) {
        try {
          const config = await pool.getSwapConfig(i)
          
          // 确定代币名称和小数位数 - 完全按照 listSwapConfigs.ts 逻辑
          let tokenName, decimals, formattedAmount
          
          if (config.tokenIn === ethers.constants.AddressZero) {
            tokenName = "ETH"
            decimals = 18
            formattedAmount = ethers.utils.formatEther(config.fixedAmount)
          } else if (config.tokenIn === usdcAddress) {
            tokenName = "USDC"
            decimals = 6
            formattedAmount = ethers.utils.formatUnits(config.fixedAmount, 6)
          } else if (config.tokenIn === usdtAddress) {
            tokenName = "USDT"
            decimals = 6
            formattedAmount = ethers.utils.formatUnits(config.fixedAmount, 6)
          } else if (config.tokenIn === daiAddress) {
            tokenName = "DAI"
            decimals = 18
            formattedAmount = ethers.utils.formatEther(config.fixedAmount)
          } else {
            tokenName = "Unknown"
            decimals = 18
            formattedAmount = config.fixedAmount.toString()
          }
          
          // 获取代币图标
          const img = getTokenImage(tokenName)
          
          const asset = {
            configId: i,
            tokenAddress: config.tokenIn,
            tokenName: getTokenFullName(tokenName),
            tokenSymbol: tokenName,
            ticker: tokenName, // 为了兼容现有代码
            name: getTokenFullName(tokenName), // 为了兼容现有代码
            decimals: decimals,
            fixedAmount: config.fixedAmount.toString(),
            fixedAmountFormatted: formattedAmount,
            img: img,
            isValid: true
          }
          
          assets.push(asset)
          validConfigs++
          
          console.log(`✅ Config ${i}: ${tokenName} - ${formattedAmount} ${tokenName}`)
          
        } catch (error) {
          console.log(`❌ Config ${i}: INVALID`)
        }
      }
      
      console.log(`\n📊 Configuration statistics:`)
      console.log(`✅ Valid configurations: ${validConfigs}`)
      console.log(`❌ Invalid configurations: ${totalConfigs - validConfigs}`)
      
      return assets
      
    } catch (error) {
      console.error('❌ Contract call failed:', error)
      throw new Error(`Contract call failed: ${error.message}`)
    }
    
  } catch (error) {
    console.error('❌ Failed to fetch deposit assets:', error)
    throw error
  }
}

/**
 * 获取代币完整名称
 * @param {string} tokenSymbol - 代币符号
 * @returns {string} 完整名称
 */
function getTokenFullName(tokenSymbol) {
  switch (tokenSymbol) {
    case 'ETH':
      return 'Ethereum'
    case 'USDC':
      return 'USD Coin'
    case 'USDT':
      return 'Tether USD'
    case 'DAI':
      return 'Dai Stablecoin'
    default:
      return 'Unknown Token'
  }
}

/**
 * 获取代币图标
 * @param {string} tokenSymbol - 代币符号
 * @returns {string} 图标URL
 */
function getTokenImage(tokenSymbol) {
  switch (tokenSymbol) {
    case 'ETH':
      return 'https://s2.coinmarketcap.com/static/img/coins/64x64/1027.png'
    case 'USDC':
      return 'https://s2.coinmarketcap.com/static/img/coins/64x64/3408.png'
    case 'USDT':
      return 'https://s2.coinmarketcap.com/static/img/coins/64x64/825.png'
    case 'DAI':
      return 'https://s2.coinmarketcap.com/static/img/coins/64x64/4943.png'
    default:
      return 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png' // Bitcoin as default
  }
}

/**
 * 从配置文件获取合约地址
 * @returns {Promise<string>} Iceberg 合约地址
 */
export async function getIcebergAddress() {
  try {
    const response = await fetch('/config/deployment.json')
    const config = await response.json()
    return config.contracts.Iceberg
  } catch (error) {
    console.warn('Failed to load deployment config, using Arbitrum mainnet address')
    // 使用 Arbitrum 主网的 Iceberg 合约地址作为默认值
    return '0xE0aFa53dD37432265dd68FdbC91a06B12F997380'
  }
}
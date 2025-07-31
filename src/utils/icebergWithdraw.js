/**
 * Iceberg Withdraw utility function
 * Encapsulated from scripts/mainnet/withdraw.ts for direct frontend usage
 * Executes withdrawal operations through Iceberg contract with ZK proof
 */

import { ethers } from 'ethers'

// Iceberg contract address
const ICEBERG_CONTRACT_ADDRESS = "0xE0aFa53dD37432265dd68FdbC91a06B12F997380"

/**
 * Execute withdrawal through Iceberg contract
 * @param {Object} params - Withdrawal parameters
 * @param {string} params.nullifierHash - Nullifier hash from swap operation
 * @param {string} params.recipientAddress - Recipient address for withdrawal
 * @param {Array<string>} params.proof - ZK proof array (8 elements)
 * @param {Object} params.signer - Ethers signer object
 * @param {Object} params.provider - Ethers provider object
 * @param {string} params.userAddress - User's wallet address
 * @returns {Promise<Object>} Withdrawal result with transaction details
 */
export async function executeIcebergWithdraw(params) {
  const {
    nullifierHash,
    recipientAddress,
    proof,
    signer,
    provider,
    userAddress
  } = params

  console.log("💸 Executing Iceberg Withdrawal operations...")
  
  // Get network information
  const network = await provider.getNetwork()
  console.log("🌐 Current network:", network.name, "Chain ID:", network.chainId)
  
  if (network.chainId !== 42161 && network.chainId !== 1) {
    console.warn("⚠️ Warning: Currently not in mainnet environment")
    console.log("💡 Recommend using this script in mainnet environment")
  }

  // Balance check
  const balance = await signer.getBalance()
  console.log("💰 User balance:", ethers.utils.formatEther(balance), "ETH")

  const minBalance = ethers.utils.parseEther("0.0002")
  if (balance.lt(minBalance)) {
    throw new Error("❌ Insufficient balance, at least 0.0002 ETH required for gas fees")
  }

  console.log("📮 Recipient address:", recipientAddress)
  console.log("🔑 NullifierHash:", nullifierHash)

  // Connect to Iceberg contract
  const IcebergABI = [
    "function getSwapResult(bytes32 nullifierHash) external view returns (address tokenOut, uint256 amount)",
    "function withdraw(bytes32 nullifierHash, address recipient, uint256[8] calldata proof) external",
    "event Withdrawal(bytes32 indexed nullifierHash, address indexed recipient, address tokenOut, uint256 amount)"
  ]
  
  const pool = new ethers.Contract(ICEBERG_CONTRACT_ADDRESS, IcebergABI, provider)

  // Check swap status
  console.log("🔍 Checking withdrawable amount...")
  const swapResult = await pool.getSwapResult(nullifierHash)
  if (ethers.BigNumber.from(swapResult.amount).eq(0)) {
    throw new Error("No amount available for withdrawal, swap may not be executed or already withdrawn")
  }

  const tokenOut = swapResult.tokenOut
  const amount = swapResult.amount
  
  console.log("💰 Withdrawable info:")
  console.log("  TokenOut:", tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? "ETH" : tokenOut)
  console.log("  Amount:", ethers.utils.formatUnits(
    amount,
    tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 18 : 6
  ), tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? "ETH" : "Token")

  // Validate proof format
  if (!Array.isArray(proof) || proof.length !== 8) {
    throw new Error("ZK proof format error, must be an array containing 8 elements")
  }
  
  // Validate each proof element and convert to BigNumber
  const proofBigNumbers = []
  proof.forEach((p, i) => {
    try {
      const bn = ethers.BigNumber.from(p.toString())
      proofBigNumbers.push(bn)
    } catch (error) {
      throw new Error(`Proof element ${i} format error, cannot convert to number: ${p}`)
    }
  })

  console.log("✅ ZK proof format validation passed, converted to BigNumber format")
  
  // Display proof details
  console.log("\n📋 Proof details:")
  proofBigNumbers.forEach((p, i) => {
    const labels = ["a[0]", "a[1]", "b[0][0]", "b[0][1]", "b[1][0]", "b[1][1]", "c[0]", "c[1]"]
    console.log(`  ${labels[i]}: ${p.toString()}`)
  })

  // Gas estimation
  console.log("\n⛽ Estimating Gas fees...")
  const gasEstimate = await pool.estimateGas.withdraw(
    nullifierHash,
    recipientAddress,
    proofBigNumbers
  )
  const gasPrice = await provider.getGasPrice()
  const estimatedCost = gasEstimate.mul(gasPrice)
  
  console.log("⛽ Estimated Gas:", gasEstimate.toString())
  console.log("⛽ Gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "Gwei")
  console.log("⛽ Estimated cost:", ethers.utils.formatEther(estimatedCost), "ETH")

  // Security confirmation
  console.log("\n🔒 Security confirmation:")
  console.log("📍 Network:", network.name)
  console.log("🔑 NullifierHash:", nullifierHash)
  console.log("📮 Recipient address:", recipientAddress)
  console.log("💰 Withdrawal amount:", ethers.utils.formatUnits(
    amount,
    tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 18 : 6
  ), tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? "ETH" : "Token")
  console.log("⛽ Estimated cost:", ethers.utils.formatEther(estimatedCost), "ETH")
  console.log("\n⚠️ This is a real mainnet transaction, will consume real funds!")
  console.log("✅ Please confirm all information is correct")

  // Execute withdrawal
  console.log("\n💸 Executing mainnet withdrawal transaction...")
  
  const tx = await pool.connect(signer).withdraw(
    nullifierHash,
    recipientAddress,
    proofBigNumbers,
    {
      gasLimit: gasEstimate.mul(110).div(100) // Give 10% buffer
    }
  )

  console.log("⏳ Waiting for transaction confirmation...")
  const receipt = await tx.wait()
  console.log("✅ Withdrawal successful!")
  console.log("📄 Transaction hash:", receipt.transactionHash)
  console.log("⛽ Gas used:", receipt.gasUsed.toString())
  console.log("🌐 Block explorer:", `https://${network.chainId === 42161 ? 'arbiscan.io' : 'etherscan.io'}/tx/${receipt.transactionHash}`)

  // Check events
  const withdrawEvent = receipt.events?.find(e => e.event === "Withdrawal")
  if (withdrawEvent) {
    console.log("📊 Withdrawal event:")
    console.log("  NullifierHash:", withdrawEvent.args.nullifierHash)
    console.log("  Recipient:", withdrawEvent.args.recipient)
    console.log("  TokenOut:", withdrawEvent.args.tokenOut)
    console.log("  Amount:", ethers.utils.formatUnits(
      withdrawEvent.args.amount,
      tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 18 : 6
    ), tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? "ETH" : "Token")
  }

  // Check recipient address balance change
  if (tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
    // ETH
    const newBalance = await provider.getBalance(recipientAddress)
    console.log("💰 Recipient address new ETH balance:", ethers.utils.formatEther(newBalance), "ETH")
  } else {
    // ERC20 token
    const tokenABI = ["function balanceOf(address owner) view returns (uint256)"]
    const tokenContract = new ethers.Contract(tokenOut, tokenABI, provider)
    const newBalance = await tokenContract.balanceOf(recipientAddress)
    console.log("💰 Recipient address new Token balance:", ethers.utils.formatUnits(newBalance, 6), "Token")
  }

  // Verify post-withdrawal status
  const remainingSwapResult = await pool.getSwapResult(nullifierHash)
  console.log("📊 Remaining withdrawable amount:", ethers.utils.formatUnits(
    remainingSwapResult.amount,
    tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 18 : 6
  ), tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? "ETH" : "Token")

  console.log("\n🎉 Complete mainnet anonymous withdrawal completed!")
  console.log("✅ User has successfully withdrawn funds to recipient address")
  console.log("🔒 Privacy protected: deposit address and withdrawal address are separated")
  console.log("🔗 Transaction link:", `https://${network.chainId === 42161 ? 'arbiscan.io' : 'etherscan.io'}/tx/${receipt.transactionHash}`)

  // Return withdrawal result
  const formattedAmount = ethers.utils.formatUnits(
    amount, 
    tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ? 18 : 6
  )
  
  return {
    success: true,
    transactionHash: receipt.transactionHash,
    gasUsed: receipt.gasUsed.toString(),
    withdrawalAmount: formattedAmount,
    tokenOut: tokenOut,
    recipient: recipientAddress,
    blockExplorer: `https://${network.chainId === 42161 ? 'arbiscan.io' : 'etherscan.io'}/tx/${receipt.transactionHash}`,
    networkName: network.name,
    networkChainId: network.chainId
  }
}

/**
 * Check withdrawable amount for a given nullifier hash
 * @param {string} nullifierHash - Nullifier hash from swap operation
 * @param {Object} provider - Ethers provider object
 * @returns {Promise<Object>} Withdrawable amount and token info
 */
export async function checkWithdrawableAmount(nullifierHash, provider) {
  console.log("🔍 Checking withdrawable amount for nullifier:", nullifierHash)
  
  const IcebergABI = [
    "function getSwapResult(bytes32 nullifierHash) external view returns (address tokenOut, uint256 amount)"
  ]
  
  const pool = new ethers.Contract(ICEBERG_CONTRACT_ADDRESS, IcebergABI, provider)
  
  try {
    const swapResult = await pool.getSwapResult(nullifierHash)
    const tokenOut = swapResult.tokenOut
    const amount = swapResult.amount
    
    const isETH = tokenOut === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    const decimals = isETH ? 18 : 6
    const formattedAmount = ethers.utils.formatUnits(amount, decimals)
    const tokenSymbol = isETH ? "ETH" : "Token"
    
    console.log("💰 Withdrawable info:")
    console.log("  TokenOut:", isETH ? "ETH" : tokenOut)
    console.log("  Amount:", formattedAmount, tokenSymbol)
    
    return {
      success: true,
      tokenOut,
      amount: amount.toString(),
      formattedAmount,
      tokenSymbol,
      isETH,
      decimals,
      hasAmount: !ethers.BigNumber.from(amount).eq(0)
    }
  } catch (error) {
    console.error("❌ Failed to check withdrawable amount:", error.message)
    throw error
  }
}
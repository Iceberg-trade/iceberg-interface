/**
 * Mainnet withdrawal function
 * Execute withdrawal using ZK proof for privacy-preserving transactions
 */

import { ethers } from "ethers";
import { getErrorMessage, errorMessageIncludes } from "./errorUtils";
import { generateProof } from "./generateProof";

// Iceberg contract address
const ICEBERG_CONTRACT_ADDRESS = "0x3db30702b8BCb691aa146069479a20E553FB5F4A";

/**
 * Execute withdrawal transaction
 * @param {string} poolAddress - The Iceberg contract address
 * @param {string} recipientAddress - The recipient address for withdrawal  
 * @param {string} nullifier - The nullifier from deposit data
 * @param {string} secret - The secret from deposit data
 * @param {Object} signer - Ethers signer for transaction
 * @param {string} circuitsRoot - Path to circuits directory (optional)
 * @returns {Object} withdrawal result with transaction receipt and details
 */
async function executeIcebergWithdrawUsingProof(poolAddress, recipientAddress, nullifier, secret, signer, circuitsRoot = null) {
  console.log("Executing mainnet user withdrawal...");

  // Network security check
  const network = await signer.provider.getNetwork();
  console.log("Current network:", network.name, "Chain ID:", network.chainId);
  
  if (network.chainId !== 42161 && network.chainId !== 1) {
    console.log("Warning: Currently not in mainnet environment");
    console.log("Recommend using this script in mainnet environment");
  }

  // Validate inputs
  if (!ethers.utils.isAddress(poolAddress)) {
    throw new Error(`Invalid pool address: ${poolAddress}`);
  }
  
  if (!ethers.utils.isAddress(recipientAddress)) {
    throw new Error(`Invalid recipient address: ${recipientAddress}`);
  }

  if (!nullifier) {
    throw new Error("Nullifier is required");
  }
  
  if (!secret) {
    throw new Error("Secret is required");
  }

  console.log("Signer address:", signer.address);
  const balance = await signer.getBalance();
  console.log("=� Signer balance:", ethers.utils.formatEther(balance), "ETH");

  // Balance check
  const minBalance = ethers.utils.parseEther("0.0002");
  if (balance.lt(minBalance)) {
    throw new Error("Insufficient balance, at least 0.0002 ETH required for gas fees");
  }

  console.log("=� Recipient address:", recipientAddress);
  console.log("<� Contract address:", poolAddress);

  try {
    // Connect to Iceberg contract
    const IcebergABI = [
      "function getSwapResult(bytes32 nullifierHash) external view returns (tuple(address tokenOut, uint256 amount))",
      "function getMerkleRoot() external view returns (bytes32)",
      "function getMerkleProof(uint256 leafIndex) external view returns (bytes32[] memory, bool[] memory)",
      "function withdraw(bytes32 nullifierHash, address recipient, uint256[8] calldata proof) external",
      "function estimateGas() external",
      "event Deposit(bytes32 indexed commitment, uint256 leafIndex, uint256 timestamp)",
      "event Withdrawal(bytes32 indexed nullifierHash, address indexed recipient, address tokenOut, uint256 amount)"
    ];
    
    // Create contract instance - need provider to be passed or use from signer
    const pool = new ethers.Contract(poolAddress, IcebergABI, signer);

    console.log("\n=🔒 Generating ZK proof...");
    // Generate ZK proof using nullifier and secret
    const proofData = await generateProof(recipientAddress, nullifier, secret, poolAddress, circuitsRoot);
    
    console.log("✅ ZK proof generated successfully!");
    console.log("=📁 Proof type:", proofData.type);
    console.log("=🕒 Generated time:", proofData.timestamp);

    // Extract proof and nullifierHash from generated proof data
    const proof = proofData.proof;
    const nullifierHash = proofData.nullifierHash;

    console.log("=🔑 NullifierHash:", nullifierHash);

    // Check swap status
    const swapResult = await pool.getSwapResult(nullifierHash);
    if (ethers.BigNumber.from(swapResult.amount).eq(0)) {
      throw new Error("No amount available for withdrawal, swap may not be executed or already withdrawn");
    }

    const tokenOut = swapResult.tokenOut;
    const amount = swapResult.amount;
    
    console.log("=� Withdrawable info:");
    console.log("  TokenOut:", tokenOut === ethers.constants.AddressZero ? "ETH" : tokenOut);
    console.log("  Amount:", ethers.utils.formatUnits(
      amount,
      tokenOut === ethers.constants.AddressZero ? 18 : 6
    ), tokenOut === ethers.constants.AddressZero ? "ETH" : "Token");

    // Validate proof format
    if (!Array.isArray(proof) || proof.length !== 8) {
      throw new Error("ZK proof format error, must be an array containing 8 elements");
    }
    
    // Validate each proof element is a valid number string and convert to BigNumber
    const proofBigNumbers = [];
    proof.forEach((p, i) => {
      try {
        // Try to convert string to BigNumber
        const bn = ethers.BigNumber.from(p.toString());
        proofBigNumbers.push(bn);
      } catch (error) {
        throw new Error(`Proof element ${i} format error, cannot convert to number: ${p}`);
      }
    });

    console.log(" ZK proof format validation passed, converted to BigNumber format");
    
    
    // Display additional proof details
    console.log("=📋 Additional proof info:");
    if (proofData.runDirectory) {
      console.log("  Run directory:", proofData.runDirectory);
    }
    if (proofData.publicSignals) {
      console.log("  Public signals count:", proofData.publicSignals.length);
    }
    if (proofData.leafIndex !== undefined) {
      console.log("  Leaf index:", proofData.leafIndex);
    }
    if (proofData.commitment) {
      console.log("  Commitment:", proofData.commitment);
    }
    
    // Display proof details
    console.log("\n=🔐 Proof details:");
    proofBigNumbers.forEach((p, i) => {
      const labels = ["a[0]", "a[1]", "b[0][0]", "b[0][1]", "b[1][0]", "b[1][1]", "c[0]", "c[1]"];
      console.log(`  ${labels[i]}: ${p.toString()}`);
    });

    // Gas estimation
    console.log("\n� Estimating Gas fees...");
    const gasEstimate = await pool.estimateGas.withdraw(
      nullifierHash,
      recipientAddress,
      proofBigNumbers
    );
    const gasPrice = await signer.provider.getGasPrice();
    const estimatedCost = gasEstimate.mul(gasPrice);
    
    console.log("� Estimated Gas:", gasEstimate.toString());
    console.log("� Gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "Gwei");
    console.log("� Estimated cost:", ethers.utils.formatEther(estimatedCost), "ETH");

    // Security confirmation
    console.log("\n= Security confirmation:");
    console.log("=� Network:", network.name);
    console.log("= NullifierHash:", nullifierHash);
    console.log("=� Recipient address:", recipientAddress);
    console.log("=� Withdrawal amount:", ethers.utils.formatUnits(
      amount,
      tokenOut === ethers.constants.AddressZero ? 18 : 6
    ), tokenOut === ethers.constants.AddressZero ? "ETH" : "Token");
    console.log("� Estimated cost:", ethers.utils.formatEther(estimatedCost), "ETH");
    console.log("\n� This is a mainnet real transaction, will consume real funds!");
    console.log(" Please confirm all information is correct");

    // Execute withdrawal
    console.log("\n=� Executing mainnet withdrawal transaction...");
    
    const tx = await pool.connect(signer).withdraw(
      nullifierHash,
      recipientAddress,
      proofBigNumbers,
      {
        gasLimit: gasEstimate.mul(110).div(100) // Give 10% buffer
      }
    );

    console.log("� Waiting for transaction confirmation...");
    const receipt = await tx.wait();
    console.log(" Withdrawal successful!");
    console.log("=� Transaction hash:", receipt.transactionHash);
    console.log("� Gas used:", receipt.gasUsed.toString());
    console.log("< Block explorer:", `https://${network.chainId === 42161 ? 'arbiscan.io' : 'etherscan.io'}/tx/${receipt.transactionHash}`);

    // Check events
    const withdrawEvent = receipt.events?.find(e => e.event === "Withdrawal");
    if (withdrawEvent) {
      console.log("=� Withdrawal event:");
      console.log("  NullifierHash:", withdrawEvent.args.nullifierHash);
      console.log("  Recipient:", withdrawEvent.args.recipient);
      console.log("  TokenOut:", withdrawEvent.args.tokenOut);
      console.log("  Amount:", ethers.utils.formatUnits(
        withdrawEvent.args.amount,
        tokenOut === ethers.constants.AddressZero ? 18 : 6
      ), tokenOut === ethers.constants.AddressZero ? "ETH" : "Token");
    }

    // Check recipient address balance change
    let newBalance;
    if (tokenOut === ethers.constants.AddressZero) {
      // ETH
      newBalance = await signer.provider.getBalance(recipientAddress);
      console.log("=� Recipient address new ETH balance:", ethers.utils.formatEther(newBalance), "ETH");
    } else {
      // ERC20 token
      const ERC20ABI = [
        "function balanceOf(address account) external view returns (uint256)"
      ];
      const tokenContract = new ethers.Contract(tokenOut, ERC20ABI, signer);
      newBalance = await tokenContract.balanceOf(recipientAddress);
      console.log("=� Recipient address new Token balance:", ethers.utils.formatUnits(newBalance, 6), "Token");
    }

    // Verify post-withdrawal status
    const remainingSwapResult = await pool.getSwapResult(nullifierHash);
    console.log("=� Remaining withdrawable amount:", ethers.utils.formatUnits(
      remainingSwapResult.amount,
      tokenOut === ethers.constants.AddressZero ? 18 : 6
    ), tokenOut === ethers.constants.AddressZero ? "ETH" : "Token");

    console.log("\n<� Complete mainnet anonymous swap flow execution completed!");
    console.log(" User has successfully withdrawn funds to specified address");
    console.log("= Privacy protected: deposit address and withdrawal address are separated");
    console.log("= Transaction link:", `https://${network.chainId === 42161 ? 'arbiscan.io' : 'etherscan.io'}/tx/${receipt.transactionHash}`);

    // Return withdrawal result
    return {
      success: true,
      transactionHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString(),
      recipient: recipientAddress,
      tokenOut: tokenOut,
      amount: amount.toString(),
      newBalance: newBalance.toString(),
      withdrawEvent: withdrawEvent ? {
        nullifierHash: withdrawEvent.args.nullifierHash,
        recipient: withdrawEvent.args.recipient,
        tokenOut: withdrawEvent.args.tokenOut,
        amount: withdrawEvent.args.amount.toString()
      } : null,
      blockExplorerLink: `https://${network.chainId === 42161 ? 'arbiscan.io' : 'etherscan.io'}/tx/${receipt.transactionHash}`
    };

  } catch (error) {
    console.error("L Withdrawal failed:", getErrorMessage(error));
    
    if (errorMessageIncludes(error, "Invalid proof")) {
      console.log("\n=� Error reason: Invalid ZK proof");
      console.log("Please check if proof data is correct, ensure:");
      console.log("- Proof is generated for correct nullifier and recipient");
      console.log("- Proof data format is correct");
      console.log("- Merkle tree state is consistent with proof generation time");
    } else if (errorMessageIncludes(error, "No swapped amount available")) {
      console.log("\n=� Error reason: No amount available for withdrawal");
      console.log("Please ensure swap has been executed and not withdrawn");
    } else if (errorMessageIncludes(error, "insufficient funds")) {
      console.log("\n=� Error reason: Insufficient account balance");
      console.log("Please ensure account has enough ETH to pay gas fees");
    } else if (errorMessageIncludes(error, "Invalid proof file format")) {
      console.log("\n=� Error reason: Invalid proof file format");
      console.log("Please ensure using correct generateProof script to generate proof");
    }
    
    throw error;
  }
}


/**
 * Check withdrawable amount for a given nullifier hash
 * Following scripts/mainnet/withdraw.ts getSwapResult logic
 * @param {string} nullifierHash - Nullifier hash from swap operation
 * @param {Object} provider - Ethers provider object
 * @returns {Promise<Object>} Withdrawable amount and token info
 */
 async function checkWithdrawableAmount(nullifierHash, provider) {
  console.log("🔍 Checking withdrawable amount for nullifier:", nullifierHash)
  
  const IcebergABI = [
    "function getSwapResult(bytes32 nullifierHash) external view returns (tuple(address tokenOut, uint256 amount))"
  ]
  
  const pool = new ethers.Contract(ICEBERG_CONTRACT_ADDRESS, IcebergABI, provider)
  
  try {
    const swapResult = await pool.getSwapResult(nullifierHash)
    const tokenOut = swapResult.tokenOut
    const amount = swapResult.amount
    
    const isETH = tokenOut === ethers.constants.AddressZero
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

export { executeIcebergWithdrawUsingProof, checkWithdrawableAmount };
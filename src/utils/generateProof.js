/**
 * Browser-compatible ZK proof generation function
 * Generate ZK proof for specified recipient address with given parameters
 */

import { ethers } from "ethers";
import { getErrorMessage, errorMessageIncludes } from "./errorUtils";
import { ZKProofGeneratorBrowser } from "./zkProofBrowser";
const { poseidon2, poseidon1 } = require("poseidon-lite");

/**
 * Generate ZK proof for withdrawal
 * @param {string} recipientAddress - The recipient address for withdrawal
 * @param {string} nullifier - The nullifier from deposit data
 * @param {string} secret - The secret from deposit data
 * @param {string} poolAddress - The Iceberg contract address
 * @param {string} circuitsRoot - Path to circuits directory (unused in browser)
 * @returns {Object} finalProof - The generated proof object
 */
async function generateProof(recipientAddress, nullifier, secret, poolAddress, circuitsRoot = null) {
  console.log("🔒 Generating real ZK proof in browser...");

  // Validate recipient address format
  if (!ethers.utils.isAddress(recipientAddress)) {
    throw new Error(`Invalid recipient address: ${recipientAddress}`);
  }

  console.log("Recipient address:", recipientAddress);
  console.log("Contract address:", poolAddress);

  try {
    // 1. Initialize browser-compatible ZK proof generator
    console.log("Initializing browser ZK proof generator...");
    const zkProof = new ZKProofGeneratorBrowser();
    
    // 2. Validate setup
    console.log("Validating circuit files accessibility...");
    await zkProof.validateSetup();
    
    // 3. Poseidon hash functions are ready (using poseidon-lite)
    console.log("Using poseidon-lite hash functions...");
    
    // 4. Prepare input data - handle UUID format like depositUtils.js
    let nullifierBigInt, secretBigInt;
    
    // For UUID format secret, use hash conversion (same as depositUtils.js)
    if (secret.match(/[^0-9]/)) {
      console.log('Using hash conversion for non-numeric secret/nullifier')
      const reversedSecret = secret.split('').reverse().join('')
      const secretHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(secret))
      const nullifierHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(reversedSecret))
      secretBigInt = BigInt(secretHash)
      nullifierBigInt = BigInt(nullifierHash)
      console.log('  Secret hash:', secretHash)
      console.log('  Nullifier hash:', nullifierHash)
    } else {
      // For pure numeric secret, direct conversion
      console.log('Using numeric conversion')
      nullifierBigInt = BigInt(nullifier)
      secretBigInt = BigInt(secret)
    }
    
    const recipient = BigInt(recipientAddress);
    
    console.log("Input parameters:");
    console.log("  Nullifier:", nullifierBigInt.toString());
    console.log("  Secret:", secretBigInt.toString());
    console.log("  Recipient:", recipient.toString());
    
    // 5. Calculate commitment and nullifier hash (exactly like depositUtils.js)
    const commitment = poseidon2([
      nullifierBigInt.toString(),
      secretBigInt.toString()
    ]);
    const nullifierHashCalc = poseidon1([nullifierBigInt.toString()]);
    
    const commitmentStr = commitment.toString();
    const nullifierHashStr = nullifierHashCalc.toString();
    
    console.log("Hash calculations:");
    console.log("  Calculated Commitment:", commitmentStr);
    console.log("  Calculated NullifierHash:", nullifierHashStr);
    
    // 6. Get real merkle data from contract (no more mock data!)
    console.log("🌲 Getting real merkle data from contract...");
    
    if (!poolAddress) {
      throw new Error("Pool address is required to get merkle data");
    }
    
    // Create ethers provider using the same RPC as index.js (not MetaMask default)
    let provider;
    try {
      // Use the same RPC endpoint as configured in index.js for Arbitrum
      const arbitrumRpcUrl = 'https://arb1.arbitrum.io/rpc';
      provider = new ethers.providers.JsonRpcProvider(arbitrumRpcUrl);
      console.log("🌐 Using configured RPC:", arbitrumRpcUrl);
    } catch (error) {
      console.log("❌ Failed to use configured RPC, falling back to MetaMask");
      try {
        if (window.ethereum) {
          provider = new ethers.providers.Web3Provider(window.ethereum);
          console.log("🌐 Using MetaMask RPC as fallback");
        } else {
          throw new Error("No Web3 provider available");
        }
      } catch (fallbackError) {
        throw new Error("Failed to create any provider: " + fallbackError.message);
      }
    }
    
    // Iceberg contract ABI for merkle operations (fixed to match MerkleTree.sol)
    const ICEBERG_ABI = [
      'function getMerkleRoot() external view returns (bytes32)',
      'function getMerkleProof(uint256 leafIndex) external view returns (bytes32[5] memory, bool[5] memory)',
      'function getMerkleDepth() external view returns (uint256)',
      'event Deposit(bytes32 indexed commitment, uint256 leafIndex, uint256 timestamp, uint256 swapConfigId)'
    ];
    
    const pool = new ethers.Contract(poolAddress, ICEBERG_ABI, provider);
    
    // Get current merkle root
    let merkleRoot;
    try {
      merkleRoot = await pool.getMerkleRoot();
      console.log("✅ Current Merkle Root:", merkleRoot);
    } catch (error) {
      throw new Error("Failed to get merkle root from contract: " + error.message);
    }
    
    // Find the leaf index for our commitment
    console.log("🔍 Finding leaf index for commitment:", commitmentStr);
    
    // Search for Deposit events to find our commitment's leaf index
    let leafIndex = null;
    try {
      const currentBlock = await provider.getBlockNumber();
      const startBlock = Math.max(0, currentBlock - 60000); // Search recent 100k blocks
      
      console.log(`🔍 Searching blocks ${startBlock} to ${currentBlock}...`);
      
      const filter = pool.filters.Deposit();
      const events = await pool.queryFilter(filter, startBlock);
      
      console.log(`📊 Found ${events.length} Deposit events`);
      
      for (const event of events) {
        const eventCommitment = ethers.BigNumber.from(event.args.commitment).toString();
        console.log("eventCommitment:", eventCommitment);
        if (eventCommitment === commitmentStr) {
          leafIndex = event.args.leafIndex.toNumber();
          console.log("✅ Found matching commitment at leafIndex:", leafIndex);
          break;
        }
      }
      
      if (leafIndex === null) {
        throw new Error(`No deposit event found for commitment ,${commitmentStr}. Make sure the deposit transaction was confirmed.`);
      }
    } catch (error) {
      throw new Error("Failed to find deposit event: " + error.message);
    }
    
    // Get merkle proof for the leaf index
    console.log("🌲 Getting merkle proof for leafIndex:", leafIndex);
    let pathElements, pathIndices;
    try {
      const merkleProof = await pool.getMerkleProof(leafIndex);
      pathElements = merkleProof[0].map(elem => ethers.BigNumber.from(elem).toString());
      pathIndices = merkleProof[1].map(idx => idx ? 1 : 0);
      
      console.log("✅ Successfully obtained merkle proof");
      console.log(`  PathElements count: ${pathElements.length}`);
      console.log(`  PathIndices count: ${pathIndices.length}`);
    } catch (error) {
      throw new Error("Failed to get merkle proof: " + error.message);
    }
    
    // Validate merkle tree depth
    if (pathElements.length !== 5 || pathIndices.length !== 5) {
      throw new Error(`Invalid merkle proof length. Expected 5 levels, got ${pathElements.length} elements and ${pathIndices.length} indices`);
    }
    
    const circuitInput = {
      // Public inputs
      merkleRoot: ethers.BigNumber.from(merkleRoot).toString(),
      nullifierHash: nullifierHashStr,
      recipient: recipient.toString(),
      // Private inputs
      nullifier: nullifierBigInt.toString(),
      secret: secretBigInt.toString(),
      pathElements: pathElements,
      pathIndices: pathIndices
    };
    
    console.log("📋 Circuit input validation:");
    console.log(`  MerkleRoot: ${ethers.BigNumber.from(merkleRoot).toString()}`);
    console.log(`  NullifierHash: ${nullifierHashStr}`);
    console.log(`  Recipient: ${recipient.toString()}`);
    console.log(`  Commitment: ${commitmentStr}`);
    console.log(`  PathElements count: ${pathElements.length} (should be 5)`);
    console.log(`  PathIndices count: ${pathIndices.length} (should be 5)`);
    console.log(`  LeafIndex: ${leafIndex}`);
    
    // 7. Generate ZK proof
    console.log("Generating ZK proof...");
    const result = await zkProof.generateProof(circuitInput);
    
    console.log("Proof generation successful!");
    console.log("Public signals:", result.publicSignals);
    
    // 8. Verify proof
    console.log("Verifying proof...");
    const isValid = await zkProof.verifyProof(result.proof, result.publicSignals);
    
    if (!isValid) {
      throw new Error("Proof verification failed!");
    }
    
    // 9. Format proof for contract
    console.log("Converting proof format...");
    const formattedProof = zkProof.formatProofForContract(result.proof);
    
    // Convert to array format [a0, a1, b00, b01, b10, b11, c0, c1]
    const contractProof = [
      formattedProof.a[0],
      formattedProof.a[1],
      formattedProof.b[0][0],
      formattedProof.b[0][1],
      formattedProof.b[1][0],
      formattedProof.b[1][1],
      formattedProof.c[0],
      formattedProof.c[1]
    ];
    
    // 10. Create final proof object
    const finalProof = {
      type: "browser-generated",
      timestamp: new Date().toISOString(),
      recipient: recipientAddress,
      proof: contractProof,
      publicSignals: result.publicSignals,
      snarkjsProof: result.proof,
      runDirectory: result.runDirectory,
      commitment: commitmentStr,
      nullifierHash: nullifierHashStr,
      leafIndex: leafIndex,
      merkleRootUsed: ethers.BigNumber.from(merkleRoot).toString(),
      realMerkleData: true
    };
    
    console.log("🎉 ZK proof generation completed!");
    console.log("✅ This proof uses real merkle data from the blockchain!");
    
    return finalProof;
    
  } catch (error) {
    console.error("❌ Proof generation failed:", getErrorMessage(error));
    throw error;
  }
}

export { generateProof };
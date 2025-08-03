/**
 * Browser-compatible ZK proof generation function
 * Generate ZK proof for specified recipient address with given parameters
 */

import { ethers } from "ethers";
import { buildPoseidon } from "circomlibjs";
import { getErrorMessage, errorMessageIncludes } from "./errorUtils";
import { ZKProofGeneratorBrowser } from "./zkProofBrowser";

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
    
    // 3. Build Poseidon hash function for verification
    console.log("Building Poseidon hash function...");
    const poseidon = await buildPoseidon();
    
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
    
    // 5. Calculate commitment and nullifier hash
    const commitment = poseidon([nullifierBigInt, secretBigInt]);
    const nullifierHashCalc = poseidon([nullifierBigInt]);
    
    const commitmentStr = poseidon.F.toString(commitment);
    const nullifierHashStr = poseidon.F.toString(nullifierHashCalc);
    
    console.log("Hash calculations:");
    console.log("  Calculated Commitment:", commitmentStr);
    console.log("  Calculated NullifierHash:", nullifierHashStr);
    
    // 6. For now, we'll create a test circuit input with mock merkle path
    // TODO: Get real merkle path from contract when provider is available
    console.log("⚠️ Using mock merkle path for testing - need real contract data");
    
    const mockMerkleRoot = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
    const mockPathElements = Array(5).fill("0");
    const mockPathIndices = Array(5).fill(0);
    
    const circuitInput = {
      // Public inputs
      merkleRoot: mockMerkleRoot,
      nullifierHash: nullifierHashStr,
      recipient: recipient.toString(),
      // Private inputs
      nullifier: nullifierBigInt.toString(),
      secret: secretBigInt.toString(),
      pathElements: mockPathElements,
      pathIndices: mockPathIndices
    };
    
    console.log("Circuit input prepared");
    
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
      warning: "Using mock merkle path - need real contract data for production"
    };
    
    console.log("🎉 ZK proof generation completed!");
    console.log("⚠️ Note: This proof uses mock merkle data for testing");
    
    return finalProof;
    
  } catch (error) {
    console.error("❌ Proof generation failed:", getErrorMessage(error));
    throw error;
  }
}

export { generateProof };
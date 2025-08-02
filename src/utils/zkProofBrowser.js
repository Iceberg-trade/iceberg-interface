/**
 * Browser-compatible ZK proof generation
 * Uses snarkjs browser APIs instead of Node.js file system operations
 */

import * as snarkjs from "snarkjs";

/**
 * Browser-compatible ZK proof generator
 */
export class ZKProofGeneratorBrowser {
    constructor() {
        this.baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '';
    }

    /**
     * Validate that all required files are accessible
     */
    async validateSetup() {
        const requiredFiles = [
            '/circuits/keys/withdraw/withdraw_0001.zkey',
            '/circuits/keys/withdraw/withdraw_verification_key.json',
            '/circuits/build/withdraw/withdraw_js/withdraw.wasm'
        ];

        for (const file of requiredFiles) {
            try {
                const response = await fetch(this.baseUrl + file);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${file}: ${response.status}`);
                }
            } catch (error) {
                throw new Error(`Required file not accessible: ${file}. ${error.message}`);
            }
        }
    }

    /**
     * Generate ZK proof using snarkjs browser APIs
     */
    async generateProof(circuitInput) {
        console.log('🔗 Generating ZK proof in browser...');
        
        try {
            // 1. Load WASM file
            console.log('📁 Loading WASM file...');
            const wasmResponse = await fetch(this.baseUrl + '/circuits/build/withdraw/withdraw_js/withdraw.wasm');
            const wasmBuffer = await wasmResponse.arrayBuffer();
            
            // 2. Load zkey file
            console.log('🔑 Loading proving key...');
            const zkeyResponse = await fetch(this.baseUrl + '/circuits/keys/withdraw/withdraw_0001.zkey');
            const zkeyBuffer = await zkeyResponse.arrayBuffer();
            
            // 3. Generate witness
            console.log('🔄 Step 1: Generating witness...');
            const { witness } = await snarkjs.wtns.calculate(circuitInput, wasmBuffer);
            
            // 4. Generate proof
            console.log('🔄 Step 2: Generating proof...');
            const { proof, publicSignals } = await snarkjs.groth16.prove(zkeyBuffer, witness);
            
            console.log('✅ Proof generated successfully!');
            
            return {
                proof,
                publicSignals,
                runDirectory: 'browser-generated'
            };

        } catch (error) {
            console.error('❌ Error generating proof:', error);
            throw error;
        }
    }

    /**
     * Verify ZK proof using snarkjs browser APIs
     */
    async verifyProof(proof, publicSignals) {
        console.log('🔍 Verifying proof...');
        
        try {
            // Load verification key
            const vkResponse = await fetch(this.baseUrl + '/circuits/keys/withdraw/withdraw_verification_key.json');
            const verificationKey = await vkResponse.json();
            
            // Verify proof
            const isValid = await snarkjs.groth16.verify(verificationKey, publicSignals, proof);
            
            if (isValid) {
                console.log('✅ Proof verification successful!');
            } else {
                console.log('❌ Proof verification failed!');
            }
            
            return isValid;

        } catch (error) {
            console.error('❌ Proof verification failed:', error);
            return false;
        }
    }

    /**
     * Format proof for smart contract call
     */
    formatProofForContract(proof) {
        return {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
            c: [proof.pi_c[0], proof.pi_c[1]]
        };
    }

    /**
     * Get circuit information
     */
    getCircuitInfo() {
        return {
            circuitSize: 4207,
            powersOfTau: 'pot13_final.ptau',
            supportedConstraints: 8192,
            circuitsRoot: 'browser'
        };
    }
}
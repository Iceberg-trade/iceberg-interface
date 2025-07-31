require('dotenv').config();
require("@nomiclabs/hardhat-ethers");

const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!DEPLOYER_PRIVATE_KEY) {
  throw new Error("Please set DEPLOYER_PRIVATE_KEY in .env file");
}

module.exports = {
  networks: {
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 42161,
      gasPrice: 100000000 // 0.1 gwei
    },
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || "https://mainnet.infura.io/v3/your_key",
      accounts: [DEPLOYER_PRIVATE_KEY], 
      chainId: 1,
      gasPrice: 20000000000 // 20 gwei
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: [DEPLOYER_PRIVATE_KEY]
    }
  },
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
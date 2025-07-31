import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import {configureChains, WagmiConfig, createClient} from "wagmi";
import {mainnet, arbitrum} from "wagmi/chains";
import {publicProvider} from "wagmi/providers/public"
import {jsonRpcProvider} from "wagmi/providers/jsonRpc"
import {MetaMaskConnector} from "@wagmi/connectors/metaMask"
import {InjectedConnector} from "@wagmi/connectors/injected"

const {chains, provider, webSocketProvider} = configureChains(
  [arbitrum, mainnet],
  [
    jsonRpcProvider({
      rpc: (chain) => {
        if (chain.id === 42161) {
          return {
            http: 'https://arb1.arbitrum.io/rpc',
            webSocket: 'wss://arb1.arbitrum.io/ws'
          }
        }
        if (chain.id === 1) {
          return {
            http: 'https://ethereum.publicnode.com',
            webSocket: 'wss://ethereum.publicnode.com'
          }
        }
        return null
      },
    }),
    publicProvider()
  ]
)

const client = createClient({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({
      chains,
      options: {
        shimDisconnect: true,
        UNSTABLE_shimOnConnectSelectAccount: true, // 启用账户选择
      },
    }),
    new InjectedConnector({
      chains,
      options: {
        name: 'Browser Wallet',
        shimDisconnect: true,
      },
    }),
  ],
  provider,
  webSocketProvider,
})

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <WagmiConfig client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </WagmiConfig>
  </React.StrictMode>
);

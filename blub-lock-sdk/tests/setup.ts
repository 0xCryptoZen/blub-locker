import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import { fromB64 } from "@mysten/sui/utils"
import dotenv from "dotenv"
import { BlubLockSDK } from "../src/index"

dotenv.config()

export function buildTestAccount(): Ed25519Keypair {
  const mnemonics = process.env.SUI_WALLET_MNEMONICS || ""
  const testAccountObject = Ed25519Keypair.deriveKeypair(mnemonics)
  return testAccountObject
}

export function setupTestSDK(): {
  blubLockSDK: BlubLockSDK
  keypair: Ed25519Keypair
} {
  const fullNodeURL = process.env.SUI_RPC!

  const blubLockSDK = new BlubLockSDK({
    packageId: "0x212d0989e7cb6b1d9a338d1c88d5698062c2fed22e73bd48b992e75647ef8705",
    registryId: "0x356b5b94086111c9a5616f9b83a78b0b84a6913142dff5fe9c25b991ab6152d0",
    fullNodeUrl: fullNodeURL,
    networkType: "testnet",
  })

  const secret = process.env.SUI_WALLET_SECRET!

  let keypair: Ed25519Keypair
  if (secret) {
    keypair = Ed25519Keypair.fromSecretKey(fromB64(secret).slice(1, 33))
  } else {
    keypair = buildTestAccount()
  }

  return { blubLockSDK, keypair }
}

export const TESTCOIN = "0xd6afb9d33e02056d28d1514e231b077bf26777323acdd69076189aaba64f3e53::usdc::USDC"

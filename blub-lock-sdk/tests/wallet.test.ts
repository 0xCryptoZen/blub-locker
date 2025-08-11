import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import dotenv from "dotenv"
import { BlubLockSDK } from "~/sdk"
import { setupTestSDK } from "./setup"


describe("router module", () => {
  let blubLockSDK: BlubLockSDK;
  let keypair: Ed25519Keypair;

  beforeEach(() => {
    const res = setupTestSDK()
    blubLockSDK = res.blubLockSDK
    keypair = res.keypair
  });

  test("Parse public key", () => {
    console.log('wallet address:', keypair.getPublicKey().toSuiAddress())
  })
})

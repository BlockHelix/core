import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReceiptRegistry } from "../target/types/receipt_registry";
import { expect } from "chai";

describe("receipt-registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ReceiptRegistry as Program<ReceiptRegistry>;

  it("Initializes registry", async () => {
    console.log("Registry program ID:", program.programId.toString());
  });

  it("Records job", async () => {
    console.log("Record job test placeholder");
  });

  it("Challenges job", async () => {
    console.log("Challenge job test placeholder");
  });

  it("Resolves job", async () => {
    console.log("Resolve job test placeholder");
  });
});

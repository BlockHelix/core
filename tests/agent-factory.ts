import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgentFactory } from "../target/types/agent_factory";
import { expect } from "chai";

describe("agent-factory", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AgentFactory as Program<AgentFactory>;

  it("Initializes factory", async () => {
    console.log("Factory program ID:", program.programId.toString());
  });

  it("Creates agent", async () => {
    console.log("Create agent test placeholder");
  });
});

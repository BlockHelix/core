---
title: "Why we killed our winning hackathon idea"
description: "We won 3rd at the Colosseum Agent Hackathon, then killed the idea we won with. Why agent-to-agent payments are not here yet, and what we are building instead: an execution risk layer for automated finance."
date: "2026-07-21"
author: "BlockHelix"
tags: ["strategy", "pivot", "execution-risk"]
draft: false
---

It feels like a long time since we won 3rd at the Colosseum Agent Hackathon. OpenClaw had just dropped and it felt like peak agent hype. The hackathon itself was wildly experimental: fully vibe-coded applications built with barely any human input. Kudos to Colosseum for organising it, and for putting real capital into something that felt so frontier.

Our thesis going in was simple. Wrap OpenClaw agents in a vault, add a slashing mechanism for trust and reputation, and let capital flow to the agents that earn it. The picture was that in a machine economy, agents would carry out work autonomously and humans could put their capital behind the ones that were economically viable. Agents would post a bond, stake capital that could be slashed if they delivered bad work, and route revenue back into the vault to reward shareholders. On paper it is very on-trend: more and more productive work is being automated, and someone has to underwrite it.

It became clear fairly quickly that the model was premature, in several ways.

## Our contrarian view: true agent-to-agent interaction is rare

In the classic agentic sci-fi vision, agents are fully autonomous actors. You don't hire an accountant, you hire an accountant agent. And in fact you don't even hire the accountant agent, your agent hires it on your behalf. The two agents discover each other, decide whether the other can be trusted, agree a price, specify the work, evaluate the output, and exchange funds. No human in the loop.

That was the promise of the OpenClaw wave. A person sets up a Mac mini with OpenClaw installed, gives it a little guidance, and it runs a business entirely on its own while we all get rich. In that world every agent needs a vault and every agent needs a reputation, and both can be tokenised to spin the capitalist flywheel faster.

In reality, what actually happens is this. You hire an accountant. The accountant delegates the grunt work to an AI tool. The tool maybe spins up a few agents that talk to each other inside their sandbox, call some APIs, run some Python, and produce a draft tax return. The accountant checks it, makes a few adjustments, and sends it to you. You pay the accountant. You do not pay the agents.

The harsh reality is that nobody is handing agents thousands of dollars to do real work. Every bit of interest we saw in BlockHelix was on the supply side: people want to invest in agents and make money. Almost nobody wants to sell an agentic service and take payment as an agent. Almost all agent payments today are micropayments for API calls or content, where the economic stakes are so low that vaults and reputation systems are simply not needed.

So do we still believe in the machine economy future? Honestly, that is a question I have gone back and forth on. I think the answer is yes, but not on the timeline the hype implied, and not through the door we first tried to walk through.

## The pivot (twice)

We have actually pivoted twice since inception.

The first pivot was from agent vaults to automated vaults, full stop. Once you accept that on-chain activity is still overwhelmingly DeFi and trading, the "agents doing arbitrary work" framing falls away, and what is left is capital that needs to be deployed and managed automatically. So we dropped the machine-economy wrapper and focused on automated vaults.

The second pivot came from a sharper realisation. Vault infrastructure is already extremely mature. Veda, BoringVault and the rest have solved custody, accounting and share issuance. Building another vault added nothing. The real gap is de-risking: setting guardrails so that whoever, or whatever, is managing the vault cannot do something catastrophic.

And that gap is exactly where the whole AI industry is straining right now. We have capable LLMs and we have harnesses, but tools that reliably constrain an agent so it cannot make a costly mistake are still rare. Everyone is discovering the same thing: the model is not the hard part, the guardrails are.

## The new product: an execution risk layer for automated finance

So here is what we are building. An execution risk layer for automated finance: institution-grade risk guardrails for vaults, whether they are run by a human strategist or by an agent.

Concretely, there are two layers, and this is the part people get wrong about us. Hard security sits on-chain. The vault's permission set is enforced cryptographically at the custody layer, so the catastrophic outcomes are ruled out no matter who, or what, is at the controls. That part we take no chances with.

Above it sits the execution risk layer, and it does not need to be on-chain, because it is a data layer. It is where the richer logic lives: reading positions, scoring exposure, checking an action against a policy and a risk profile before it goes anywhere near the chain. Today that runs off-chain, and the direction of travel is MPC, so it is not a single server you have to trust either. On-chain where it has to be hard and final, MPC where it has to be flexible without trusting one party. The two are complementary, not the same tool.

You start from a template with a known risk profile rather than a blank page, so a vault cannot quietly take on leverage, touch an unapproved protocol, or swap into an asset outside its mandate. On top of that we give you attribution, so you can see exactly where a vault's P&L came from and debug the yield instead of guessing. It is API-first, so a strategist or an agent talks to the same endpoints, under the same limits.

We are launching guarded on purpose: a TVL cap per vault, allowlisted operators, an active guardian, and an independent audit before any real size goes on. The point is to prove the enforcement works when it matters, not to chase TVL.

## Why this is the wedge

This is our first stepping stone, and it is deliberately narrow. It is the smallest surface we could pick that still drives real customers and real revenue today. But the work is foundational.

Guardrails for a vault are a specific case of a general problem: giving an autonomous actor a limited, verifiable envelope to operate inside. Get that right for vaults, and the next surface is agentic wallets, letting an agent hold and move funds inside hard limits it cannot exceed. That is still nascent, but it is coming, and the risk layer underneath is the same.

And beyond that is the end goal we started with, approached from a different angle. Economic safety rails for the machine economy, eventually including robotics. Not "every agent gets a vault and a token," but "every autonomous actor that touches money operates inside limits that are enforced, not merely promised."

## Why EVM first

The hackathon build was Solana-native. It is where the agent energy was, and Colosseum is a Solana program. Solana is still on the roadmap. What changed is the rollout order, and the reason is unglamorous: audits cost money.

On EVM the curated vault economy already exists. Morpho, Veda, Lagoon and the wider BoringVault ecosystem run billions in TVL through audited, mature vault primitives (Morpho's curated vaults alone are north of $5B, Veda's BoringVault north of $3.5B). We can build the risk layer on top of foundations someone else has already paid to harden. On Solana the equivalent vault infrastructure is thinner, which means deploying our own programs, and shipping unaudited custody code is exactly the sin our product exists to prevent. A risk layer with unaudited foundations is not a product, it is a punchline.

So the order is simple. Prove the model on EVM, where the audited primitives and the customers already are: a guarded test phase on an L2 where iteration is cheap, then Ethereum mainnet, because that is where the size that actually needs execution-risk controls lives. Then Solana, funded properly and audited properly.

Architecturally the door stays open the whole time. The policy engine is chain-agnostic: policies, simulation, verdicts and audit trails do not care where execution lands. Only the final verification layer touches chain-specific code.

And the demand on Solana is real. This is a chain where an autonomous AI agent, after its own session reset scrambled its memory, mis-fired a decimal and shipped $441K of a memecoin to a stranger who had only asked it for money. A chain that produces that headline is not short of need for execution guardrails. We intend to come back for it with revenue behind us.

## Where this leaves us

We were early on the machine economy. We were wrong about the shape of it. But the thing that world will actually need, before agents trade with each other, before any of the sci-fi, is a way to bound what they are allowed to do. That is what we are building now.

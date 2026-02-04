use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j");

#[program]
pub mod agent_factory {
    use super::*;

    pub fn initialize_factory(
        ctx: Context<InitializeFactory>,
        min_protocol_fee_bps: u16,
    ) -> Result<()> {
        let factory_state = &mut ctx.accounts.factory_state;
        factory_state.authority = ctx.accounts.authority.key();
        factory_state.protocol_treasury = ctx.accounts.protocol_treasury.key();
        factory_state.min_protocol_fee_bps = min_protocol_fee_bps;
        factory_state.agent_count = 0;
        factory_state.bump = ctx.bumps.factory_state;
        Ok(())
    }

    pub fn create_agent(
        ctx: Context<CreateAgent>,
        name: String,
        github_handle: String,
        endpoint_url: String,
        agent_fee_bps: u16,
        protocol_fee_bps: u16,
        challenge_window: i64,
    ) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + FactoryState::INIT_SPACE,
        seeds = [b"factory"],
        bump
    )]
    pub factory_state: Account<'info, FactoryState>,

    #[account(mut)]
    pub authority: Signer<'info>,

    /// CHECK: Protocol treasury address
    pub protocol_treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateAgent<'info> {
    #[account(mut)]
    pub factory_state: Account<'info, FactoryState>,

    #[account(
        init,
        payer = agent_wallet,
        space = 8 + AgentMetadata::INIT_SPACE,
        seeds = [b"agent", factory_state.key().as_ref(), &factory_state.agent_count.to_le_bytes()],
        bump
    )]
    pub agent_metadata: Account<'info, AgentMetadata>,

    #[account(mut)]
    pub agent_wallet: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: Protocol treasury
    pub protocol_treasury: AccountInfo<'info>,

    /// CHECK: Vault program
    pub vault_program: AccountInfo<'info>,

    /// CHECK: Registry program
    pub registry_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct FactoryState {
    pub authority: Pubkey,
    pub protocol_treasury: Pubkey,
    pub min_protocol_fee_bps: u16,
    pub agent_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AgentMetadata {
    pub factory: Pubkey,
    pub agent_wallet: Pubkey,
    pub vault: Pubkey,
    pub registry: Pubkey,
    pub share_mint: Pubkey,
    #[max_len(64)]
    pub name: String,
    #[max_len(64)]
    pub github_handle: String,
    #[max_len(256)]
    pub endpoint_url: String,
    pub agent_id: u64,
    pub created_at: i64,
    pub bump: u8,
}

#[error_code]
pub enum FactoryError {
    #[msg("Name too long")]
    NameTooLong,
    #[msg("GitHub handle too long")]
    GitHubHandleTooLong,
    #[msg("Endpoint URL too long")]
    EndpointUrlTooLong,
    #[msg("Protocol fee below minimum")]
    ProtocolFeeBelowMinimum,
    #[msg("Total fees exceed 100%")]
    TotalFeesExceed100Percent,
}

use anchor_lang::prelude::*;

declare_id!("jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9");

#[program]
pub mod receipt_registry {
    use super::*;

    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        challenge_window: i64,
    ) -> Result<()> {
        let registry_state = &mut ctx.accounts.registry_state;
        registry_state.vault = ctx.accounts.vault.key();
        registry_state.agent_wallet = ctx.accounts.agent_wallet.key();
        registry_state.job_counter = 0;
        registry_state.challenge_window = challenge_window;
        registry_state.bump = ctx.bumps.registry_state;
        Ok(())
    }

    pub fn record_job(
        ctx: Context<RecordJob>,
        artifact_hash: [u8; 32],
        payment_amount: u64,
        payment_tx: [u8; 64],
    ) -> Result<()> {
        Ok(())
    }

    pub fn challenge_job(ctx: Context<ChallengeJob>) -> Result<()> {
        Ok(())
    }

    pub fn resolve_job(ctx: Context<ResolveJob>, accepted: bool) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeRegistry<'info> {
    #[account(
        init,
        payer = agent_wallet,
        space = 8 + RegistryState::INIT_SPACE,
        seeds = [b"registry", vault.key().as_ref()],
        bump
    )]
    pub registry_state: Account<'info, RegistryState>,

    /// CHECK: Vault account reference
    pub vault: AccountInfo<'info>,

    #[account(mut)]
    pub agent_wallet: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordJob<'info> {
    #[account(mut)]
    pub registry_state: Account<'info, RegistryState>,

    #[account(
        init,
        payer = agent_wallet,
        space = 8 + JobReceipt::INIT_SPACE,
        seeds = [b"job", registry_state.key().as_ref(), &registry_state.job_counter.to_le_bytes()],
        bump
    )]
    pub job_receipt: Account<'info, JobReceipt>,

    #[account(
        mut,
        constraint = agent_wallet.key() == registry_state.agent_wallet
    )]
    pub agent_wallet: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ChallengeJob<'info> {
    #[account(mut)]
    pub job_receipt: Account<'info, JobReceipt>,

    pub challenger: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveJob<'info> {
    #[account(mut)]
    pub job_receipt: Account<'info, JobReceipt>,

    pub authority: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct RegistryState {
    pub vault: Pubkey,
    pub agent_wallet: Pubkey,
    pub job_counter: u64,
    pub challenge_window: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct JobReceipt {
    pub registry: Pubkey,
    pub job_id: u64,
    pub artifact_hash: [u8; 32],
    pub payment_amount: u64,
    pub payment_tx: [u8; 64],
    pub status: JobStatus,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum JobStatus {
    Active,
    Challenged,
    Resolved,
    Rejected,
}

#[error_code]
pub enum RegistryError {
    #[msg("Challenge window expired")]
    ChallengeWindowExpired,
    #[msg("Job already challenged")]
    JobAlreadyChallenged,
    #[msg("Unauthorized")]
    Unauthorized,
}

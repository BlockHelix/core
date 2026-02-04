use anchor_lang::prelude::*;

declare_id!("jks1tXZFTTnoBdVuFzvF5XA8i4S39RKcCRpL9puiuz9");

#[program]
pub mod receipt_registry {
    use super::*;

    pub fn initialize_registry(
        ctx: Context<InitializeRegistry>,
        challenge_window: i64,
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry_state;
        registry.vault = ctx.accounts.vault.key();
        registry.agent_wallet = ctx.accounts.agent_wallet.key();
        registry.protocol_authority = ctx.accounts.protocol_authority.key();
        registry.job_counter = 0;
        registry.challenge_window = challenge_window;
        registry.total_challenged = 0;
        registry.total_resolved_against = 0;
        registry.bump = ctx.bumps.registry_state;

        emit!(RegistryInitialized {
            vault: registry.vault,
            agent_wallet: registry.agent_wallet,
            protocol_authority: registry.protocol_authority,
            challenge_window,
        });

        Ok(())
    }

    pub fn record_job(
        ctx: Context<RecordJob>,
        artifact_hash: [u8; 32],
        payment_amount: u64,
        payment_tx: [u8; 64],
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry_state;
        let receipt = &mut ctx.accounts.job_receipt;
        let clock = Clock::get()?;

        receipt.registry = registry.key();
        receipt.job_id = registry.job_counter;
        receipt.client = ctx.accounts.client.key();
        receipt.artifact_hash = artifact_hash;
        receipt.payment_amount = payment_amount;
        receipt.payment_tx = payment_tx;
        receipt.status = JobStatus::Active;
        receipt.created_at = clock.unix_timestamp;
        receipt.challenged_at = 0;
        receipt.resolved_at = 0;
        receipt.challenger = Pubkey::default();
        receipt.client_verified = false;
        receipt.bump = ctx.bumps.job_receipt;

        registry.job_counter = registry.job_counter
            .checked_add(1)
            .ok_or(RegistryError::ArithmeticOverflow)?;

        emit!(JobRecorded {
            registry: receipt.registry,
            job_id: receipt.job_id,
            client: receipt.client,
            payment_amount,
            created_at: receipt.created_at,
        });

        Ok(())
    }

    pub fn challenge_job(
        ctx: Context<ChallengeJob>,
        _reason_hash: [u8; 32],
    ) -> Result<()> {
        let registry = &mut ctx.accounts.registry_state;
        let receipt = &mut ctx.accounts.job_receipt;
        let clock = Clock::get()?;

        let window_end = receipt.created_at
            .checked_add(registry.challenge_window)
            .ok_or(RegistryError::ArithmeticOverflow)?;
        require!(
            clock.unix_timestamp <= window_end,
            RegistryError::ChallengeWindowExpired
        );

        receipt.status = JobStatus::Challenged;
        receipt.challenged_at = clock.unix_timestamp;
        receipt.challenger = ctx.accounts.challenger.key();

        registry.total_challenged = registry.total_challenged
            .checked_add(1)
            .ok_or(RegistryError::ArithmeticOverflow)?;

        emit!(JobChallenged {
            registry: receipt.registry,
            job_id: receipt.job_id,
            challenger: receipt.challenger,
            challenged_at: receipt.challenged_at,
        });

        Ok(())
    }

    pub fn resolve_for_agent(ctx: Context<ResolveChallenge>, _job_id: u64) -> Result<()> {
        let receipt = &mut ctx.accounts.job_receipt;
        let clock = Clock::get()?;

        receipt.status = JobStatus::Resolved;
        receipt.resolved_at = clock.unix_timestamp;

        emit!(JobResolved {
            registry: receipt.registry,
            job_id: receipt.job_id,
            status: JobStatus::Resolved,
            resolved_at: receipt.resolved_at,
        });

        Ok(())
    }

    pub fn resolve_against_agent(ctx: Context<ResolveChallenge>, _job_id: u64) -> Result<()> {
        let registry = &mut ctx.accounts.registry_state;
        let receipt = &mut ctx.accounts.job_receipt;
        let clock = Clock::get()?;

        receipt.status = JobStatus::Rejected;
        receipt.resolved_at = clock.unix_timestamp;

        registry.total_resolved_against = registry.total_resolved_against
            .checked_add(1)
            .ok_or(RegistryError::ArithmeticOverflow)?;

        emit!(JobResolved {
            registry: receipt.registry,
            job_id: receipt.job_id,
            status: JobStatus::Rejected,
            resolved_at: receipt.resolved_at,
        });

        Ok(())
    }

    pub fn finalize_job(ctx: Context<FinalizeJob>, _job_id: u64) -> Result<()> {
        let registry = &ctx.accounts.registry_state;
        let receipt = &mut ctx.accounts.job_receipt;
        let clock = Clock::get()?;

        let window_end = receipt.created_at
            .checked_add(registry.challenge_window)
            .ok_or(RegistryError::ArithmeticOverflow)?;
        require!(
            clock.unix_timestamp > window_end,
            RegistryError::ChallengeWindowActive
        );

        receipt.status = JobStatus::Finalized;

        emit!(JobFinalized {
            registry: receipt.registry,
            job_id: receipt.job_id,
            finalized_at: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn verify_receipt(ctx: Context<VerifyReceipt>, _job_id: u64) -> Result<()> {
        let receipt = &mut ctx.accounts.job_receipt;
        receipt.client_verified = true;

        emit!(ReceiptVerified {
            registry: receipt.registry,
            job_id: receipt.job_id,
            client: ctx.accounts.client.key(),
            verified_at: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }
}

// ── Account Contexts ──

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

    /// CHECK: Protocol authority for dispute resolution
    pub protocol_authority: AccountInfo<'info>,

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
        constraint = agent_wallet.key() == registry_state.agent_wallet @ RegistryError::Unauthorized
    )]
    pub agent_wallet: Signer<'info>,

    /// CHECK: Client who paid for this job
    pub client: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ChallengeJob<'info> {
    #[account(mut)]
    pub registry_state: Account<'info, RegistryState>,

    #[account(
        mut,
        constraint = job_receipt.client == challenger.key() @ RegistryError::Unauthorized,
        constraint = job_receipt.status == JobStatus::Active @ RegistryError::JobNotActive,
    )]
    pub job_receipt: Account<'info, JobReceipt>,

    pub challenger: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveChallenge<'info> {
    #[account(
        mut,
        constraint = registry_state.protocol_authority == authority.key() @ RegistryError::Unauthorized,
    )]
    pub registry_state: Account<'info, RegistryState>,

    #[account(
        mut,
        constraint = job_receipt.status == JobStatus::Challenged @ RegistryError::JobNotChallenged,
    )]
    pub job_receipt: Account<'info, JobReceipt>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct FinalizeJob<'info> {
    pub registry_state: Account<'info, RegistryState>,

    #[account(
        mut,
        constraint = job_receipt.status == JobStatus::Active @ RegistryError::JobNotActive,
    )]
    pub job_receipt: Account<'info, JobReceipt>,
}

#[derive(Accounts)]
pub struct VerifyReceipt<'info> {
    #[account(
        mut,
        constraint = job_receipt.client == client.key() @ RegistryError::Unauthorized,
        constraint = !job_receipt.client_verified @ RegistryError::AlreadyVerified,
    )]
    pub job_receipt: Account<'info, JobReceipt>,

    pub client: Signer<'info>,
}

// ── State ──

#[account]
#[derive(InitSpace)]
pub struct RegistryState {
    pub vault: Pubkey,
    pub agent_wallet: Pubkey,
    pub protocol_authority: Pubkey,
    pub job_counter: u64,
    pub challenge_window: i64,
    pub total_challenged: u64,
    pub total_resolved_against: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct JobReceipt {
    pub registry: Pubkey,
    pub job_id: u64,
    pub client: Pubkey,
    pub artifact_hash: [u8; 32],
    pub payment_amount: u64,
    pub payment_tx: [u8; 64],
    pub status: JobStatus,
    pub created_at: i64,
    pub challenged_at: i64,
    pub resolved_at: i64,
    pub challenger: Pubkey,
    pub client_verified: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum JobStatus {
    Active,
    Finalized,
    Challenged,
    Resolved,
    Rejected,
}

// ── Events ──

#[event]
pub struct RegistryInitialized {
    pub vault: Pubkey,
    pub agent_wallet: Pubkey,
    pub protocol_authority: Pubkey,
    pub challenge_window: i64,
}

#[event]
pub struct JobRecorded {
    pub registry: Pubkey,
    pub job_id: u64,
    pub client: Pubkey,
    pub payment_amount: u64,
    pub created_at: i64,
}

#[event]
pub struct JobChallenged {
    pub registry: Pubkey,
    pub job_id: u64,
    pub challenger: Pubkey,
    pub challenged_at: i64,
}

#[event]
pub struct JobResolved {
    pub registry: Pubkey,
    pub job_id: u64,
    pub status: JobStatus,
    pub resolved_at: i64,
}

#[event]
pub struct JobFinalized {
    pub registry: Pubkey,
    pub job_id: u64,
    pub finalized_at: i64,
}

#[event]
pub struct ReceiptVerified {
    pub registry: Pubkey,
    pub job_id: u64,
    pub client: Pubkey,
    pub verified_at: i64,
}

// ── Errors ──

#[error_code]
pub enum RegistryError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Challenge window expired")]
    ChallengeWindowExpired,
    #[msg("Challenge window still active")]
    ChallengeWindowActive,
    #[msg("Job is not active")]
    JobNotActive,
    #[msg("Job is not challenged")]
    JobNotChallenged,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Receipt already verified")]
    AlreadyVerified,
}

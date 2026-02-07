use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use anchor_spl::associated_token::AssociatedToken;
use agent_vault::cpi::accounts::Initialize as VaultInitialize;
use agent_vault::program::AgentVault;
use receipt_registry::cpi::accounts::InitializeRegistry as RegistryInit;
use receipt_registry::cpi::accounts::SetJobSigner as RegistrySetJobSigner;
use receipt_registry::program::ReceiptRegistry;

declare_id!("7Hp1sUZfUVfhvXJjtKZbyUuEVQpk92siyFLrgmwmAq7j");

#[program]
pub mod agent_factory {
    use super::*;

    pub fn initialize_factory(
        ctx: Context<InitializeFactory>,
        min_protocol_fee_bps: u16,
    ) -> Result<()> {
        let factory = &mut ctx.accounts.factory_state;
        factory.authority = ctx.accounts.authority.key();
        factory.protocol_treasury = ctx.accounts.protocol_treasury.key();
        factory.min_protocol_fee_bps = min_protocol_fee_bps;
        factory.agent_count = 0;
        factory.bump = ctx.bumps.factory_state;

        emit!(FactoryInitialized {
            authority: factory.authority,
            protocol_treasury: factory.protocol_treasury,
            min_protocol_fee_bps,
        });

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
        max_tvl: u64,
        lockup_epochs: u8,
        epoch_length: i64,
        arbitrator: Pubkey,
        job_signer: Option<Pubkey>,
    ) -> Result<()> {
        require!(name.len() <= 64, FactoryError::NameTooLong);
        require!(github_handle.len() <= 64, FactoryError::GitHubHandleTooLong);
        require!(endpoint_url.len() <= 256, FactoryError::EndpointUrlTooLong);

        let factory = &ctx.accounts.factory_state;
        require!(
            protocol_fee_bps >= factory.min_protocol_fee_bps,
            FactoryError::ProtocolFeeBelowMinimum
        );
        let total_bps = agent_fee_bps as u64 + protocol_fee_bps as u64;
        require!(total_bps <= 10_000, FactoryError::TotalFeesExceed100Percent);

        // CPI: AgentVault::initialize
        let vault_cpi_accounts = VaultInitialize {
            vault_state: ctx.accounts.vault_state.to_account_info(),
            share_mint: ctx.accounts.share_mint.to_account_info(),
            operator: ctx.accounts.operator.to_account_info(),
            usdc_mint: ctx.accounts.usdc_mint.to_account_info(),
            vault_usdc_account: ctx.accounts.vault_usdc_account.to_account_info(),
            protocol_treasury: ctx.accounts.protocol_treasury.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            associated_token_program: ctx.accounts.associated_token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let vault_cpi_ctx = CpiContext::new(
            ctx.accounts.vault_program.to_account_info(),
            vault_cpi_accounts,
        );
        let nonce = ctx.accounts.factory_state.agent_count;
        agent_vault::cpi::initialize(
            vault_cpi_ctx,
            agent_fee_bps,
            protocol_fee_bps,
            max_tvl,
            lockup_epochs,
            epoch_length,
            arbitrator,
            nonce,
        )?;

        // CPI: ReceiptRegistry::initialize_registry
        let registry_cpi_accounts = RegistryInit {
            registry_state: ctx.accounts.registry_state.to_account_info(),
            vault: ctx.accounts.vault_state.to_account_info(),
            protocol_authority: ctx.accounts.protocol_treasury.to_account_info(),
            operator: ctx.accounts.operator.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
        };
        let registry_cpi_ctx = CpiContext::new(
            ctx.accounts.registry_program.to_account_info(),
            registry_cpi_accounts,
        );
        receipt_registry::cpi::initialize_registry(registry_cpi_ctx, challenge_window)?;

        // CPI: ReceiptRegistry::set_job_signer (optional)
        if let Some(signer) = job_signer {
            let set_signer_accounts = RegistrySetJobSigner {
                registry_state: ctx.accounts.registry_state.to_account_info(),
                operator: ctx.accounts.operator.to_account_info(),
            };
            let set_signer_ctx = CpiContext::new(
                ctx.accounts.registry_program.to_account_info(),
                set_signer_accounts,
            );
            receipt_registry::cpi::set_job_signer(set_signer_ctx, signer)?;
        }

        let clock = Clock::get()?;
        let agent_id = ctx.accounts.factory_state.agent_count;

        let metadata = &mut ctx.accounts.agent_metadata;
        metadata.factory = ctx.accounts.factory_state.key();
        metadata.operator = ctx.accounts.operator.key();
        metadata.vault = ctx.accounts.vault_state.key();
        metadata.registry = ctx.accounts.registry_state.key();
        metadata.share_mint = ctx.accounts.share_mint.key();
        metadata.name = name.clone();
        metadata.github_handle = github_handle.clone();
        metadata.endpoint_url = endpoint_url.clone();
        metadata.agent_id = agent_id;
        metadata.created_at = clock.unix_timestamp;
        metadata.is_active = true;
        metadata.bump = ctx.bumps.agent_metadata;

        let factory = &mut ctx.accounts.factory_state;
        factory.agent_count = factory
            .agent_count
            .checked_add(1)
            .ok_or(FactoryError::ArithmeticOverflow)?;

        emit!(AgentCreated {
            factory: metadata.factory,
            agent_id,
            operator: metadata.operator,
            vault: metadata.vault,
            registry: metadata.registry,
            name,
            endpoint_url,
        });

        Ok(())
    }

    pub fn update_agent(
        ctx: Context<UpdateAgent>,
        name: Option<String>,
        github_handle: Option<String>,
        endpoint_url: Option<String>,
    ) -> Result<()> {
        let metadata = &mut ctx.accounts.agent_metadata;

        if let Some(n) = name {
            require!(n.len() <= 64, FactoryError::NameTooLong);
            metadata.name = n;
        }
        if let Some(gh) = github_handle {
            require!(gh.len() <= 64, FactoryError::GitHubHandleTooLong);
            metadata.github_handle = gh;
        }
        if let Some(url) = endpoint_url {
            require!(url.len() <= 256, FactoryError::EndpointUrlTooLong);
            metadata.endpoint_url = url;
        }

        emit!(AgentUpdated {
            agent_id: metadata.agent_id,
            operator: metadata.operator,
            name: metadata.name.clone(),
            endpoint_url: metadata.endpoint_url.clone(),
        });

        Ok(())
    }

    pub fn deactivate_agent(ctx: Context<DeactivateAgent>) -> Result<()> {
        let metadata = &mut ctx.accounts.agent_metadata;
        require!(metadata.is_active, FactoryError::AgentAlreadyInactive);
        metadata.is_active = false;

        emit!(AgentDeactivated {
            agent_id: metadata.agent_id,
            operator: metadata.operator,
        });

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
    #[account(
        mut,
        seeds = [b"factory"],
        bump = factory_state.bump,
    )]
    pub factory_state: Account<'info, FactoryState>,

    #[account(
        init,
        payer = operator,
        space = 8 + AgentMetadata::INIT_SPACE,
        seeds = [b"agent", factory_state.key().as_ref(), &factory_state.agent_count.to_le_bytes()],
        bump
    )]
    pub agent_metadata: Account<'info, AgentMetadata>,

    #[account(mut)]
    pub operator: Signer<'info>,

    // -- Vault CPI accounts --
    /// CHECK: Created by AgentVault CPI
    #[account(mut)]
    pub vault_state: AccountInfo<'info>,

    /// CHECK: Created by AgentVault CPI
    #[account(mut)]
    pub share_mint: AccountInfo<'info>,

    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: Created by AgentVault CPI (ATA)
    #[account(mut)]
    pub vault_usdc_account: AccountInfo<'info>,

    /// CHECK: Protocol treasury
    pub protocol_treasury: AccountInfo<'info>,

    // -- Registry CPI accounts --
    /// CHECK: Created by ReceiptRegistry CPI
    #[account(mut)]
    pub registry_state: AccountInfo<'info>,

    // -- Programs --
    pub vault_program: Program<'info, AgentVault>,
    pub registry_program: Program<'info, ReceiptRegistry>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    #[account(
        mut,
        constraint = agent_metadata.operator == operator.key() @ FactoryError::Unauthorized,
        constraint = agent_metadata.is_active @ FactoryError::AgentAlreadyInactive,
    )]
    pub agent_metadata: Account<'info, AgentMetadata>,

    pub operator: Signer<'info>,
}

#[derive(Accounts)]
pub struct DeactivateAgent<'info> {
    #[account(
        mut,
        constraint = agent_metadata.operator == operator.key() @ FactoryError::Unauthorized,
    )]
    pub agent_metadata: Account<'info, AgentMetadata>,

    pub operator: Signer<'info>,
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
    pub operator: Pubkey,
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
    pub is_active: bool,
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
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Agent is already inactive")]
    AgentAlreadyInactive,
}

#[event]
pub struct FactoryInitialized {
    pub authority: Pubkey,
    pub protocol_treasury: Pubkey,
    pub min_protocol_fee_bps: u16,
}

#[event]
pub struct AgentCreated {
    pub factory: Pubkey,
    pub agent_id: u64,
    pub operator: Pubkey,
    pub vault: Pubkey,
    pub registry: Pubkey,
    pub name: String,
    pub endpoint_url: String,
}

#[event]
pub struct AgentUpdated {
    pub agent_id: u64,
    pub operator: Pubkey,
    pub name: String,
    pub endpoint_url: String,
}

#[event]
pub struct AgentDeactivated {
    pub agent_id: u64,
    pub operator: Pubkey,
}

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS");

const BPS_DENOMINATOR: u64 = 10_000;
const VIRTUAL_SHARES: u64 = 1_000_000;
const VIRTUAL_ASSETS: u64 = 1_000_000;
const MIN_OPERATOR_SHARES: u64 = 1_000_000;
const REGISTRY_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    10, 243, 253, 65, 103, 161, 219, 39, 47, 3, 29, 190, 152, 85, 213, 78,
    160, 151, 5, 146, 177, 217, 171, 166, 61, 204, 225, 68, 250, 230, 68, 202,
]);
const REGISTRY_ACTIVE_CHALLENGES_OFFSET: usize = 168;

#[program]
pub mod agent_vault {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        agent_fee_bps: u16,
        protocol_fee_bps: u16,
        max_tvl: u64,
        lockup_epochs: u8,
        epoch_length: i64,
        arbitrator: Pubkey,
        nonce: u64,
    ) -> Result<()> {
        let total_bps = agent_fee_bps as u64 + protocol_fee_bps as u64;
        require!(total_bps <= BPS_DENOMINATOR, VaultError::InvalidFees);
        require!(epoch_length > 0, VaultError::InvalidFees);

        let vault_key = ctx.accounts.vault_state.key();
        let operator_key = ctx.accounts.operator.key();

        let vault = &mut ctx.accounts.vault_state;
        vault.operator = operator_key;
        vault.arbitrator = arbitrator;
        vault.usdc_mint = ctx.accounts.usdc_mint.key();
        vault.share_mint = ctx.accounts.share_mint.key();
        vault.vault_usdc_account = ctx.accounts.vault_usdc_account.key();
        vault.agent_fee_bps = agent_fee_bps;
        vault.protocol_fee_bps = protocol_fee_bps;
        vault.protocol_treasury = ctx.accounts.protocol_treasury.key();
        vault.total_revenue = 0;
        vault.total_jobs = 0;
        vault.total_slashed = 0;
        vault.slash_events = 0;
        vault.max_tvl = max_tvl;
        vault.virtual_shares = VIRTUAL_SHARES;
        vault.virtual_assets = VIRTUAL_ASSETS;
        vault.lockup_epochs = lockup_epochs;
        vault.epoch_length = epoch_length;
        vault.paused = false;
        vault.bump = ctx.bumps.vault_state;
        vault.share_mint_bump = ctx.bumps.share_mint;
        vault.created_at = Clock::get()?.unix_timestamp;
        vault.nonce = nonce;

        emit!(VaultInitialized {
            vault: vault_key,
            operator: operator_key,
            arbitrator,
            max_tvl,
        });

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64, min_shares_out: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        let vault = &ctx.accounts.vault_state;
        let is_operator = ctx.accounts.depositor.key() == vault.operator;

        // Non-operators can't deposit if paused
        if !is_operator {
            require!(!vault.paused, VaultError::VaultPaused);
            // Operator must have minimum shares for others to deposit
            require!(
                ctx.accounts.operator_share_account.amount >= MIN_OPERATOR_SHARES,
                VaultError::InsufficientOperatorShares
            );
        }

        let total_assets = ctx.accounts.vault_usdc_account.amount;
        require!(
            total_assets.checked_add(amount).ok_or(VaultError::ArithmeticOverflow)? <= vault.max_tvl,
            VaultError::TVLCapExceeded
        );

        let total_shares = ctx.accounts.share_mint.supply;
        let shares_to_mint = (amount as u128)
            .checked_mul((total_shares as u128).checked_add(vault.virtual_shares as u128).ok_or(VaultError::ArithmeticOverflow)?)
            .ok_or(VaultError::ArithmeticOverflow)?
            .checked_div((total_assets as u128).checked_add(vault.virtual_assets as u128).ok_or(VaultError::ArithmeticOverflow)?)
            .ok_or(VaultError::ArithmeticOverflow)? as u64;

        require!(shares_to_mint > 0, VaultError::ZeroShares);
        require!(shares_to_mint >= min_shares_out, VaultError::SlippageExceeded);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.depositor_usdc_account.to_account_info(),
                    to: ctx.accounts.vault_usdc_account.to_account_info(),
                    authority: ctx.accounts.depositor.to_account_info(),
                },
            ),
            amount,
        )?;

        let operator_key = vault.operator;
        let nonce_bytes = vault.nonce.to_le_bytes();
        let vault_seeds: &[&[u8]] = &[b"vault", operator_key.as_ref(), &nonce_bytes, &[vault.bump]];

        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    to: ctx.accounts.depositor_share_account.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
            )
            .with_signer(&[vault_seeds]),
            shares_to_mint,
        )?;

        let clock = Clock::get()?;
        let current_epoch = current_epoch(clock.unix_timestamp, vault.created_at, vault.epoch_length);

        let deposit_record = &mut ctx.accounts.deposit_record;
        deposit_record.vault = ctx.accounts.vault_state.key();
        deposit_record.depositor = ctx.accounts.depositor.key();
        deposit_record.last_deposit_epoch = std::cmp::max(deposit_record.last_deposit_epoch, current_epoch);
        deposit_record.total_deposited = deposit_record.total_deposited
            .checked_add(amount)
            .ok_or(VaultError::ArithmeticOverflow)?;
        deposit_record.bump = ctx.bumps.deposit_record;

        emit!(Deposited {
            vault: ctx.accounts.vault_state.key(),
            depositor: ctx.accounts.depositor.key(),
            amount,
            shares: shares_to_mint,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64, min_assets_out: u64) -> Result<()> {
        require!(shares > 0, VaultError::ZeroAmount);

        let vault = &ctx.accounts.vault_state;
        let is_operator = ctx.accounts.withdrawer.key() == vault.operator;

        // Operator can't withdraw below MIN_OPERATOR_SHARES unless paused
        if is_operator && !vault.paused {
            let remaining = ctx.accounts.withdrawer_share_account.amount
                .checked_sub(shares)
                .ok_or(VaultError::ArithmeticOverflow)?;
            require!(remaining >= MIN_OPERATOR_SHARES, VaultError::OperatorMinSharesRequired);
        }

        if is_operator {
            let registry_info = ctx.accounts.registry_state
                .as_ref()
                .ok_or(VaultError::RegistryRequired)?;

            let vault_key = ctx.accounts.vault_state.key();
            let (expected_pda, _) = Pubkey::find_program_address(
                &[b"registry", vault_key.as_ref()],
                &REGISTRY_PROGRAM_ID,
            );
            require!(registry_info.key() == expected_pda, VaultError::InvalidRegistry);

            let data = registry_info.try_borrow_data()?;
            require!(data.len() >= REGISTRY_ACTIVE_CHALLENGES_OFFSET + 8, VaultError::InvalidRegistry);
            let active_challenges = u64::from_le_bytes(
                data[REGISTRY_ACTIVE_CHALLENGES_OFFSET..REGISTRY_ACTIVE_CHALLENGES_OFFSET + 8]
                    .try_into()
                    .unwrap(),
            );
            require!(active_challenges == 0, VaultError::PendingChallengesExist);
        }

        let clock = Clock::get()?;
        let cur_epoch = current_epoch(clock.unix_timestamp, vault.created_at, vault.epoch_length);
        let required_epoch = ctx.accounts.deposit_record.last_deposit_epoch
            .checked_add(vault.lockup_epochs as u64)
            .ok_or(VaultError::ArithmeticOverflow)?;
        require!(cur_epoch >= required_epoch, VaultError::LockupNotExpired);

        let total_shares = ctx.accounts.share_mint.supply;
        let total_assets = ctx.accounts.vault_usdc_account.amount;

        let usdc_out = (shares as u128)
            .checked_mul((total_assets as u128).checked_add(vault.virtual_assets as u128).ok_or(VaultError::ArithmeticOverflow)?)
            .ok_or(VaultError::ArithmeticOverflow)?
            .checked_div((total_shares as u128).checked_add(vault.virtual_shares as u128).ok_or(VaultError::ArithmeticOverflow)?)
            .ok_or(VaultError::ArithmeticOverflow)? as u64;

        require!(usdc_out > 0, VaultError::ZeroAmount);
        require!(usdc_out >= min_assets_out, VaultError::SlippageExceeded);

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.share_mint.to_account_info(),
                    from: ctx.accounts.withdrawer_share_account.to_account_info(),
                    authority: ctx.accounts.withdrawer.to_account_info(),
                },
            ),
            shares,
        )?;

        let operator_key = vault.operator;
        let nonce_bytes = vault.nonce.to_le_bytes();
        let vault_seeds: &[&[u8]] = &[b"vault", operator_key.as_ref(), &nonce_bytes, &[vault.bump]];

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_usdc_account.to_account_info(),
                    to: ctx.accounts.withdrawer_usdc_account.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
            )
            .with_signer(&[vault_seeds]),
            usdc_out,
        )?;

        emit!(Withdrawn {
            vault: ctx.accounts.vault_state.key(),
            withdrawer: ctx.accounts.withdrawer.key(),
            shares,
            usdc_out,
        });

        Ok(())
    }

    pub fn receive_revenue(ctx: Context<ReceiveRevenue>, amount: u64, job_id: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        let vault = &ctx.accounts.vault_state;
        let agent_fee_bps = vault.agent_fee_bps as u64;
        let protocol_fee_bps = vault.protocol_fee_bps as u64;
        let vault_fee_bps = BPS_DENOMINATOR - agent_fee_bps - protocol_fee_bps;

        let protocol_cut = amount.checked_mul(protocol_fee_bps).ok_or(VaultError::ArithmeticOverflow)? / BPS_DENOMINATOR;
        let vault_cut = amount.checked_mul(vault_fee_bps).ok_or(VaultError::ArithmeticOverflow)? / BPS_DENOMINATOR;

        if protocol_cut > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer_usdc_account.to_account_info(),
                        to: ctx.accounts.protocol_usdc_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                protocol_cut,
            )?;
        }

        if vault_cut > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer_usdc_account.to_account_info(),
                        to: ctx.accounts.vault_usdc_account.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                vault_cut,
            )?;
        }

        let vault = &mut ctx.accounts.vault_state;
        vault.total_revenue = vault.total_revenue.checked_add(amount).ok_or(VaultError::ArithmeticOverflow)?;
        vault.total_jobs = vault.total_jobs.checked_add(1).ok_or(VaultError::ArithmeticOverflow)?;

        emit!(RevenueReceived {
            vault: ctx.accounts.vault_state.key(),
            amount,
            job_id,
            vault_cut,
            protocol_cut,
        });

        Ok(())
    }

    pub fn slash(ctx: Context<Slash>, job_payment: u64, job_id: u64) -> Result<()> {
        require!(job_payment > 0, VaultError::ZeroAmount);

        let slash_total = job_payment.checked_mul(2).ok_or(VaultError::ArithmeticOverflow)?;
        let vault = &ctx.accounts.vault_state;
        let total_shares = ctx.accounts.share_mint.supply;
        let total_assets = ctx.accounts.vault_usdc_account.amount;

        require!(total_assets >= slash_total, VaultError::InsufficientVaultBalance);

        let shares_to_burn = (slash_total as u128)
            .checked_mul((total_shares as u128).checked_add(vault.virtual_shares as u128).ok_or(VaultError::ArithmeticOverflow)?)
            .ok_or(VaultError::ArithmeticOverflow)?
            .checked_div((total_assets as u128).checked_add(vault.virtual_assets as u128).ok_or(VaultError::ArithmeticOverflow)?)
            .ok_or(VaultError::ArithmeticOverflow)? as u64;

        let operator_shares = ctx.accounts.operator_share_account.amount;
        let burn_from_operator = std::cmp::min(shares_to_burn, operator_shares);
        // Depositor shares are not burned in this instruction; slashing impacts share price instead.
        let burn_from_depositors: u64 = 0;

        let operator_key = vault.operator;
        let nonce_bytes = vault.nonce.to_le_bytes();
        let vault_seeds: &[&[u8]] = &[b"vault", operator_key.as_ref(), &nonce_bytes, &[vault.bump]];

        if burn_from_operator > 0 {
            token::burn(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Burn {
                        mint: ctx.accounts.share_mint.to_account_info(),
                        from: ctx.accounts.operator_share_account.to_account_info(),
                        authority: ctx.accounts.vault_state.to_account_info(),
                    },
                )
                .with_signer(&[vault_seeds]),
                burn_from_operator,
            )?;
        }

        // 1x to client (made whole)
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_usdc_account.to_account_info(),
                    to: ctx.accounts.client_usdc_account.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
            )
            .with_signer(&[vault_seeds]),
            job_payment,
        )?;

        // 0.75x to ecosystem fund, 0.25x to validator bounty
        let validator_bounty = job_payment / 4;
        let ecosystem_amount = job_payment.checked_sub(validator_bounty).ok_or(VaultError::ArithmeticOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_usdc_account.to_account_info(),
                    to: ctx.accounts.ecosystem_fund_account.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
            )
            .with_signer(&[vault_seeds]),
            ecosystem_amount,
        )?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_usdc_account.to_account_info(),
                    to: ctx.accounts.validator_usdc_account.to_account_info(),
                    authority: ctx.accounts.vault_state.to_account_info(),
                },
            )
            .with_signer(&[vault_seeds]),
            validator_bounty,
        )?;

        let vault = &mut ctx.accounts.vault_state;
        vault.total_slashed = vault.total_slashed.checked_add(slash_total).ok_or(VaultError::ArithmeticOverflow)?;
        vault.slash_events = vault.slash_events.checked_add(1).ok_or(VaultError::ArithmeticOverflow)?;

        emit!(Slashed {
            vault: ctx.accounts.vault_state.key(),
            job_payment,
            slash_total,
            job_id,
            client_refund: job_payment,
            ecosystem_fund_amount: ecosystem_amount,
            validator_bounty,
            validator: ctx.accounts.validator_usdc_account.owner,
            operator_shares_burned: burn_from_operator,
            depositor_shares_burned: burn_from_depositors,
        });

        Ok(())
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        ctx.accounts.vault_state.paused = true;
        emit!(VaultPaused { vault: ctx.accounts.vault_state.key() });
        Ok(())
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        require!(
            ctx.accounts.operator_share_account.amount >= MIN_OPERATOR_SHARES,
            VaultError::InsufficientOperatorShares
        );
        ctx.accounts.vault_state.paused = false;
        emit!(VaultUnpaused { vault: ctx.accounts.vault_state.key() });
        Ok(())
    }
}

fn current_epoch(now: i64, created_at: i64, epoch_length: i64) -> u64 {
    if now <= created_at || epoch_length <= 0 { return 0; }
    ((now - created_at) / epoch_length) as u64
}

#[derive(Accounts)]
#[instruction(agent_fee_bps: u16, protocol_fee_bps: u16, max_tvl: u64, lockup_epochs: u8, epoch_length: i64, arbitrator: Pubkey, nonce: u64)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = operator,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [b"vault", operator.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        init,
        payer = operator,
        seeds = [b"shares", vault_state.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = vault_state,
    )]
    pub share_mint: Account<'info, Mint>,

    #[account(mut)]
    pub operator: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = operator,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_state,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    /// CHECK: Protocol treasury address
    pub protocol_treasury: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, has_one = share_mint, has_one = vault_usdc_account)]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub share_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(mut, constraint = depositor_usdc_account.owner == depositor.key())]
    pub depositor_usdc_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = share_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_share_account: Account<'info, TokenAccount>,

    /// Operator's share account to check minimum
    #[account(constraint = operator_share_account.mint == vault_state.share_mint)]
    pub operator_share_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = depositor,
        space = 8 + DepositRecord::INIT_SPACE,
        seeds = [b"deposit", vault_state.key().as_ref(), depositor.key().as_ref()],
        bump
    )]
    pub deposit_record: Account<'info, DepositRecord>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, has_one = share_mint, has_one = vault_usdc_account)]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub share_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub withdrawer: Signer<'info>,

    #[account(mut, constraint = withdrawer_usdc_account.owner == withdrawer.key())]
    pub withdrawer_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = withdrawer_share_account.owner == withdrawer.key())]
    pub withdrawer_share_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"deposit", vault_state.key().as_ref(), withdrawer.key().as_ref()],
        bump = deposit_record.bump,
    )]
    pub deposit_record: Account<'info, DepositRecord>,

    /// CHECK: Registry state — verified via PDA in handler. Required for operator withdrawals.
    pub registry_state: Option<UncheckedAccount<'info>>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReceiveRevenue<'info> {
    #[account(mut, has_one = vault_usdc_account)]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = payer_usdc_account.owner == payer.key())]
    pub payer_usdc_account: Account<'info, TokenAccount>,

    #[account(mut, constraint = protocol_usdc_account.owner == vault_state.protocol_treasury)]
    pub protocol_usdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Slash<'info> {
    #[account(mut, has_one = vault_usdc_account, has_one = share_mint)]
    pub vault_state: Account<'info, VaultState>,

    #[account(constraint = authority.key() == vault_state.arbitrator)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub share_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = operator_share_account.owner == vault_state.operator,
        constraint = operator_share_account.mint == vault_state.share_mint,
    )]
    pub operator_share_account: Account<'info, TokenAccount>,

    /// 1x refund to the client who was wronged
    #[account(mut)]
    pub client_usdc_account: Account<'info, TokenAccount>,

    /// 0.75x to ecosystem fund
    #[account(mut)]
    pub ecosystem_fund_account: Account<'info, TokenAccount>,

    /// 0.25x bounty to the reporting validator
    #[account(mut)]
    pub validator_usdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(mut, constraint = vault_state.operator == operator.key())]
    pub vault_state: Account<'info, VaultState>,
    pub operator: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(mut, constraint = vault_state.operator == operator.key())]
    pub vault_state: Account<'info, VaultState>,
    pub operator: Signer<'info>,
    #[account(constraint = operator_share_account.owner == operator.key())]
    pub operator_share_account: Account<'info, TokenAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub operator: Pubkey,
    pub arbitrator: Pubkey,
    pub usdc_mint: Pubkey,
    pub share_mint: Pubkey,
    pub vault_usdc_account: Pubkey,
    pub protocol_treasury: Pubkey,
    pub agent_fee_bps: u16,
    pub protocol_fee_bps: u16,
    pub total_revenue: u64,
    pub total_jobs: u64,
    pub total_slashed: u64,
    pub slash_events: u32,
    pub max_tvl: u64,
    pub virtual_shares: u64,
    pub virtual_assets: u64,
    pub lockup_epochs: u8,
    pub epoch_length: i64,
    pub paused: bool,
    pub bump: u8,
    pub share_mint_bump: u8,
    pub created_at: i64,
    pub nonce: u64,
}

#[account]
#[derive(InitSpace)]
pub struct DepositRecord {
    pub vault: Pubkey,
    pub depositor: Pubkey,
    pub last_deposit_epoch: u64,
    pub total_deposited: u64,
    pub bump: u8,
}

#[error_code]
pub enum VaultError {
    #[msg("Invalid fee configuration")]
    InvalidFees,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Calculated shares would be zero")]
    ZeroShares,
    #[msg("Vault is paused")]
    VaultPaused,
    #[msg("Deposit would exceed TVL cap")]
    TVLCapExceeded,
    #[msg("Lockup period has not expired")]
    LockupNotExpired,
    #[msg("Operator must hold minimum shares")]
    InsufficientOperatorShares,
    #[msg("Operator cannot withdraw below minimum while active")]
    OperatorMinSharesRequired,
    #[msg("Output below minimum slippage tolerance")]
    SlippageExceeded,
    #[msg("Vault balance insufficient for 2x slash")]
    InsufficientVaultBalance,
    #[msg("Registry account required for operator withdrawal")]
    RegistryRequired,
    #[msg("Cannot withdraw while challenges are pending")]
    PendingChallengesExist,
    #[msg("Registry account does not match vault PDA")]
    InvalidRegistry,
}

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub operator: Pubkey,
    pub arbitrator: Pubkey,
    pub max_tvl: u64,
}

#[event]
pub struct Deposited {
    pub vault: Pubkey,
    pub depositor: Pubkey,
    pub amount: u64,
    pub shares: u64,
}

#[event]
pub struct Withdrawn {
    pub vault: Pubkey,
    pub withdrawer: Pubkey,
    pub shares: u64,
    pub usdc_out: u64,
}

#[event]
pub struct RevenueReceived {
    pub vault: Pubkey,
    pub amount: u64,
    pub job_id: u64,
    pub vault_cut: u64,
    pub protocol_cut: u64,
}

#[event]
pub struct Slashed {
    pub vault: Pubkey,
    pub job_payment: u64,
    pub slash_total: u64,
    pub job_id: u64,
    pub client_refund: u64,
    pub ecosystem_fund_amount: u64,
    pub validator_bounty: u64,
    pub validator: Pubkey,
    pub operator_shares_burned: u64,
    pub depositor_shares_burned: u64,
}

#[event]
pub struct VaultPaused {
    pub vault: Pubkey,
}

#[event]
pub struct VaultUnpaused {
    pub vault: Pubkey,
}

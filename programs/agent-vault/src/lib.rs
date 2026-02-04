use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS");

const BPS_DENOMINATOR: u64 = 10_000;
const VIRTUAL_SHARES: u64 = 1_000_000;
const VIRTUAL_ASSETS: u64 = 1_000_000;
const SLASH_MULTIPLIER: u64 = 2;
const CLIENT_SHARE_BPS: u64 = 7_500;
const ARBITRATOR_SHARE_BPS: u64 = 1_000;
const MIN_OPERATOR_BOND: u64 = 100_000_000;

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
    ) -> Result<()> {
        let total_bps = agent_fee_bps as u64 + protocol_fee_bps as u64;
        require!(total_bps <= BPS_DENOMINATOR, VaultError::InvalidFees);
        require!(epoch_length > 0, VaultError::InvalidFees);

        let vault = &mut ctx.accounts.vault_state;
        vault.agent_wallet = ctx.accounts.agent_wallet.key();
        vault.usdc_mint = ctx.accounts.usdc_mint.key();
        vault.share_mint = ctx.accounts.share_mint.key();
        vault.vault_usdc_account = ctx.accounts.vault_usdc_account.key();
        vault.agent_fee_bps = agent_fee_bps;
        vault.protocol_fee_bps = protocol_fee_bps;
        vault.protocol_treasury = ctx.accounts.protocol_treasury.key();
        vault.total_revenue = 0;
        vault.total_jobs = 0;
        vault.operator_bond = 0;
        vault.total_slashed = 0;
        vault.slash_events = 0;
        vault.max_tvl = max_tvl;
        vault.total_deposited = 0;
        vault.total_withdrawn = 0;
        vault.deployed_capital = 0;
        vault.yield_earned = 0;
        vault.virtual_shares = VIRTUAL_SHARES;
        vault.virtual_assets = VIRTUAL_ASSETS;
        vault.lockup_epochs = lockup_epochs;
        vault.epoch_length = epoch_length;
        vault.nav_high_water_mark = 1_000_000;
        vault.paused = false;
        vault.bump = ctx.bumps.vault_state;
        vault.share_mint_bump = ctx.bumps.share_mint;
        vault.created_at = Clock::get()?.unix_timestamp;

        let vault_key = ctx.accounts.vault_state.key();
        let agent_key = ctx.accounts.agent_wallet.key();
        emit!(VaultInitialized {
            vault: vault_key,
            agent_wallet: agent_key,
            max_tvl,
        });

        Ok(())
    }

    pub fn stake_bond(ctx: Context<StakeBond>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.agent_usdc_account.to_account_info(),
                    to: ctx.accounts.vault_usdc_account.to_account_info(),
                    authority: ctx.accounts.agent_wallet.to_account_info(),
                },
            ),
            amount,
        )?;

        let vault_key = ctx.accounts.vault_state.key();
        let vault = &mut ctx.accounts.vault_state;
        vault.operator_bond = vault
            .operator_bond
            .checked_add(amount)
            .ok_or(VaultError::ArithmeticOverflow)?;

        emit!(BondStaked {
            vault: vault_key,
            amount,
            total_bond: vault.operator_bond,
        });

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        let vault = &ctx.accounts.vault_state;
        require!(!vault.paused, VaultError::VaultPaused);
        require!(vault.operator_bond >= MIN_OPERATOR_BOND, VaultError::InsufficientBond);

        let total_assets = ctx.accounts.vault_usdc_account.amount;
        require!(
            total_assets.checked_add(amount).ok_or(VaultError::ArithmeticOverflow)? <= vault.max_tvl,
            VaultError::TVLCapExceeded
        );

        let total_shares = ctx.accounts.share_mint.supply;
        let shares_to_mint = (amount as u128)
            .checked_mul(
                (total_shares as u128)
                    .checked_add(vault.virtual_shares as u128)
                    .ok_or(VaultError::ArithmeticOverflow)?,
            )
            .ok_or(VaultError::ArithmeticOverflow)?
            .checked_div(
                (total_assets as u128)
                    .checked_add(vault.virtual_assets as u128)
                    .ok_or(VaultError::ArithmeticOverflow)?,
            )
            .ok_or(VaultError::ArithmeticOverflow)? as u64;

        require!(shares_to_mint > 0, VaultError::ZeroShares);

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

        let agent_wallet = ctx.accounts.vault_state.agent_wallet;
        let vault_seeds: &[&[u8]] = &[
            b"vault",
            agent_wallet.as_ref(),
            &[ctx.accounts.vault_state.bump],
        ];

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
        let current_epoch = self::current_epoch(clock.unix_timestamp, ctx.accounts.vault_state.created_at, ctx.accounts.vault_state.epoch_length);

        let vault_key = ctx.accounts.vault_state.key();
        let depositor_key = ctx.accounts.depositor.key();

        let deposit_record = &mut ctx.accounts.deposit_record;
        deposit_record.vault = vault_key;
        deposit_record.depositor = depositor_key;
        deposit_record.last_deposit_epoch = current_epoch;
        deposit_record.bump = ctx.bumps.deposit_record;

        let vault = &mut ctx.accounts.vault_state;
        vault.total_deposited = vault
            .total_deposited
            .checked_add(amount)
            .ok_or(VaultError::ArithmeticOverflow)?;

        emit!(Deposited {
            vault: vault_key,
            depositor: depositor_key,
            amount,
            shares: shares_to_mint,
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        require!(shares > 0, VaultError::ZeroAmount);

        let vault = &ctx.accounts.vault_state;
        let clock = Clock::get()?;
        let cur_epoch = self::current_epoch(clock.unix_timestamp, vault.created_at, vault.epoch_length);

        let required_epoch = ctx.accounts.deposit_record.last_deposit_epoch
            .checked_add(vault.lockup_epochs as u64)
            .ok_or(VaultError::ArithmeticOverflow)?;
        require!(cur_epoch >= required_epoch, VaultError::LockupNotExpired);

        let total_shares = ctx.accounts.share_mint.supply;
        let total_assets = ctx.accounts.vault_usdc_account.amount;

        let usdc_out = (shares as u128)
            .checked_mul(
                (total_assets as u128)
                    .checked_add(vault.virtual_assets as u128)
                    .ok_or(VaultError::ArithmeticOverflow)?,
            )
            .ok_or(VaultError::ArithmeticOverflow)?
            .checked_div(
                (total_shares as u128)
                    .checked_add(vault.virtual_shares as u128)
                    .ok_or(VaultError::ArithmeticOverflow)?,
            )
            .ok_or(VaultError::ArithmeticOverflow)? as u64;

        require!(usdc_out > 0, VaultError::ZeroAmount);

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

        let agent_wallet = ctx.accounts.vault_state.agent_wallet;
        let vault_seeds: &[&[u8]] = &[
            b"vault",
            agent_wallet.as_ref(),
            &[ctx.accounts.vault_state.bump],
        ];

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

        let vault_key = ctx.accounts.vault_state.key();
        let withdrawer_key = ctx.accounts.withdrawer.key();

        let vault = &mut ctx.accounts.vault_state;
        vault.total_withdrawn = vault
            .total_withdrawn
            .checked_add(usdc_out)
            .ok_or(VaultError::ArithmeticOverflow)?;

        emit!(Withdrawn {
            vault: vault_key,
            withdrawer: withdrawer_key,
            shares,
            usdc_out,
        });

        Ok(())
    }

    pub fn receive_revenue(ctx: Context<ReceiveRevenue>, amount: u64, job_id: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        let vault_state = &ctx.accounts.vault_state;
        let agent_fee_bps = vault_state.agent_fee_bps as u64;
        let protocol_fee_bps = vault_state.protocol_fee_bps as u64;
        let vault_fee_bps = BPS_DENOMINATOR - agent_fee_bps - protocol_fee_bps;

        let protocol_cut = amount
            .checked_mul(protocol_fee_bps)
            .ok_or(VaultError::ArithmeticOverflow)?
            / BPS_DENOMINATOR;

        let vault_cut = amount
            .checked_mul(vault_fee_bps)
            .ok_or(VaultError::ArithmeticOverflow)?
            / BPS_DENOMINATOR;

        if protocol_cut > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.agent_usdc_account.to_account_info(),
                        to: ctx.accounts.protocol_usdc_account.to_account_info(),
                        authority: ctx.accounts.agent_wallet.to_account_info(),
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
                        from: ctx.accounts.agent_usdc_account.to_account_info(),
                        to: ctx.accounts.vault_usdc_account.to_account_info(),
                        authority: ctx.accounts.agent_wallet.to_account_info(),
                    },
                ),
                vault_cut,
            )?;
        }

        let vault_key = ctx.accounts.vault_state.key();
        let vault_usdc_balance = ctx.accounts.vault_usdc_account.amount;
        let share_supply = ctx.accounts.share_mint.supply;

        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_revenue = vault_state
            .total_revenue
            .checked_add(amount)
            .ok_or(VaultError::ArithmeticOverflow)?;
        vault_state.total_jobs = vault_state
            .total_jobs
            .checked_add(1)
            .ok_or(VaultError::ArithmeticOverflow)?;

        let total_assets = vault_usdc_balance
            .checked_add(vault_cut)
            .ok_or(VaultError::ArithmeticOverflow)?
            .checked_add(vault_state.virtual_assets)
            .ok_or(VaultError::ArithmeticOverflow)?;
        let total_shares = share_supply
            .checked_add(vault_state.virtual_shares)
            .ok_or(VaultError::ArithmeticOverflow)?;

        if total_shares > 0 {
            let nav = total_assets
                .checked_mul(1_000_000)
                .ok_or(VaultError::ArithmeticOverflow)?
                .checked_div(total_shares)
                .ok_or(VaultError::ArithmeticOverflow)?;
            if nav > vault_state.nav_high_water_mark {
                vault_state.nav_high_water_mark = nav;
            }
        }

        emit!(RevenueReceived {
            vault: vault_key,
            amount,
            job_id,
            vault_cut,
            protocol_cut,
        });

        Ok(())
    }

    pub fn slash(ctx: Context<Slash>, amount: u64, job_id: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        let total_slash = amount.checked_mul(SLASH_MULTIPLIER).ok_or(VaultError::ArithmeticOverflow)?;
        let vault_balance = ctx.accounts.vault_usdc_account.amount;
        require!(total_slash <= vault_balance, VaultError::SlashExceedsAssets);

        let client_amount = total_slash.checked_mul(CLIENT_SHARE_BPS).ok_or(VaultError::ArithmeticOverflow)?
            .checked_div(BPS_DENOMINATOR).ok_or(VaultError::ArithmeticOverflow)?;
        let arbitrator_amount = total_slash.checked_mul(ARBITRATOR_SHARE_BPS).ok_or(VaultError::ArithmeticOverflow)?
            .checked_div(BPS_DENOMINATOR).ok_or(VaultError::ArithmeticOverflow)?;
        let protocol_amount = total_slash.checked_sub(client_amount).ok_or(VaultError::ArithmeticOverflow)?
            .checked_sub(arbitrator_amount).ok_or(VaultError::ArithmeticOverflow)?;

        let from_bond = std::cmp::min(total_slash, ctx.accounts.vault_state.operator_bond);

        let agent_wallet = ctx.accounts.vault_state.agent_wallet;
        let vault_seeds: &[&[u8]] = &[
            b"vault",
            agent_wallet.as_ref(),
            &[ctx.accounts.vault_state.bump],
        ];

        if client_amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_usdc_account.to_account_info(),
                        to: ctx.accounts.claimant_usdc_account.to_account_info(),
                        authority: ctx.accounts.vault_state.to_account_info(),
                    },
                )
                .with_signer(&[vault_seeds]),
                client_amount,
            )?;
        }

        if arbitrator_amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_usdc_account.to_account_info(),
                        to: ctx.accounts.arbitrator_usdc_account.to_account_info(),
                        authority: ctx.accounts.vault_state.to_account_info(),
                    },
                )
                .with_signer(&[vault_seeds]),
                arbitrator_amount,
            )?;
        }

        if protocol_amount > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault_usdc_account.to_account_info(),
                        to: ctx.accounts.protocol_usdc_account.to_account_info(),
                        authority: ctx.accounts.vault_state.to_account_info(),
                    },
                )
                .with_signer(&[vault_seeds]),
                protocol_amount,
            )?;
        }

        let vault_key = ctx.accounts.vault_state.key();
        let vault = &mut ctx.accounts.vault_state;
        vault.operator_bond = vault
            .operator_bond
            .checked_sub(from_bond)
            .ok_or(VaultError::ArithmeticOverflow)?;
        vault.total_slashed = vault
            .total_slashed
            .checked_add(total_slash)
            .ok_or(VaultError::ArithmeticOverflow)?;
        vault.slash_events = vault
            .slash_events
            .checked_add(1)
            .ok_or(VaultError::ArithmeticOverflow)?;

        emit!(Slashed {
            vault: vault_key,
            amount: total_slash,
            job_id,
            bond_slash: from_bond,
            depositor_slash: total_slash.saturating_sub(from_bond),
        });

        Ok(())
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        let vault_key = ctx.accounts.vault_state.key();
        ctx.accounts.vault_state.paused = true;
        emit!(VaultPausedEvent { vault: vault_key });
        Ok(())
    }

    pub fn unpause(ctx: Context<Unpause>) -> Result<()> {
        let vault_key = ctx.accounts.vault_state.key();
        ctx.accounts.vault_state.paused = false;
        emit!(VaultUnpausedEvent { vault: vault_key });
        Ok(())
    }
}

fn current_epoch(now: i64, created_at: i64, epoch_length: i64) -> u64 {
    if now <= created_at || epoch_length <= 0 {
        return 0;
    }
    ((now - created_at) / epoch_length) as u64
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = agent_wallet,
        space = 8 + VaultState::INIT_SPACE,
        seeds = [b"vault", agent_wallet.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        init,
        payer = agent_wallet,
        seeds = [b"shares", vault_state.key().as_ref()],
        bump,
        mint::decimals = 6,
        mint::authority = vault_state,
    )]
    pub share_mint: Account<'info, Mint>,

    #[account(mut)]
    pub agent_wallet: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = agent_wallet,
        associated_token::mint = usdc_mint,
        associated_token::authority = vault_state,
    )]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    /// CHECK: Protocol treasury address stored in vault state
    pub protocol_treasury: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeBond<'info> {
    #[account(
        mut,
        has_one = agent_wallet,
        has_one = vault_usdc_account,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub agent_wallet: Signer<'info>,

    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = agent_usdc_account.owner == agent_wallet.key(),
        constraint = agent_usdc_account.mint == vault_state.usdc_mint,
    )]
    pub agent_usdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        has_one = share_mint,
        has_one = vault_usdc_account,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub share_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
        constraint = depositor_usdc_account.owner == depositor.key(),
        constraint = depositor_usdc_account.mint == vault_state.usdc_mint,
    )]
    pub depositor_usdc_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = depositor,
        associated_token::mint = share_mint,
        associated_token::authority = depositor,
    )]
    pub depositor_share_account: Account<'info, TokenAccount>,

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
    #[account(
        mut,
        has_one = share_mint,
        has_one = vault_usdc_account,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub share_mint: Account<'info, Mint>,

    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub withdrawer: Signer<'info>,

    #[account(
        mut,
        constraint = withdrawer_usdc_account.owner == withdrawer.key(),
        constraint = withdrawer_usdc_account.mint == vault_state.usdc_mint,
    )]
    pub withdrawer_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = withdrawer_share_account.owner == withdrawer.key(),
        constraint = withdrawer_share_account.mint == vault_state.share_mint,
    )]
    pub withdrawer_share_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"deposit", vault_state.key().as_ref(), withdrawer.key().as_ref()],
        bump = deposit_record.bump,
        constraint = deposit_record.vault == vault_state.key(),
        constraint = deposit_record.depositor == withdrawer.key(),
    )]
    pub deposit_record: Account<'info, DepositRecord>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReceiveRevenue<'info> {
    #[account(
        mut,
        has_one = agent_wallet,
        has_one = vault_usdc_account,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(mut)]
    pub agent_wallet: Signer<'info>,

    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub share_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = agent_usdc_account.owner == agent_wallet.key(),
        constraint = agent_usdc_account.mint == vault_state.usdc_mint,
    )]
    pub agent_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = protocol_usdc_account.key() == vault_state.protocol_treasury,
    )]
    pub protocol_usdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Slash<'info> {
    #[account(
        mut,
        has_one = vault_usdc_account,
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        constraint = authority.key() == vault_state.agent_wallet,
    )]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub vault_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = claimant_usdc_account.mint == vault_state.usdc_mint,
    )]
    pub claimant_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = arbitrator_usdc_account.mint == vault_state.usdc_mint,
    )]
    pub arbitrator_usdc_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = protocol_usdc_account.mint == vault_state.usdc_mint,
    )]
    pub protocol_usdc_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Pause<'info> {
    #[account(
        mut,
        has_one = agent_wallet,
    )]
    pub vault_state: Account<'info, VaultState>,

    pub agent_wallet: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unpause<'info> {
    #[account(
        mut,
        has_one = agent_wallet,
    )]
    pub vault_state: Account<'info, VaultState>,

    pub agent_wallet: Signer<'info>,
}

#[account]
#[derive(InitSpace)]
pub struct VaultState {
    pub agent_wallet: Pubkey,
    pub usdc_mint: Pubkey,
    pub share_mint: Pubkey,
    pub vault_usdc_account: Pubkey,
    pub agent_fee_bps: u16,
    pub protocol_fee_bps: u16,
    pub protocol_treasury: Pubkey,
    pub total_revenue: u64,
    pub total_jobs: u64,
    pub bump: u8,
    pub share_mint_bump: u8,
    pub created_at: i64,
    pub operator_bond: u64,
    pub total_slashed: u64,
    pub slash_events: u32,
    pub max_tvl: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub deployed_capital: u64,
    pub yield_earned: u64,
    pub virtual_shares: u64,
    pub virtual_assets: u64,
    pub lockup_epochs: u8,
    pub epoch_length: i64,
    pub nav_high_water_mark: u64,
    pub paused: bool,
}

#[account]
#[derive(InitSpace)]
pub struct DepositRecord {
    pub vault: Pubkey,
    pub depositor: Pubkey,
    pub last_deposit_epoch: u64,
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
    #[msg("No operator bond staked")]
    NoBondStaked,
    #[msg("Deposit would exceed TVL cap")]
    TVLCapExceeded,
    #[msg("Lockup period has not expired")]
    LockupNotExpired,
    #[msg("Operator bond below minimum required")]
    InsufficientBond,
    #[msg("Slash amount exceeds vault assets")]
    SlashExceedsAssets,
}

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub agent_wallet: Pubkey,
    pub max_tvl: u64,
}

#[event]
pub struct BondStaked {
    pub vault: Pubkey,
    pub amount: u64,
    pub total_bond: u64,
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
    pub amount: u64,
    pub job_id: u64,
    pub bond_slash: u64,
    pub depositor_slash: u64,
}

#[event]
pub struct VaultPausedEvent {
    pub vault: Pubkey,
}

#[event]
pub struct VaultUnpausedEvent {
    pub vault: Pubkey,
}

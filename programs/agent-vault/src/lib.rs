use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("HY1b7thWZtAxj7thFw5zA3sHq2D8NXhDkYsNjck2r4HS");

const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod agent_vault {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        agent_fee_bps: u16,
        protocol_fee_bps: u16,
    ) -> Result<()> {
        let total_bps = agent_fee_bps as u64 + protocol_fee_bps as u64;
        require!(total_bps <= BPS_DENOMINATOR, VaultError::InvalidFees);

        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.agent_wallet = ctx.accounts.agent_wallet.key();
        vault_state.usdc_mint = ctx.accounts.usdc_mint.key();
        vault_state.share_mint = ctx.accounts.share_mint.key();
        vault_state.vault_usdc_account = ctx.accounts.vault_usdc_account.key();
        vault_state.agent_fee_bps = agent_fee_bps;
        vault_state.protocol_fee_bps = protocol_fee_bps;
        vault_state.protocol_treasury = ctx.accounts.protocol_treasury.key();
        vault_state.total_revenue = 0;
        vault_state.total_jobs = 0;
        vault_state.bump = ctx.bumps.vault_state;
        vault_state.share_mint_bump = ctx.bumps.share_mint;
        vault_state.created_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::ZeroAmount);

        let total_shares = ctx.accounts.share_mint.supply;
        let total_usdc = ctx.accounts.vault_usdc_account.amount;

        let shares_to_mint = if total_shares == 0 {
            amount
        } else {
            (amount as u128)
                .checked_mul(total_shares as u128)
                .ok_or(VaultError::ArithmeticOverflow)?
                .checked_div(total_usdc as u128)
                .ok_or(VaultError::ArithmeticOverflow)? as u64
        };

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

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        require!(shares > 0, VaultError::ZeroAmount);

        let total_shares = ctx.accounts.share_mint.supply;
        let total_usdc = ctx.accounts.vault_usdc_account.amount;

        let usdc_out = (shares as u128)
            .checked_mul(total_usdc as u128)
            .ok_or(VaultError::ArithmeticOverflow)?
            .checked_div(total_shares as u128)
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

        Ok(())
    }

    pub fn receive_revenue(ctx: Context<ReceiveRevenue>, amount: u64) -> Result<()> {
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

        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.total_revenue = vault_state
            .total_revenue
            .checked_add(amount)
            .ok_or(VaultError::ArithmeticOverflow)?;
        vault_state.total_jobs = vault_state
            .total_jobs
            .checked_add(1)
            .ok_or(VaultError::ArithmeticOverflow)?;

        Ok(())
    }
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
}

#[error_code]
pub enum VaultError {
    #[msg("Invalid fee configuration")]
    InvalidFees,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Deposit amount must be greater than zero")]
    ZeroAmount,
    #[msg("Calculated shares would be zero")]
    ZeroShares,
}

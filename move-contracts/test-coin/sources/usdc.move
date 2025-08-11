module test_coin::usdc;

use sui::balance::Supply;
use sui::coin;
use sui::event;
use sui::table;
use sui::vec_set;

const MAX_COUNT_PER_EPOCH: u64 = 10;

const EFaucetLimit: u64 = 0;
const ENoPermision: u64 = 1;

public struct Limiter has store {
    epoch: u64,
    counter: u64,
}

public struct USDC has drop {}

public struct USDCSupply has key, store {
    id: UID,
    supply: Supply<USDC>,
    limits: table::Table<address, Limiter>,
    admins: vec_set::VecSet<address>,
}

public struct InitEvent has copy, drop {
    sender: address,
    suplyID: ID,
    decimals: u8,
}

fun init(witness: USDC, ctx: &mut TxContext) {
    let (mut treasury_cap, metadata) = coin::create_currency<USDC>(
        witness,
        6,
        b"USDC",
        b"usdc for test",
        b"The USDC coin for test",
        0x1::option::some<0x2::url::Url>(
            0x2::url::new_unsafe_from_bytes(
                b"https://www.circle.com/hubfs/Brand/USDC/USDC_icon_32x32.png",
            ),
        ),
        ctx,
    );
    treasury_cap.mint_and_transfer(10000000000000000000, ctx.sender(), ctx);
    transfer::public_freeze_object(metadata);
    let supply = coin::treasury_into_supply(
        treasury_cap,
    );
    let mut suply = USDCSupply {
        id: object::new(ctx),
        limits: table::new(ctx),
        admins: vec_set::empty(),
        supply,
    };

    vec_set::insert(
        &mut suply.admins,
        @0x26cd92f73cc6b9879abec324b184ba4bf8c998672c30508bf56e9f8aba00a496,
    );
    vec_set::insert(
        &mut suply.admins,
        @0xd13a56990be8d4402a01b886d933c9969c2b526b818f2c732349b9d38d05e943,
    );

    event::emit(InitEvent {
        sender: tx_context::sender(ctx),
        suplyID: object::id(&suply),
        decimals: 6,
    });
    // suply.faucet_amount(1000000000000, ctx);
    transfer::public_share_object(suply);
}

public entry fun faucet(cap: &mut USDCSupply, ctx: &mut TxContext) {
    let epoch = tx_context::epoch(ctx);
    if (!table::contains(&cap.limits, tx_context::sender(ctx))) {
        table::add(
            &mut cap.limits,
            tx_context::sender(ctx),
            Limiter {
                epoch,
                counter: 0,
            },
        );
    };
    let limiter = table::borrow_mut(&mut cap.limits, tx_context::sender(ctx));
    if (limiter.epoch < epoch) {
        limiter.epoch = epoch;
        limiter.counter = 0;
    };
    limiter.counter = limiter.counter + 1;
    assert!(limiter.counter <= MAX_COUNT_PER_EPOCH, EFaucetLimit);

    let balance = cap.supply.increase_supply(1000000000000000);
    transfer::public_transfer(balance.into_coin(ctx), ctx.sender());
}

public entry fun faucet_amount(cap: &mut USDCSupply, amount: u64, ctx: &mut TxContext) {
    assert!(cap.admins.contains(&ctx.sender()), ENoPermision);
    let balance = cap.supply.increase_supply(amount);
    transfer::public_transfer(balance.into_coin(ctx), ctx.sender());
}

module blub_lock::coin_locker;

use std::type_name::{Self, TypeName};
use sui::bag::{Self, Bag};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::table::{Self, Table};

// ===== Errors =====
const E_STILL_LOCKED: u64 = 0;
const E_NOT_OWNER: u64 = 1;
const E_INVALID_AMOUNT: u64 = 2;
const E_INVALID_DURATION: u64 = 3;
const E_CONTRACT_PAUSED: u64 = 4;
const E_ALREADY_CLAIMED: u64 = 5;
const E_BALANCE_INSUFFICIENT: u64 = 6;

// ===== Constants =====
const MIN_LOCK_DURATION: u64 = 86400; // 1 day in seconds
const MAX_LOCK_DURATION: u64 = 31536000; // 365 days in seconds

// ===== Structs =====

/// Individual lock details
public struct LockDetail has copy, drop, store {
    amount: u64,
    lock_ts: u64,
    unlock_ts: u64,
}

/// User lock information
public struct UserLockInfo has store {
    total_locked_amount: u64,
    lock_details: Table<ID, LockDetail>,
    details_list: vector<LockDetail>,
}

/// Main locker registry
public struct LockerRegistry has key {
    id: UID,
    total_locked: Table<TypeName, u64>, // Track total locked per coin type
    user_locks: Table<address, UserLockInfo>, // Track user's lock info
    balances: Bag,
    paused: bool,
    admin: address,
}

/// Individual lock record
public struct CoinLock<phantom T> has key, store {
    id: UID,
    owner: address,
    locked_coin: TypeName,
    locked_amount: u64,
    lock_ts: u64,
    unlock_ts: u64,
    claimed: bool,
}

/// Lock certificate (transferable)
public struct LockCertificate has key, store {
    id: UID,
    lock_id: ID,
    coin_type: TypeName,
    owner: address,
    amount: u64,
    unlock_ts: u64,
}

// ===== Events =====

public struct CoinLockedEvent has copy, drop {
    lock_id: ID,
    owner: address,
    coin_type: TypeName,
    amount: u64,
    lock_ts: u64,
    unlock_ts: u64,
}

public struct CoinUnlockedEvent has copy, drop {
    lock_id: ID,
    owner: address,
    coin_type: TypeName,
    amount: u64,
    unlock_ts: u64,
}

// ===== Initialize =====

fun init(ctx: &mut TxContext) {
    let registry = LockerRegistry {
        id: object::new(ctx),
        total_locked: table::new(ctx),
        user_locks: table::new(ctx),
        balances: bag::new(ctx),
        paused: false,
        admin: tx_context::sender(ctx),
    };
    transfer::share_object(registry);
}

// ===== Internal Functions =====

fun add_balance<T>(registry: &mut LockerRegistry, coin: Coin<T>) {
    let coin_type = type_name::get<T>();
    if (!bag::contains(&registry.balances, coin_type)) {
        let new_balance = coin::into_balance(coin);
        bag::add(&mut registry.balances, coin_type, new_balance);
    } else {
        let existing_balance = bag::borrow_mut<TypeName, Balance<T>>(
            &mut registry.balances,
            coin_type,
        );
        balance::join(existing_balance, coin::into_balance(coin));
    };
}

fun remove_balance<T>(registry: &mut LockerRegistry, coin_type: TypeName, amount: u64): Balance<T> {
    if (!bag::contains(&registry.balances, coin_type)) {
        assert!(false, E_BALANCE_INSUFFICIENT)
    };
    let existing_balance = bag::borrow_mut<TypeName, Balance<T>>(
        &mut registry.balances,
        coin_type,
    );
    balance::split(existing_balance, amount)
}

// ===== Public Functions =====

/// Lock coins for a specified duration
public fun lock_coins<T>(
    registry: &mut LockerRegistry,
    coin: Coin<T>,
    lock_duration: u64,
    clock: &Clock,
    ctx: &mut TxContext,
): LockCertificate {
    assert!(!registry.paused, E_CONTRACT_PAUSED);
    assert!(lock_duration >= MIN_LOCK_DURATION, E_INVALID_DURATION);
    assert!(lock_duration <= MAX_LOCK_DURATION, E_INVALID_DURATION);

    let amount = coin::value(&coin);
    assert!(amount > 0, E_INVALID_AMOUNT);

    let owner = tx_context::sender(ctx);
    let current_time = clock::timestamp_ms(clock) / 1000;
    let unlock_time = current_time + lock_duration;
    let coin_type = type_name::get<T>();

    // Create lock record
    let lock = CoinLock<T> {
        id: object::new(ctx),
        owner,
        locked_coin: coin_type,
        locked_amount: amount,
        lock_ts: current_time,
        unlock_ts: unlock_time,
        claimed: false,
    };

    let lock_id = object::id(&lock);

    // Update registry
    if (!table::contains(&registry.total_locked, coin_type)) {
        table::add(&mut registry.total_locked, coin_type, 0);
    };
    let total = table::borrow_mut(&mut registry.total_locked, coin_type);
    *total = *total + amount;

    // Track user locks
    if (!table::contains(&registry.user_locks, owner)) {
        let mut lock_details: Table<ID, LockDetail> = table::new(ctx);
        let detail = LockDetail {
            amount,
            lock_ts: current_time,
            unlock_ts: unlock_time,
        };
        table::add(&mut lock_details, lock_id, detail);
        let mut details_list = vector::empty<LockDetail>();
        vector::push_back(&mut details_list, detail);
        let user_info = UserLockInfo {
            total_locked_amount: amount,
            lock_details,
            details_list,
        };
        table::add(&mut registry.user_locks, owner, user_info);
    } else {
        let user_info = table::borrow_mut(&mut registry.user_locks, owner);
        user_info.total_locked_amount = user_info.total_locked_amount + amount;
        let detail = LockDetail {
            amount,
            lock_ts: current_time,
            unlock_ts: unlock_time,
        };
        table::add(&mut user_info.lock_details, lock_id, detail);
        vector::push_back(&mut user_info.details_list, detail);
    };

    add_balance(registry, coin);

    let certificate = LockCertificate {
        id: object::new(ctx),
        lock_id,
        coin_type,
        owner,
        amount,
        unlock_ts: unlock_time,
    };

    // Emit event
    event::emit(CoinLockedEvent {
        lock_id,
        owner,
        coin_type,
        amount,
        lock_ts: current_time,
        unlock_ts: unlock_time,
    });

    transfer::share_object(lock);
    certificate
}

/// Unlock and claim coins after lock period
public fun unlock_coins<T>(
    registry: &mut LockerRegistry,
    lock: &mut CoinLock<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let current_time = clock::timestamp_ms(clock) / 1000;
    assert!(current_time >= lock.unlock_ts, E_STILL_LOCKED);
    assert!(lock.owner == tx_context::sender(ctx), E_NOT_OWNER);
    assert!(!lock.claimed, E_ALREADY_CLAIMED);

    // Mark as claimed
    lock.claimed = true;

    // Update total locked
    let coin_type = type_name::get<T>();
    let total = table::borrow_mut(&mut registry.total_locked, coin_type);
    *total = *total - lock.locked_amount;

    // Remove from user locks
    let user_info = table::borrow_mut(&mut registry.user_locks, lock.owner);
    user_info.total_locked_amount = user_info.total_locked_amount - lock.locked_amount;
    if (table::contains(&user_info.lock_details, object::id(lock))) {
        let detail = table::remove(&mut user_info.lock_details, object::id(lock));
        // Remove corresponding detail from details_list
        let len = vector::length(&user_info.details_list);
        let mut i = 0u64;
        while (i < len) {
            let d = vector::borrow(&user_info.details_list, i);
            if (
                d.lock_ts == detail.lock_ts && d.unlock_ts == detail.unlock_ts && d.amount == detail.amount
            ) {
                vector::swap_remove(&mut user_info.details_list, i);
                break
            };
            i = i + 1;
        };
        // detail has drop ability, no need to explicitly destroy
    };

    let unlocked_coin = coin::from_balance(
        remove_balance<T>(registry, coin_type, lock.locked_amount),
        ctx,
    );
    transfer::public_transfer(unlocked_coin, lock.owner);

    // Emit event
    event::emit(CoinUnlockedEvent {
        lock_id: object::id(lock),
        owner: lock.owner,
        coin_type,
        amount: lock.locked_amount,
        unlock_ts: lock.unlock_ts,
    });
}

// ===== View Functions =====

/// Query all lock details for a specific user
public struct UserLocksViewEvent has copy, drop {
    user: address,
    lock_ids: vector<ID>,
    amounts: vector<u64>,
    lock_tss: vector<u64>,
    unlock_tss: vector<u64>,
}

public fun emit_user_locks_view(registry: &LockerRegistry, user: address) {
    if (!table::contains(&registry.user_locks, user)) {
        event::emit(UserLocksViewEvent {
            user,
            lock_ids: vector::empty<ID>(),
            amounts: vector::empty<u64>(),
            lock_tss: vector::empty<u64>(),
            unlock_tss: vector::empty<u64>(),
        });
        return
    };
    let user_info = table::borrow(&registry.user_locks, user);
    let mut amounts = vector::empty<u64>();
    let mut lock_tss = vector::empty<u64>();
    let mut unlock_tss = vector::empty<u64>();
    let len = vector::length(&user_info.details_list);
    let mut i = 0u64;
    while (i < len) {
        let detail = vector::borrow(&user_info.details_list, i);
        vector::push_back(&mut amounts, detail.amount);
        vector::push_back(&mut lock_tss, detail.lock_ts);
        vector::push_back(&mut unlock_tss, detail.unlock_ts);
        i = i + 1;
    };
    event::emit(UserLocksViewEvent {
        user,
        lock_ids: vector::empty<ID>(), // Can be extended if lock_id is needed
        amounts,
        lock_tss,
        unlock_tss,
    });
}

/// Get lock details
public fun get_lock_info<T>(lock: &CoinLock<T>): (address, u64, u64, u64, bool) {
    (lock.owner, lock.locked_amount, lock.lock_ts, lock.unlock_ts, lock.claimed)
}

/// Check if lock can be claimed
public fun can_unlock<T>(lock: &CoinLock<T>, clock: &Clock): bool {
    let current_time = clock::timestamp_ms(clock) / 1000;
    current_time >= lock.unlock_ts && !lock.claimed
}

/// Get total locked amount for a coin type
public fun get_total_locked(registry: &LockerRegistry, coin_type: TypeName): u64 {
    if (table::contains(&registry.total_locked, coin_type)) {
        *table::borrow(&registry.total_locked, coin_type)
    } else {
        0
    }
}

// ===== Admin Functions =====

/// Pause/unpause contract
public fun set_paused(registry: &mut LockerRegistry, paused: bool, ctx: &mut TxContext) {
    assert!(tx_context::sender(ctx) == registry.admin, E_NOT_OWNER);
    registry.paused = paused;
}

/// Transfer admin rights
public fun transfer_admin(registry: &mut LockerRegistry, new_admin: address, ctx: &mut TxContext) {
    assert!(tx_context::sender(ctx) == registry.admin, E_NOT_OWNER);
    registry.admin = new_admin;
}

// ===== Certificate Functions =====

/// Transfer lock certificate (transfers lock ownership)
public fun transfer_certificate(cert: LockCertificate, recipient: address) {
    transfer::public_transfer(cert, recipient);
}

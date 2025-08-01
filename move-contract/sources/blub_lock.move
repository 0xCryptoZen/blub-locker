module blub_lock::coin_locker;

use std::type_name::{Self, TypeName};
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

// ===== Constants =====
const MIN_LOCK_DURATION: u64 = 86400; // 1 day in seconds
const MAX_LOCK_DURATION: u64 = 31536000; // 365 days in seconds

// ===== Structs =====

/// 单个锁仓详情
public struct LockDetail has copy, drop, store {
    amount: u64,
    lock_timestamp: u64,
    unlock_timestamp: u64,
}

/// 用户锁仓信息
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
    paused: bool,
    admin: address,
}

/// Individual lock record
public struct CoinLock<phantom T> has key, store {
    id: UID,
    owner: address,
    locked_coin: Coin<T>,
    locked_amount: u64,
    lock_timestamp: u64,
    unlock_timestamp: u64,
    claimed: bool,
}

/// Lock certificate (transferable)
public struct LockCertificate has key, store {
    id: UID,
    lock_id: ID,
    coin_type: TypeName,
    owner: address,
    amount: u64,
    unlock_timestamp: u64,
}

// ===== Events =====

public struct CoinLockedEvent has copy, drop {
    lock_id: ID,
    owner: address,
    coin_type: TypeName,
    amount: u64,
    lock_timestamp: u64,
    unlock_timestamp: u64,
}

public struct CoinUnlockedEvent has copy, drop {
    lock_id: ID,
    owner: address,
    coin_type: TypeName,
    amount: u64,
    unlock_timestamp: u64,
}

// ===== Initialize =====

fun init(ctx: &mut TxContext) {
    let registry = LockerRegistry {
        id: object::new(ctx),
        total_locked: table::new(ctx),
        user_locks: table::new(ctx),
        paused: false,
        admin: tx_context::sender(ctx),
    };
    transfer::share_object(registry);
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
        locked_coin: coin,
        locked_amount: amount,
        lock_timestamp: current_time,
        unlock_timestamp: unlock_time,
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
            lock_timestamp: current_time,
            unlock_timestamp: unlock_time,
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
            lock_timestamp: current_time,
            unlock_timestamp: unlock_time,
        };
        table::add(&mut user_info.lock_details, lock_id, detail);
        vector::push_back(&mut user_info.details_list, detail);
    };
    let certificate = LockCertificate {
        id: object::new(ctx),
        lock_id,
        coin_type,
        owner,
        amount,
        unlock_timestamp: unlock_time,
    };

    // Emit event
    event::emit(CoinLockedEvent {
        lock_id,
        owner,
        coin_type,
        amount,
        lock_timestamp: current_time,
        unlock_timestamp: unlock_time,
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
    assert!(current_time >= lock.unlock_timestamp, E_STILL_LOCKED);
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
        // 从details_list中移除对应的detail
        let len = vector::length(&user_info.details_list);
        let mut i = 0u64;
        while (i < len) {
            let d = vector::borrow(&user_info.details_list, i);
            if (
                d.lock_timestamp == detail.lock_timestamp && d.unlock_timestamp == detail.unlock_timestamp && d.amount == detail.amount
            ) {
                vector::swap_remove(&mut user_info.details_list, i);
                break
            };
            i = i + 1;
        };
        // detail has drop ability, no need to explicitly destroy
    };
    let unlocked_coin = coin::split(&mut lock.locked_coin, lock.locked_amount, ctx);
    transfer::public_transfer(unlocked_coin, lock.owner);

    // Emit event
    event::emit(CoinUnlockedEvent {
        lock_id: object::id(lock),
        owner: lock.owner,
        coin_type,
        amount: lock.locked_amount,
        unlock_timestamp: lock.unlock_timestamp,
    });
}

// ===== View Functions =====

/// 查询某个用户所有锁仓详情
public struct UserLocksViewEvent has copy, drop {
    user: address,
    lock_ids: vector<ID>,
    amounts: vector<u64>,
    lock_timestamps: vector<u64>,
    unlock_timestamps: vector<u64>,
}

public fun emit_user_locks_view(registry: &LockerRegistry, user: address) {
    if (!table::contains(&registry.user_locks, user)) {
        event::emit(UserLocksViewEvent {
            user,
            lock_ids: vector::empty<ID>(),
            amounts: vector::empty<u64>(),
            lock_timestamps: vector::empty<u64>(),
            unlock_timestamps: vector::empty<u64>(),
        });
        return
    };
    let user_info = table::borrow(&registry.user_locks, user);
    let mut amounts = vector::empty<u64>();
    let mut lock_timestamps = vector::empty<u64>();
    let mut unlock_timestamps = vector::empty<u64>();
    let len = vector::length(&user_info.details_list);
    let mut i = 0u64;
    while (i < len) {
        let detail = vector::borrow(&user_info.details_list, i);
        vector::push_back(&mut amounts, detail.amount);
        vector::push_back(&mut lock_timestamps, detail.lock_timestamp);
        vector::push_back(&mut unlock_timestamps, detail.unlock_timestamp);
        i = i + 1;
    };
    event::emit(UserLocksViewEvent {
        user,
        lock_ids: vector::empty<ID>(), // 如需lock_id可扩展
        amounts,
        lock_timestamps,
        unlock_timestamps,
    });
}

/// Get lock details
public fun get_lock_info<T>(lock: &CoinLock<T>): (address, u64, u64, u64, bool) {
    (lock.owner, lock.locked_amount, lock.lock_timestamp, lock.unlock_timestamp, lock.claimed)
}

/// Check if lock can be claimed
public fun can_unlock<T>(lock: &CoinLock<T>, clock: &Clock): bool {
    let current_time = clock::timestamp_ms(clock) / 1000;
    current_time >= lock.unlock_timestamp && !lock.claimed
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

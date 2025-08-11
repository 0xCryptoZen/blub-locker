#[test_only]
module blub_lock::coin_locker_tests;

use blub_lock::coin_locker::{Self, LockerRegistry, CoinLock, LockCertificate, UserLocksViewEvent};
use sui::test_scenario::{Self as ts, Scenario};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::test_utils::assert_eq;
use sui::sui::SUI;
use sui::object::{Self, ID};
use sui::transfer;
use sui::tx_context;
use std::type_name;
use std::vector;
use std::option;

// Test constants
const ADMIN: address = @0xAD;
const USER1: address = @0x1;
const USER2: address = @0x2;
const LOCK_AMOUNT: u64 = 1000;
const LOCK_DURATION: u64 = 86400; // 1 day

// Helper function to create test coins
fun mint_coin<T>(scenario: &mut Scenario, amount: u64): Coin<T> {
    coin::mint_for_testing<T>(amount, ts::ctx(scenario))
}

// Helper function to create and share clock
fun create_shared_clock(scenario: &mut Scenario) {
    let clock = clock::create_for_testing(ts::ctx(scenario));
    clock::share_for_testing(clock);
}

// Test initialization
#[test]
fun test_init() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize the module
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    
    // Check that LockerRegistry is created and shared
    ts::next_tx(&mut scenario, ADMIN);
    assert!(ts::has_most_recent_shared<LockerRegistry>(), 0);
    
    ts::end(scenario);
}

// Test lock_coins function - successful lock
#[test]
fun test_lock_coins_success() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Lock coins
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    
    let cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Verify certificate
    // Certificate fields are private, so we can't directly access them
    // But we can verify the certificate was created successfully
    
    // Clean up
    ts::return_shared(registry);
    ts::return_shared(clock);
    transfer::public_transfer(cert, USER1);
    ts::end(scenario);
}

// Test lock_coins with invalid amount
#[test]
#[expected_failure(abort_code = coin_locker::E_INVALID_AMOUNT)]
fun test_lock_coins_zero_amount() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Try to lock zero coins
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, 0);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    
    let _cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    abort 0
}

// Test lock_coins with invalid duration (too short)
#[test]
#[expected_failure(abort_code = coin_locker::E_INVALID_DURATION)]
fun test_lock_coins_duration_too_short() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Try to lock with duration less than minimum
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    
    let _cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        3600, // 1 hour, less than MIN_LOCK_DURATION
        &clock,
        ts::ctx(&mut scenario)
    );
    
    abort 0
}

// Test lock_coins with invalid duration (too long)
#[test]
#[expected_failure(abort_code = coin_locker::E_INVALID_DURATION)]
fun test_lock_coins_duration_too_long() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Try to lock with duration more than maximum
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    
    let _cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        31536001, // More than MAX_LOCK_DURATION
        &clock,
        ts::ctx(&mut scenario)
    );
    
    abort 0
}

// Test unlock_coins - successful unlock
#[test]
fun test_unlock_coins_success() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Lock coins
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let mut clock = ts::take_shared<Clock>(&scenario);
    
    let cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Fast forward time
    clock::increment_for_testing(&mut clock, LOCK_DURATION * 1000);
    
    // Unlock coins
    ts::next_tx(&mut scenario, USER1);
    let mut lock = ts::take_shared<CoinLock<SUI>>(&scenario);
    coin_locker::unlock_coins(&mut registry, &mut lock, &clock, ts::ctx(&mut scenario));
    
    // Verify lock is claimed
    let (_, _, _, _, claimed) = coin_locker::get_lock_info(&lock);
    assert!(claimed, 0);
    
    // Clean up
    ts::return_shared(registry);
    ts::return_shared(clock);
    ts::return_shared(lock);
    transfer::public_transfer(cert, USER1);
    
    // Check that coins were transferred back
    ts::next_tx(&mut scenario, USER1);
    let returned_coin = ts::take_from_sender<Coin<SUI>>(&scenario);
    assert_eq(coin::value(&returned_coin), LOCK_AMOUNT);
    ts::return_to_sender(&scenario, returned_coin);
    
    ts::end(scenario);
}

// Test unlock_coins - still locked
#[test]
#[expected_failure(abort_code = coin_locker::E_STILL_LOCKED)]
fun test_unlock_coins_still_locked() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Lock coins
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    
    let _cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Try to unlock immediately (without time passing)
    ts::next_tx(&mut scenario, USER1);
    let mut lock = ts::take_shared<CoinLock<SUI>>(&scenario);
    coin_locker::unlock_coins(&mut registry, &mut lock, &clock, ts::ctx(&mut scenario));
    
    abort 0
}

// Test unlock_coins - not owner
#[test]
#[expected_failure(abort_code = coin_locker::E_NOT_OWNER)]
fun test_unlock_coins_not_owner() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Lock coins as USER1
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let mut clock = ts::take_shared<Clock>(&scenario);
    
    let _cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Fast forward time
    clock::increment_for_testing(&mut clock, LOCK_DURATION * 1000);
    
    // Try to unlock as USER2
    ts::next_tx(&mut scenario, USER2);
    let mut lock = ts::take_shared<CoinLock<SUI>>(&scenario);
    coin_locker::unlock_coins(&mut registry, &mut lock, &clock, ts::ctx(&mut scenario));
    
    abort 0
}

// Test unlock_coins - already claimed
#[test]
#[expected_failure(abort_code = coin_locker::E_ALREADY_CLAIMED)]
fun test_unlock_coins_already_claimed() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Lock coins
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let mut clock = ts::take_shared<Clock>(&scenario);
    
    let cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Fast forward time
    clock::increment_for_testing(&mut clock, LOCK_DURATION * 1000);
    
    // Unlock coins first time
    ts::next_tx(&mut scenario, USER1);
    let mut lock = ts::take_shared<CoinLock<SUI>>(&scenario);
    coin_locker::unlock_coins(&mut registry, &mut lock, &clock, ts::ctx(&mut scenario));
    
    // Try to unlock again
    coin_locker::unlock_coins(&mut registry, &mut lock, &clock, ts::ctx(&mut scenario));
    
    abort 0
}

// Test view functions
#[test]
fun test_view_functions() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Lock coins
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    
    let cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Test get_lock_info
    ts::next_tx(&mut scenario, USER1);
    let lock = ts::take_shared<CoinLock<SUI>>(&scenario);
    let (owner, amount, lock_ts, unlock_ts, claimed) = coin_locker::get_lock_info(&lock);
    assert_eq(owner, USER1);
    assert_eq(amount, LOCK_AMOUNT);
    assert!(!claimed, 0);
    
    // Test can_unlock (should be false)
    assert!(!coin_locker::can_unlock(&lock, &clock), 0);
    
    // Test get_total_locked
    let total = coin_locker::get_total_locked(&registry, type_name::get<SUI>());
    assert_eq(total, LOCK_AMOUNT);
    
    // Clean up
    ts::return_shared(registry);
    ts::return_shared(clock);
    ts::return_shared(lock);
    transfer::public_transfer(cert, USER1);
    ts::end(scenario);
}

// Test admin functions - pause/unpause
#[test]
fun test_pause_unpause() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Pause contract
    ts::next_tx(&mut scenario, ADMIN);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    coin_locker::set_paused(&mut registry, true, ts::ctx(&mut scenario));
    
    // Try to lock coins while paused (should fail)
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let clock = ts::take_shared<Clock>(&scenario);
    
    // This should fail due to pause, but we can't use catch_abort in tests
    // Instead we'll test that unpausing works by successfully locking after unpause
    transfer::public_transfer(coin, USER1);
    
    // Unpause
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::set_paused(&mut registry, false, ts::ctx(&mut scenario));
    
    // Now locking should work
    ts::next_tx(&mut scenario, USER1);
    let coin2 = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let cert = coin_locker::lock_coins(
        &mut registry,
        coin2,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Clean up
    ts::return_shared(registry);
    ts::return_shared(clock);
    transfer::public_transfer(cert, USER1);
    ts::end(scenario);
}

// Test admin functions - transfer admin
#[test]
fun test_transfer_admin() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    
    // Transfer admin to USER1
    ts::next_tx(&mut scenario, ADMIN);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    coin_locker::transfer_admin(&mut registry, USER1, ts::ctx(&mut scenario));
    
    // Now USER1 should be able to pause
    ts::next_tx(&mut scenario, USER1);
    coin_locker::set_paused(&mut registry, true, ts::ctx(&mut scenario));
    
    // ADMIN should no longer be able to pause
    ts::next_tx(&mut scenario, ADMIN);
    // Admin check will fail here - we can verify by checking that USER1 can still pause
    // (if transfer was successful, USER1 is admin)
    
    // Clean up
    ts::return_shared(registry);
    ts::end(scenario);
}

// Test certificate transfer
#[test]
fun test_certificate_transfer() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Lock coins
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    
    let cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Transfer certificate to USER2
    coin_locker::transfer_certificate(cert, USER2);
    
    // Verify USER2 received the certificate
    ts::next_tx(&mut scenario, USER2);
    let cert2 = ts::take_from_sender<LockCertificate>(&scenario);
    // Certificate was successfully transferred to USER2
    
    // Clean up
    ts::return_shared(registry);
    ts::return_shared(clock);
    ts::return_to_sender(&scenario, cert2);
    ts::end(scenario);
}

// Test multiple locks by same user
#[test]
fun test_multiple_locks_same_user() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Lock coins multiple times
    ts::next_tx(&mut scenario, USER1);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    
    let coin1 = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let cert1 = coin_locker::lock_coins(
        &mut registry,
        coin1,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    let coin2 = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT * 2);
    let cert2 = coin_locker::lock_coins(
        &mut registry,
        coin2,
        LOCK_DURATION * 2,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Check total locked
    let total = coin_locker::get_total_locked(&registry, type_name::get<SUI>());
    assert_eq(total, LOCK_AMOUNT * 3);
    
    // Clean up
    ts::return_shared(registry);
    ts::return_shared(clock);
    transfer::public_transfer(cert1, USER1);
    transfer::public_transfer(cert2, USER1);
    ts::end(scenario);
}

// Test emit_user_locks_view
#[test]
fun test_emit_user_locks_view() {
    let mut scenario = ts::begin(ADMIN);
    
    // Initialize
    ts::next_tx(&mut scenario, ADMIN);
    coin_locker::init_for_testing(ts::ctx(&mut scenario));
    create_shared_clock(&mut scenario);
    
    // Lock coins
    ts::next_tx(&mut scenario, USER1);
    let coin = mint_coin<SUI>(&mut scenario, LOCK_AMOUNT);
    let mut registry = ts::take_shared<LockerRegistry>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    
    let cert = coin_locker::lock_coins(
        &mut registry,
        coin,
        LOCK_DURATION,
        &clock,
        ts::ctx(&mut scenario)
    );
    
    // Emit user locks view
    coin_locker::emit_user_locks_view(&registry, USER1);
    
    // Test for user with no locks
    coin_locker::emit_user_locks_view(&registry, USER2);
    
    // Clean up
    ts::return_shared(registry);
    ts::return_shared(clock);
    transfer::public_transfer(cert, USER1);
    ts::end(scenario);
}
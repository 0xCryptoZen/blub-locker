#! /bin/bash

# 1. build
cd ../move-contracts/test-coin
sui move build --skip-fetch-latest-git-deps

# 2. publish
sui client publish --skip-fetch-latest-git-deps


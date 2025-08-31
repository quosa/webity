#! /bin/bash

# SEE: https://ziggit.dev/t/using-kcov-with-zig-test/3421/5
rm -rf coverage/* || mkdir coverage
# zig test --test-no-exec -femit-bin=game_core_test src/core/game_core_test.zig
# ./game_core_test
# # kcov --clean --include-pattern='src/core/*.zig' coverage ./game_core_test
# # kcov --clean --include-pattern="src/core/*.zig" coverage ./game_core_test
# # kcov --clean --include-pattern="src/core/game_core.zig" coverage ./game_core_test
# kcov --clean --include-pattern=src/core coverage ./game_core_test
# open coverage/index.html

mkdir -p coverage/game_core_test
mkdir -p coverage/game_engine_test

zig test --test-no-exec -femit-bin=game_core_test src/core/game_core_test.zig
zig test --test-no-exec -femit-bin=game_engine_test src/core/game_engine_test.zig

kcov --include-pattern=src/core/game_core.zig coverage/game_core_test ./game_core_test
kcov --include-pattern=src/core/game_engine.zig coverage/game_engine_test ./game_engine_test
kcov --merge coverage coverage/game_core_test coverage/game_engine_test

open coverage/index.html



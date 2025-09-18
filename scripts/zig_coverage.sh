#! /bin/bash

# SEE: https://ziggit.dev/t/using-kcov-with-zig-test/3421/5
rm -fr game_*_test*
rm -rf coverage/*

mkdir -p coverage

# Find all Zig test files
TEST_FILES=()
while IFS= read -r -d $'\0' file; do
	TEST_FILES+=("$file")
done < <(find src/core -type f -name "*_test.zig" -print0)

KCOV_DIRS=()
for FILE in "${TEST_FILES[@]}"; do
	BASENAME=$(basename "$FILE" .zig)
	BIN_NAME="${BASENAME}"
	OUT_DIR="coverage/${BIN_NAME}"
	mkdir -p "$OUT_DIR"
	zig test --test-no-exec -femit-bin="$BIN_NAME" "$FILE"
	# Use kcov for coverage
	kcov --include-pattern=src/core "${OUT_DIR}" "./${BIN_NAME}"
	KCOV_DIRS+=("${OUT_DIR}")
done

# Merge all coverage results
kcov --merge coverage "${KCOV_DIRS[@]}"

open coverage/index.html
rm -fr game_*_test*

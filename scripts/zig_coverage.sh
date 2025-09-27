#! /bin/bash

rm -fr game_*_test*
rm -rf coverage/*

mkdir -p coverage

# Find all Zig test files
TEST_FILES=()
while IFS= read -r -d $'\0' file; do
    TEST_FILES+=("$file")
done < <(find src/core -type f -name "*_test.zig" -print0)

KCOV_DIRS=()
BIN_NAMES=()
KCOV_RESULTS=()

for FILE in "${TEST_FILES[@]}"; do
    echo "=== Running coverage for $FILE =================================================="

    BASENAME=$(basename "$FILE" .zig)
    BIN_NAME="${BASENAME}"
    OUT_DIR="coverage/${BIN_NAME}"
    mkdir -p "$OUT_DIR"
    zig test --test-no-exec -femit-bin="$BIN_NAME" "$FILE"
    kcov --include-pattern=src/core "${OUT_DIR}" "./${BIN_NAME}"
    KCOV_RESULT=$?
    KCOV_RESULTS+=("$KCOV_RESULT")
    BIN_NAMES+=("$BIN_NAME")
    KCOV_DIRS+=("${OUT_DIR}")
done

# Merge all coverage results
kcov --merge coverage "${KCOV_DIRS[@]}"

open coverage/index.html

# Remove all test binaries and debug info
for BIN in "${BIN_NAMES[@]}"; do
    rm -f "$BIN"
    rm -f "${BIN}.dbg"
done

# Print summary
echo ""
echo "==== KCOV Test Results ===="
for i in "${!TEST_FILES[@]}"; do
    FILE="${TEST_FILES[$i]}"
    RESULT="${KCOV_RESULTS[$i]}"
    if [ "$RESULT" -eq 0 ]; then
        echo -e "✅ $(basename "$FILE")"
    else
        echo -e "❌ $(basename "$FILE")"
    fi
done

rm -fr game_*_test*

#!/bin/bash
# Run all Zig test files, report results, and exit non-zero if any fail

set -o pipefail

TEST_DIR="src/core"
TEST_PATTERN="*_test.zig"
PASS=0
FAIL=0
FAILED_FILES=()
ALL_FILES=()


# Find all Zig test files in src/core
TEST_FILES=()
while IFS= read -r -d $'\0' file; do
  TEST_FILES+=("$file")
done < <(find "$TEST_DIR" -type f -name "$TEST_PATTERN" -print0)

if [ ${#TEST_FILES[@]} -eq 0 ]; then
  echo "No Zig test files found in $TEST_DIR matching $TEST_PATTERN."
  exit 0
fi

for FILE in "${TEST_FILES[@]}"; do
  ALL_FILES+=("$FILE")
  zig test "$FILE"
  RESULT=$?
  if [ $RESULT -eq 0 ]; then
    FILE_RESULTS+=("\033[32m✓\033[0m $FILE")
    PASS=$((PASS+1))
  else
    FILE_RESULTS+=("\033[31m❌\033[0m $FILE")
    FAIL=$((FAIL+1))
    FAILED_FILES+=("$FILE")
  fi
done

# Summary
echo ""
echo "Test Summary:"
for RESULT in "${FILE_RESULTS[@]}"; do
  echo -e "$RESULT"
done
echo ""
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Total: $((PASS+FAIL))"

if [ $FAIL -ne 0 ]; then
  echo "Failed files:"
  for F in "${FAILED_FILES[@]}"; do
    echo "  $F"
  done
  exit 1
else
  exit 0
fi

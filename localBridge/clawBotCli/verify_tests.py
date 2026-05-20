#!/usr/bin/env python3
"""Verify all test files for API compatibility issues."""
import ast
import os
from pathlib import Path

def check_file(filepath):
    """Check a Python file for API compatibility issues."""
    issues = []

    with open(filepath, 'r') as f:
        content = f.read()

    # Check for incorrect tab API calls
    if 'client.x.tabs.open_tab' in content:
        issues.append(f"  ❌ Uses open_tab() instead of open()")
    if 'client.x.tabs.navigate_tab' in content:
        issues.append(f"  ❌ Uses navigate_tab() instead of navigate()")
    if 'client.x.tabs.close_tab' in content:
        issues.append(f"  ❌ Uses close_tab() instead of close()")

    # Check for incorrect return type handling
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        # Check if checking .success on tabs.open() result
        if 'client.x.tabs.open' in line:
            # Look ahead for .success check
            for j in range(i, min(i+10, len(lines))):
                if 'result.success' in lines[j] and 'open' in lines[i-1:j]:
                    issues.append(f"  ❌ Line {j+1}: Checks .success on XTab (should check .tab_id)")
                    break

    return issues

def main():
    test_dir = Path('tests')
    all_issues = {}

    for test_file in test_dir.rglob('test_*.py'):
        if test_file.name == 'test_media_upload.py':
            continue  # Skip unittest files

        issues = check_file(test_file)
        if issues:
            all_issues[str(test_file)] = issues

    if all_issues:
        print("Found API compatibility issues:\n")
        for filepath, issues in all_issues.items():
            print(f"📄 {filepath}")
            for issue in issues:
                print(issue)
            print()
        return 1
    else:
        print("✅ All test files look good!")
        return 0

if __name__ == '__main__':
    exit(main())

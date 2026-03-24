#!/usr/bin/env python3
"""
Test All APIs - Main Test Runner
"""
import sys
import subprocess


def run_test(script_name):
    """Run a test script and return success status"""
    print(f"\n{'='*60}")
    print(f"Running: {script_name}")
    print('='*60)

    try:
        result = subprocess.run(
            ['python3', f'tests/{script_name}'],
            capture_output=False,
            text=True
        )
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Error running {script_name}: {e}")
        return False


def main():
    print("\n🚀 ClawBot CLI - Complete API Test Suite")
    print("="*60)
    print("Testing LocalBridge REST API with AI-Oriented Architecture")
    print("="*60)

    test_scripts = [
        'test_status.py',
        'test_read_apis.py',
        'test_tab_control.py',
        # 'test_write_apis.py',  # Commented out - performs real actions
    ]

    results = []
    for script in test_scripts:
        passed = run_test(script)
        results.append((script, passed))

    # Summary
    print("\n" + "="*60)
    print("FINAL TEST SUMMARY")
    print("="*60)

    for script, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {script}")

    total = len(results)
    passed_count = sum(1 for _, p in results if p)

    print(f"\nTotal: {passed_count}/{total} test suites passed")

    if passed_count == total:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed_count} test suite(s) failed")
        sys.exit(1)


if __name__ == "__main__":
    main()

"""
Converts a pytest-json-report JSON file to a minimal Jest-compatible results file.

Usage:
    python convert-pytest-to-jest.py <pytest-report.json> <output-results.json>

The output file uses the same shape that generate-test-summary.js expects:
    { "success": bool, "numPassedTests": int, "numFailedTests": int,
      "numPendingTests": int, "testResults": [] }
"""

import json
import sys


def convert(report_path: str, output_path: str) -> None:
    with open(report_path) as f:
        report = json.load(f)

    summary = report.get("summary", {})
    num_failed = summary.get("failed", 0) + summary.get("error", 0)
    result = {
        "success": num_failed == 0,
        "numPassedTests": summary.get("passed", 0),
        "numFailedTests": num_failed,
        "numPendingTests": summary.get("skipped", 0),
        "testResults": [],
    }

    with open(output_path, "w") as f:
        json.dump(result, f)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <pytest-report.json> <output-results.json>", file=sys.stderr)
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])

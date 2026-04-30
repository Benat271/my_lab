from __future__ import annotations

import json
import os
import pathlib
import sys
from typing import Any


def build_markdown(report: dict[str, Any]) -> str:
    summary = report.get("summary", {})
    collectors = report.get("collectors", [])
    tests = report.get("tests", [])

    lines: list[str] = []
    lines.append("# Pytest detailed report")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Collected: {summary.get('collected', 0)}")
    lines.append(f"- Passed: {summary.get('passed', 0)}")
    lines.append(f"- Failed: {summary.get('failed', 0)}")
    lines.append(f"- Skipped: {summary.get('skipped', 0)}")
    lines.append(f"- Duration: {summary.get('total', 0):.3f}s")
    lines.append("")

    if collectors:
        lines.append("## Collected suites")
        lines.append("")
        for collector in collectors:
            outcome = collector.get("outcome", "unknown")
            nodeid = collector.get("nodeid", "unknown")
            lines.append(f"- `{nodeid}`: {outcome}")
        lines.append("")

    lines.append("## Test cases")
    lines.append("")
    lines.append("| Test | Outcome | Duration (s) | Detail |")
    lines.append("| --- | --- | ---: | --- |")
    for test in tests:
        nodeid = test.get("nodeid", "unknown")
        outcome = test.get("outcome", "unknown")
        duration = test.get("call", {}).get("duration", 0)
        detail = "-"
        if outcome == "failed":
            detail = (test.get("call", {}).get("crash", {}).get("message") or "").replace("\n", " ")
        elif outcome == "skipped":
            detail = (test.get("setup", {}).get("longrepr") or "Skipped").replace("\n", " ")
        lines.append(f"| `{nodeid}` | {outcome} | {duration:.3f} | {detail or '-'} |")
    lines.append("")

    failed_tests = [test for test in tests if test.get("outcome") == "failed"]
    if failed_tests:
        lines.append("## Failures")
        lines.append("")
        for test in failed_tests:
            lines.append(f"### `{test.get('nodeid', 'unknown')}`")
            lines.append("")
            crash = test.get("call", {}).get("crash", {})
            message = crash.get("message") or "No message"
            lines.append("```text")
            lines.append(message)
            lines.append("```")
            lines.append("")

    return "\n".join(lines)


def append_summary(report: dict[str, Any], report_dir: pathlib.Path) -> None:
    out_path = os.getenv("GITHUB_STEP_SUMMARY")
    if not out_path:
        return

    summary = report.get("summary", {})
    with open(out_path, "a", encoding="utf-8") as handle:
        handle.write("## Backend unit tests\n\n")
        handle.write(
            f"- **Collected**: {summary.get('collected', 0)}\n"
            f"- **Passed**: {summary.get('passed', 0)}\n"
            f"- **Failed**: {summary.get('failed', 0)}\n"
            f"- **Skipped**: {summary.get('skipped', 0)}\n"
        )
        handle.write(f"\nDetailed artifact: `{report_dir.as_posix()}/detailed-report.md`\n\n")


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: python scripts/pytest-summary.py <pytest-report.json> <output-dir>", file=sys.stderr)
        return 2

    report_path = pathlib.Path(sys.argv[1])
    output_dir = pathlib.Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    if not report_path.exists():
        fallback = "# Pytest detailed report\n\nNo pytest JSON report was generated.\n"
        (output_dir / "detailed-report.md").write_text(fallback, encoding="utf-8")
        (output_dir / "summary.json").write_text(json.dumps({"error": "missing pytest report"}, indent=2), encoding="utf-8")
        print(fallback)
        return 0

    report = json.loads(report_path.read_text(encoding="utf-8"))
    markdown = build_markdown(report)

    (output_dir / "detailed-report.md").write_text(markdown, encoding="utf-8")
    (output_dir / "summary.json").write_text(json.dumps(report.get("summary", {}), indent=2), encoding="utf-8")
    (output_dir / "pytest-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(markdown)
    append_summary(report, output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

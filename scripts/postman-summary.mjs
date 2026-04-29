import fs from "node:fs";

function apiFromItemName(itemName) {
  if (!itemName) return "Unknown";
  if (itemName.toLowerCase().includes("login")) return "Auth API";
  if (itemName.toLowerCase().includes("senior")) return "Senior API";
  const prefix = itemName.split(" - ")[0]?.trim();
  if (prefix && ["C", "R", "U", "D"].includes(prefix)) return "Senior API";
  if (prefix === "401") return "Senior API";
  return "Unknown";
}

function main() {
  const [reportPath] = process.argv.slice(2);
  if (!reportPath) {
    console.error("Usage: node scripts/postman-summary.mjs <newman-report.json>");
    process.exit(2);
  }

  const raw = fs.readFileSync(reportPath, "utf8");
  const report = JSON.parse(raw);

  const perApi = new Map();
  const executions = report?.run?.executions ?? [];
  for (const exec of executions) {
    const itemName = exec?.item?.name ?? "";
    const apiName = apiFromItemName(itemName);

    const assertions = exec?.assertions ?? [];
    const testsExecuted = assertions.length;
    const testsOk = assertions.filter((a) => !a.error).length;
    const testsNok = assertions.filter((a) => a.error).length;

    const current = perApi.get(apiName) ?? { testsExecuted: 0, testsOk: 0, testsNok: 0 };
    current.testsExecuted += testsExecuted;
    current.testsOk += testsOk;
    current.testsNok += testsNok;
    perApi.set(apiName, current);
  }

  const lines = [];
  lines.push("Postman API test summary");
  lines.push("");
  for (const [apiName, stats] of perApi.entries()) {
    lines.push(`${apiName}:`);
    lines.push(`- tests executed: ${stats.testsExecuted}`);
    lines.push(`- OK: ${stats.testsOk}`);
    lines.push(`- NOK: ${stats.testsNok}`);
    lines.push("");
  }

  const output = lines.join("\n").trimEnd() + "\n";
  console.log(output);

  const outPath = process.env.GITHUB_STEP_SUMMARY;
  if (outPath) {
    fs.appendFileSync(outPath, "## Postman API tests\n\n");
    for (const [apiName, stats] of perApi.entries()) {
      fs.appendFileSync(
        outPath,
        `- **${apiName}**: executed=${stats.testsExecuted}, OK=${stats.testsOk}, NOK=${stats.testsNok}\n`
      );
    }
    fs.appendFileSync(outPath, "\n");
  }
}

main();

import fs from "node:fs";
import path from "node:path";

function apiFromItemName(itemName) {
  if (!itemName) return "Unknown";
  if (itemName.toLowerCase().includes("login")) return "Auth API";
  if (itemName.toLowerCase().includes("senior")) return "Senior API";
  const prefix = itemName.split(" - ")[0]?.trim();
  if (prefix && ["C", "R", "U", "D", "401", "404", "409"].includes(prefix)) return "Senior API";
  return "Unknown";
}

function cleanUrl(urlValue) {
  if (!urlValue) return "";
  return String(urlValue)
    .replace(/:[^:@/]+@/g, ":***@")
    .replace(/([?&]password=)[^&]+/gi, "$1***");
}

function assertionStatus(assertion) {
  return assertion?.error ? "NOK" : "OK";
}

function buildReport(report) {
  const perApi = new Map();
  const executions = report?.run?.executions ?? [];

  for (const exec of executions) {
    const itemName = exec?.item?.name ?? "Unnamed request";
    const apiName = apiFromItemName(itemName);
    const request = exec?.request ?? {};
    const response = exec?.response ?? {};
    const assertions = exec?.assertions ?? [];
    const testsExecuted = assertions.length;
    const testsOk = assertions.filter((a) => !a.error).length;
    const testsNok = assertions.filter((a) => a.error).length;

    const api = perApi.get(apiName) ?? {
      testsExecuted: 0,
      testsOk: 0,
      testsNok: 0,
      requests: [],
    };

    api.testsExecuted += testsExecuted;
    api.testsOk += testsOk;
    api.testsNok += testsNok;
    api.requests.push({
      name: itemName,
      method: request.method ?? "UNKNOWN",
      url: cleanUrl(request.url?.toString?.() ?? request.url?.raw ?? ""),
      statusCode: response.code ?? "N/A",
      statusText: response.status ?? "",
      responseTimeMs: response.responseTime ?? null,
      testsExecuted,
      testsOk,
      testsNok,
      assertions: assertions.map((assertion) => ({
        name: assertion.assertion ?? "Unnamed assertion",
        status: assertionStatus(assertion),
        error: assertion.error?.message ?? "",
      })),
    });

    perApi.set(apiName, api);
  }

  return perApi;
}

function markdownForReport(perApi) {
  const lines = [];
  lines.push("# Postman detailed report");
  lines.push("");

  for (const [apiName, api] of perApi.entries()) {
    lines.push(`## ${apiName}`);
    lines.push("");
    lines.push(`- Tests executed: ${api.testsExecuted}`);
    lines.push(`- OK: ${api.testsOk}`);
    lines.push(`- NOK: ${api.testsNok}`);
    lines.push("");

    for (const request of api.requests) {
      lines.push(`### ${request.name}`);
      lines.push("");
      lines.push(`- Method: \`${request.method}\``);
      lines.push(`- URL: \`${request.url}\``);
      lines.push(`- HTTP: \`${request.statusCode} ${request.statusText}\``);
      lines.push(`- Response time: \`${request.responseTimeMs ?? "N/A"} ms\``);
      lines.push(`- Tests executed: ${request.testsExecuted}`);
      lines.push(`- OK: ${request.testsOk}`);
      lines.push(`- NOK: ${request.testsNok}`);
      lines.push("");

      if (request.assertions.length > 0) {
        lines.push("| Assertion | Result | Detail |");
        lines.push("| --- | --- | --- |");
        for (const assertion of request.assertions) {
          lines.push(
            `| ${assertion.name} | ${assertion.status} | ${assertion.error || "-"} |`
          );
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

function shortSummary(perApi) {
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
  return lines.join("\n").trimEnd() + "\n";
}

function main() {
  const [reportPath, outputDirArg] = process.argv.slice(2);
  if (!reportPath) {
    console.error("Usage: node scripts/postman-summary.mjs <newman-report.json> [output-dir]");
    process.exit(2);
  }

  const outputDir = outputDirArg || "postman-report";
  fs.mkdirSync(outputDir, { recursive: true });

  const raw = fs.readFileSync(reportPath, "utf8");
  const report = JSON.parse(raw);
  const perApi = buildReport(report);

  const summaryText = shortSummary(perApi);
  const detailMarkdown = markdownForReport(perApi);

  const summaryPath = path.join(outputDir, "summary.txt");
  const detailPath = path.join(outputDir, "detailed-report.md");
  const jsonPath = path.join(outputDir, "newman-report.json");

  fs.writeFileSync(summaryPath, summaryText);
  fs.writeFileSync(detailPath, detailMarkdown);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  console.log(summaryText);
  console.log(`Detailed report written to ${detailPath}`);

  const outPath = process.env.GITHUB_STEP_SUMMARY;
  if (outPath) {
    fs.appendFileSync(outPath, "## Postman API tests\n\n");
    for (const [apiName, stats] of perApi.entries()) {
      fs.appendFileSync(
        outPath,
        `- **${apiName}**: executed=${stats.testsExecuted}, OK=${stats.testsOk}, NOK=${stats.testsNok}\n`
      );
    }
    fs.appendFileSync(outPath, `\nDetailed artifact: \`postman-report/detailed-report.md\`\n\n`);
  }
}

main();

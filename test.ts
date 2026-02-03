import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import v8 from "v8";

require("isomorphic-fetch");

const getAverage = (arr) => arr.reduce((p, c) => p + c, 0) / arr.length;

const args = process.argv.slice(2);
const platform = args.find((a) => !a.startsWith("--"));
const showQueries = args.includes("--show-queries");
// const query = fs.readFileSync(path.resolve(__dirname, platform, 'query.graphql'), 'utf8')



const main = async () => {
  console.log("");

  let authHeader;
  let performQuery;
  if (platform === "payload") {
    authHeader = await getPayloadAuthHeader();

    // performQuery = async () => await performPayloadQuery(authHeader, query)

    performQuery = async () => await performPayloadRestQuery(authHeader);
  } else if (platform === "strapi") {
    authHeader = await getStrapiAuthHeader();

    // performQuery = async () => await performStrapiQuery(authHeader, query)

    performQuery = async () => await performStrapiRestQuery(authHeader);
  } else {
    throw new Error(`Unknown platform: ${platform}`);
  }

  // Mode: show SQL queries cho 1 request
  if (showQueries) {
    const db = platform === "payload" ? "payload" : "strapi";
    const tag = platform.toUpperCase();
    const uid = Date.now().toString(36);
    const startMarker = `${tag}_START_${uid}`;
    const endMarker = `${tag}_END_${uid}`;

    // Bật logging (cả statement + duration)
    execSync(
      `docker exec my-postgres psql -U postgres -c "ALTER SYSTEM SET log_statement = 'all';"`,
      { stdio: "ignore" },
    );
    execSync(
      `docker exec my-postgres psql -U postgres -c "ALTER SYSTEM SET log_duration = 'on';"`,
      { stdio: "ignore" },
    );
    execSync(
      `docker exec my-postgres psql -U postgres -c "SELECT pg_reload_conf();"`,
      { stdio: "ignore" },
    );
    await new Promise((r) => setTimeout(r, 1000));

    // Warm up 5 requests trước
    for (let i = 0; i < 30; i++) await performQuery();

    // Marker start
    execSync(
      `docker exec my-postgres psql -U postgres -d ${db} -c "SELECT '---${startMarker}---';"`,
      { stdio: "ignore" },
    );

    // 1 request + đo thời gian HTTP
    const httpStart = Date.now();
    await performQuery();
    const httpTime = Date.now() - httpStart;

    // Marker end
    execSync(
      `docker exec my-postgres psql -U postgres -d ${db} -c "SELECT '---${endMarker}---';"`,
      { stdio: "ignore" },
    );
    await new Promise((r) => setTimeout(r, 500));

    // Đọc log từ file bên trong container
    let raw = "";
    try {
      raw = execSync(
        `docker exec my-postgres tail -n 2000 /var/log/postgresql/postgresql.log`,
        { maxBuffer: 10 * 1024 * 1024 },
      ).toString();
    } catch (e: any) {
      if (e.stdout) raw = e.stdout.toString();
    }

    // Cắt giữa 2 marker
    const startIdx = raw.indexOf(startMarker);
    const endIdx = raw.indexOf(endMarker);
    const section =
      startIdx >= 0 && endIdx >= 0 ? raw.substring(startIdx, endIdx) : "";

    // Parse: chỉ lấy execute statements và duration của chúng
    // Format log:
    //   LOG:  execute <unnamed>: SELECT ...
    //   LOG:  duration: 0.123 ms  (standalone = duration của execute trước đó)
    // hoặc:
    //   LOG:  statement: SELECT ...
    //   LOG:  duration: 0.123 ms
    const allLines = section.split("\n");
    let totalDbTime = 0;
    const queries: { duration: number; sql: string }[] = [];
    let lastSql: string | null = null;
    let lastPid: string | null = null;

    for (const line of allLines) {
      if (line.includes(startMarker) || line.includes(endMarker)) continue;
      if (line.includes("DETAIL:")) continue; // Skip parameter details
      if (!line.includes("LOG:")) continue;

      // Extract PID from log line: "2026-02-02 14:46:00.747 UTC [588] LOG:"
      const pidMatch = line.match(/\[(\d+)\]/);
      const currentPid = pidMatch ? pidMatch[1] : null;

      // Bắt SQL từ execute hoặc statement (không phải parse/bind)
      const execMatch = line.match(/LOG:\s+execute[^:]*:\s*(.+)/);
      const stmtMatch = line.match(/LOG:\s+statement:\s*(.+)/);

      if ((execMatch || stmtMatch) && !line.includes("duration:")) {
        lastSql = execMatch ? execMatch[1] : stmtMatch![1];
        lastPid = currentPid;
        continue;
      }

      // Standalone duration line (không chứa SQL)
      // Format: "LOG:  duration: 0.123 ms" (không có thêm gì sau ms)
      const durOnlyMatch = line.match(/LOG:\s+duration: ([\d.]+) ms\s*$/);
      if (durOnlyMatch && lastSql && currentPid === lastPid) {
        const duration = parseFloat(durOnlyMatch[1]);
        totalDbTime += duration;
        queries.push({ duration, sql: lastSql });
        lastSql = null;
        lastPid = null;
      }
    }

    console.log(`\n${"=".repeat(70)}`);
    console.log(`  SQL QUERIES - ${tag} (1 request)`);
    console.log(`${"=".repeat(70)}`);
    queries.forEach((q, i) => {
      const dur = q.duration.toFixed(3).padStart(8);
      console.log(`  ${String(i + 1).padStart(2)}.  ${q.sql}  [${dur} ms]`);
      console.log("");
    });
    const appOverhead = httpTime - totalDbTime;

    console.log(`${"=".repeat(70)}`);
    console.log(``);
    console.log(` Total: ${queries.length} queries`);
    console.log(` Total DB execution time (database level - PostgreSQL xử lý):       ${totalDbTime.toFixed(3)} ms`);
    console.log(``);
    console.log(``);
    console.log(``);
    console.log(`${"=".repeat(70)}`);
    console.log(`  HTTP response time:      ${httpTime} ms`);
    console.log(
      `  Application overhead (Application level):    ${appOverhead.toFixed(3)} ms  (ORM + serialize + middleware)`,
    );
    console.log(`${"=".repeat(70)}`);
    return;
  }

  await [...Array(30)].reduce(async (priorFetch, _, i) => {
    await priorFetch;

    await performQuery();

    console.log(`[warm up] Request ${i + 1} completed`);
  }, Promise.resolve());

  console.log(`----------------BẮT ĐẦU-------------------`);







  const startTime = new Date().getTime();
  const fetchTimes: number[] = [];

  await [...Array(1000)].reduce(async (priorFetch, _, i) => {
    await priorFetch;
    const sendDate = new Date().getTime();

    await performQuery();
    const receiveDate = new Date().getTime();
    const completionTime = receiveDate - sendDate;

    console.log(`Request ${i + 1} completed in ${completionTime}ms`);
    fetchTimes.push(completionTime);
  }, Promise.resolve());

  const endTime = new Date().getTime();
  const totalTestTime = endTime - startTime;

  const average = getAverage(fetchTimes);
  const max = Math.max(...fetchTimes);
  const min = Math.min(...fetchTimes);

  console.log(`🍊 Performance test completed in ${totalTestTime}ms`);
  console.log(`Average response time: ${average}ms`);
  console.log(`Max response time: ${max}ms`);
  console.log(`Min response time: ${min}ms`);

  fs.writeFileSync(
    `results-${platform}.json`,
    JSON.stringify({ average, max, min, totalTestTime }),
    "utf8",
  );
};














main();

// Auth
async function getPayloadAuthHeader() {
  const res = await fetch("http://127.0.0.1:3000/api/users/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "dev@payloadcms.com",
      password: "test",
    }),
  });
  const { token } = await res.json();
  console.log("Payload token:", token);
  return `Bearer ${token}`;
}

async function getStrapiAuthHeader() {
  const res = await fetch("http://127.0.0.1:1337/api/auth/local", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifier: "user@user.com",
      password: "Test123123",
    }),
  });
  const { jwt } = await res.json();
  console.log("Strapi token:", jwt);
  return `Bearer ${jwt}`;
}

// GraphQL Queries (commented out)
// async function performPayloadQuery(authHeader: string, query: string) {
//   await fetch('http://127.0.0.1:3000/api/graphql', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: authHeader,
//     },
//     body: JSON.stringify({
//       query,
//     }),
//   })
// }
//
// async function performStrapiQuery(authHeader: string, query: string) {
//   await fetch('http://127.0.0.1:1337/graphql', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       Authorization: authHeader,
//     },
//     body: JSON.stringify({
//       query,
//     }),
//   })
// }

// REST Queries
async function performPayloadRestQuery(authHeader: string) {
  await fetch("http://127.0.0.1:3000/api/documents?depth=2", {
    method: "GET",
    headers: {
      Authorization: authHeader,
    },
  });
}

async function performStrapiRestQuery(authHeader: string) {
  const params = [
    "populate[relationship_as][populate][relationship_b]=*",
    "populate[blocks][populate][relationship_a][populate][relationship_b]=*",
    "populate[blocks][populate][relationship_as][populate][relationship_b]=*",
    "populate[Group][populate][NestedGroup]=*",
    "populate[array][populate][NestedArray][populate][relationship_a][populate][relationship_b]=*",
  ].join("&");

  await fetch(`http://127.0.0.1:1337/api/documents?${params}`, {
    method: "GET",
    headers: {
      Authorization: authHeader,
    },
  });
}

import { connectLambda, getStore } from "@netlify/blobs";

const STORE_NAME = "jingling-schedule";
const RECORDS_KEY = "records";

const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const ok = (body, statusCode = 200) => ({
  statusCode,
  headers,
  body: JSON.stringify(body)
});

const bad = (message, statusCode = 400) => ok({ error: message }, statusCode);

async function readRecords() {
  const store = openStore();
  const records = await store.get(RECORDS_KEY, { type: "json" });
  return Array.isArray(records) ? records : [];
}

async function writeRecords(records) {
  const store = openStore();
  await store.setJSON(RECORDS_KEY, records, { metadata: { updatedAt: new Date().toISOString() } });
}

function openStore() {
  return getStore(STORE_NAME);
}

function cleanRecord(input) {
  const value = input && typeof input === "object" ? input : {};
  const required = ["studentId", "lp", "continent", "language", "status"];
  const record = {
    id: String(value.id || crypto.randomUUID()),
    studentId: String(value.studentId || "").trim(),
    lp: String(value.lp || "").trim(),
    continent: String(value.continent || "").trim(),
    language: String(value.language || "").trim(),
    level: String(value.level || "").trim(),
    day1: String(value.day1 || "").trim(),
    time1: String(value.time1 || "").trim(),
    day2: String(value.day2 || "").trim(),
    time2: String(value.time2 || "").trim(),
    status: String(value.status || "").trim(),
    note: String(value.note || "").trim(),
    updatedAt: new Date().toISOString()
  };

  for (const field of required) {
    if (!record[field]) {
      throw new Error("请完整填写必填项");
    }
  }

  return record;
}

export async function handler(event) {
  connectLambda(event);

  if (event.httpMethod === "OPTIONS") {
    return ok({});
  }

  try {
    if (event.httpMethod === "GET") {
      const records = await readRecords();
      return ok({ records, updatedAt: new Date().toISOString() });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const record = cleanRecord(body);
      const records = await readRecords();
      const existing = records.findIndex((item) => item.id === record.id);
      if (existing >= 0) {
        records.splice(existing, 1, record);
      } else {
        records.unshift(record);
      }
      await writeRecords(records);
      return ok({ record, records });
    }

    if (event.httpMethod === "DELETE") {
      const id = event.queryStringParameters?.id;
      if (!id) return bad("缺少记录 ID");
      const records = (await readRecords()).filter((item) => item.id !== id);
      await writeRecords(records);
      return ok({ records });
    }

    return bad("不支持的请求方式", 405);
  } catch (error) {
    return bad(error.message || "服务暂时不可用", 500);
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (req.body && typeof req.body === "string") return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("模型没有返回可解析 JSON");
    return JSON.parse(match[0]);
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST is allowed" });

  try {
    if (!process.env.DEEPSEEK_API_KEY) {
      return res.status(500).json({ error: "缺少环境变量 DEEPSEEK_API_KEY" });
    }

    const { text } = await readJson(req);
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: "缺少 text" });
    }

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        messages: [
          {
            role: "system",
            content: `你是 FocusMap 的学习任务解析助手。
请把用户输入的一段学习计划拆成今日任务。
只输出 JSON，不要输出解释文字。

输出格式必须是：
{
  "tasks": [
    {
      "subject": "科目",
      "content": "具体学习内容",
      "estimatedMinutes": 预计分钟数,
      "taskType": "复习/做题/背诵/整理/总结/其他",
      "difficulty": "简单/中等/困难"
    }
  ]
}

规则：
1. 半小时 = 30 分钟。
2. 一小时 = 60 分钟。
3. 一个半小时 = 90 分钟。
4. 如果没有写时间，请根据任务大小估一个合理时间。
5. 科目尽量归类为 C/C++、线性代数、大学物理、高等数学、德语、英语、其他。
6. 不要拆得太碎，保持 3 到 6 个任务最合适。
7. 不要编造用户没有提到的大任务。`
          },
          { role: "user", content: String(text) }
        ],
        response_format: { type: "json_object" },
        stream: false
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: "DeepSeek API 调用失败", detail: data });
    }

    const outputText = data.choices?.[0]?.message?.content || "";
    const parsed = extractJson(outputText);

    if (!Array.isArray(parsed.tasks)) {
      return res.status(500).json({ error: "返回内容缺少 tasks 数组", raw: parsed });
    }

    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: "任务解析失败", message: error.message });
  }
}

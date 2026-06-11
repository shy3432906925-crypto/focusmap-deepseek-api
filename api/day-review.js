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

    const dayData = await readJson(req);

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
            content: `你是 FocusMap 的学习复盘助手。
请根据用户今天的学习数据，生成温和、具体、实用的每日总结。
不要批评用户，不要说空话，不要鸡汤。
只输出 JSON，不要输出解释文字。

输出格式必须是：
{
  "summary": "今日总体总结",
  "timeAnalysis": "预计时间和实际时间分析",
  "qualityAnalysis": "掌握程度和薄弱点分析",
  "stateAnalysis": "分心原因和状态分析",
  "tomorrowSuggestions": [
    {
      "subject": "科目",
      "content": "建议任务",
      "estimatedMinutes": 预计分钟数
    }
  ],
  "encouragement": "一句简短鼓励"
}`
          },
          { role: "user", content: JSON.stringify(dayData, null, 2) }
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
    return res.status(200).json(parsed);
  } catch (error) {
    return res.status(500).json({ error: "每日总结失败", message: error.message });
  }
}

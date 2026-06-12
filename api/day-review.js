function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-focusmap-token");
}

function getBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function safeJsonParse(text) {
  if (!text || typeof text !== "string") {
    throw new Error("模型返回内容为空");
  }

  try {
    return JSON.parse(text);
  } catch {}

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("模型没有返回可解析 JSON");
  }

  return JSON.parse(match[0]);
}

function normalizeReview(data) {
  return {
    summary: String(data.summary || "今天已经有学习记录了，可以根据完成情况继续调整。"),
    timeAnalysis: String(data.timeAnalysis || "暂无明显时间偏差。"),
    qualityAnalysis: String(data.qualityAnalysis || "暂无明显薄弱点。"),
    stateAnalysis: String(data.stateAnalysis || "暂无明显状态问题。"),
    tomorrowSuggestions: Array.isArray(data.tomorrowSuggestions)
      ? data.tomorrowSuggestions.map((task, index) => ({
          subject: String(task.subject || "其他"),
          content: String(task.content || `建议任务 ${index + 1}`),
          estimatedMinutes: Number(task.estimatedMinutes) > 0 ? Number(task.estimatedMinutes) : 30
        }))
      : [],
    encouragement: String(data.encouragement || "今天已经启动了，这本身就是有效进展。")
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "day-review api is running. Please call this API with POST."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST is allowed"
    });
  }

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";

    if (!apiKey) {
      return res.status(500).json({
        error: "缺少环境变量 DEEPSEEK_API_KEY",
        hint: "请在 Vercel 项目 Settings 里的 Environment Variables 添加 DEEPSEEK_API_KEY，然后 Redeploy。"
      });
    }

    const dayData = getBody(req);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `你是 FocusMap 的学习复盘助手。
你要根据用户今天的学习数据，生成温和、具体、实用的每日总结。

你必须只输出合法 json，不要输出解释文字。
不要批评用户，不要说空话，不要鸡汤。

输出 json 格式必须是：
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
          {
            role: "user",
            content: JSON.stringify(dayData, null, 2)
          }
        ],
        response_format: {
          type: "json_object"
        },
        stream: false,
        temperature: 0.3
      })
    });

    const data = await response.json().catch(async () => {
      return {
        rawText: await response.text().catch(() => "")
      };
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "DeepSeek API 调用失败",
        status: response.status,
        detail: data
      });
    }

    const outputText = data?.choices?.[0]?.message?.content || "";
    const parsed = safeJsonParse(outputText);
    const normalized = normalizeReview(parsed);

    return res.status(200).json(normalized);
  } catch (error) {
    return res.status(500).json({
      error: "每日总结失败",
      message: error.message
    });
  }
}

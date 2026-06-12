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

function normalizeTasks(data) {
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];

  return {
    tasks: tasks.map((task, index) => ({
      subject: String(task.subject || "其他").trim(),
      content: String(task.content || `未命名任务 ${index + 1}`).trim(),
      estimatedMinutes: Number(task.estimatedMinutes) > 0 ? Number(task.estimatedMinutes) : 30,
      taskType: String(task.taskType || "其他").trim(),
      difficulty: ["简单", "中等", "困难"].includes(task.difficulty) ? task.difficulty : "中等"
    }))
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
      message: "parse-tasks api is running. Please call this API with POST.",
      needBody: {
        text: "今天复习 C++ 指针一个小时，线代做题半小时"
      }
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

    const body = getBody(req);
    const text = String(body.text || "").trim();

    if (!text) {
      return res.status(400).json({
        error: "缺少 text",
        example: {
          text: "今天复习 C++ 指针一个小时，线代做题半小时"
        }
      });
    }

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
            content: `你是 FocusMap 的学习任务解析助手。

请把用户输入的一段学习计划拆成今日任务。
你必须只输出合法 json，不要输出解释文字。

输出 json 格式必须是：
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
4. 如果用户没有写时间，请根据任务大小估一个合理时间。
5. 科目尽量归类为 C/C++、线性代数、大学物理、高等数学、德语、英语、其他。
6. 不要拆得太碎，保持 3 到 6 个任务最合适。
7. 不要编造用户没有提到的大任务。`
          },
          {
            role: "user",
            content: text
          }
        ],
        response_format: {
          type: "json_object"
        },
        stream: false,
        temperature: 0.2
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
    const normalized = normalizeTasks(parsed);

    return res.status(200).json(normalized);
  } catch (error) {
    return res.status(500).json({
      error: "任务解析失败",
      message: error.message
    });
  }
}

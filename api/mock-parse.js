export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-focusmap-token");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "mock parse api is running"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST is allowed"
    });
  }

  return res.status(200).json({
    tasks: [
      {
        subject: "C/C++",
        content: "测试任务：复习指针",
        estimatedMinutes: 30,
        taskType: "复习",
        difficulty: "中等"
      },
      {
        subject: "线性代数",
        content: "测试任务：做线性空间例题",
        estimatedMinutes: 30,
        taskType: "做题",
        difficulty: "中等"
      }
    ]
  });
}

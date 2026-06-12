# FocusMap DeepSeek API

这是 FocusMap v3 / v3.1 用的 Vercel 后端接口项目。

## GitHub 仓库结构必须是

package.json
README.md
api/
  health.js
  mock-parse.js
  parse-tasks.js
  day-review.js

## Vercel 环境变量

DEEPSEEK_API_KEY = 你的 DeepSeek API Key
DEEPSEEK_MODEL = deepseek-v4-pro

如果想用便宜一点的模型，也可以改成 deepseek-v4-flash。

## 测试地址

部署后先打开：

https://你的项目.vercel.app/api/health

如果 ok 为 true，而且 hasDeepSeekKey 为 true，说明环境变量生效了。

再打开：

https://你的项目.vercel.app/api/mock-parse

如果能看到 mock parse api is running，说明 Vercel API 路径正常。

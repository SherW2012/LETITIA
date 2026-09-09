# LETITIA · 无用发明实验室

用 Vibe Coding，把离谱需求做成真的能跑的小玩意。

首个模块：**朋友圈装逼浓度检测器**。支持文案、单张截图、拖拽或剪贴板粘贴；通过 Kimi 多模态接口返回装逼、凡尔赛、AI 味、翻白眼四项娱乐性评分及具体依据。首页保留空展位，后续继续扩展。

## 文件结构

```text
dist/
  index.html           首页与模块弹窗
  styles.css           全站样式、手机适配
  app.js               卡片渲染、模块启动和资源清理
  favicon.svg          网站图标
  modules/
    registry.js        发明注册表
    moments-detector/  朋友圈检测界面
worker/index.js        服务端分析接口、输入与输出校验
scripts/               构建与本地启动
tests/                 服务端边界测试
.openai/hosting.json   Sites 托管配置
```

原生 HTML、CSS、JavaScript 前端，Cloudflare Worker 服务端，无第三方运行依赖。`dist` 中的前端源码直接维护并提交到 Git；`dist/server` 和 `dist/.openai` 是忽略的构建产物。构建将前端资源嵌入 Worker，同时提供页面和 `/api/analyze`。

## 本地运行

使用 Node.js 22 或更高版本。设置服务端环境变量 `MOONSHOT_API_KEY`，可选 `MOONSHOT_MODEL`（默认 `kimi-k3`），执行 `npm run build`、`npm start`，然后打开 `http://localhost:8080`。执行 `npm test` 验证服务端边界。无需第三方依赖。

生产密钥存储在 Sites 的加密环境变量中，不放入源码、前端或 Git。内容经本站服务端转发给 Kimi，本站不保存文案、图片或模型输出。原始图片最大 10 MB，一次一张，在浏览器中转为 JPEG 并限制最长边 2400 像素。

四项分数都是主观娱乐刻度。AI 味不鉴定真实作者；翻白眼指数不代表真实概率。无足够文字时 AI 味显示“无法判断”。接口失败或报告异常时显示错误，不生成假分数。

## 以后增加一个小功能

1. 在 `dist/modules/` 下新增该功能目录，如 `my-invention/index.js`。
2. 导出 `mount(container)`，把功能界面渲染进传入的容器。可返回清理函数，在关闭时释放定时器、事件订阅、音视频等资源。
3. 在 `dist/modules/registry.js` 的 `modules` 数组添加记录：

```js
{
  id: 'my-invention',
  title: '发明名称',
  description: '一句话说明怎么玩',
  category: '分类名称',
  status: 'live',
  load: () => import('./my-invention/index.js'),
}
```

此代码仅说明新增模块接口。只展示 `status: 'live'` 的模块；草稿不会出现在首页。数组顺序就是展位顺序，不限数量。点击已上线卡片时才加载功能，在当前网页的弹窗中运行；关闭可返回展位。空展位没有可点击动作，不会冒充已上线功能。

模块样式应限定在各自的容器内，避免改变首页。模块使用摄像头、麦克风等能力时应在用户主动启动时申请权限，并在关闭时释放资源。API 密钥不得放进前端，统一由服务端调用模型。

## 托管

运行 `npm run build`，将 `dist/server/index.js` 和 `.openai/hosting.json` 交给 Sites 打包并保存版本。生产密钥通过 Sites 环境变量管理。此版本需要服务端，不能只上传前端到 GitHub Pages 后就调用模型。

API 接入依据：[Kimi 官方文档](https://platform.kimi.com/docs/api/chat)。

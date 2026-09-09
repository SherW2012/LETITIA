# LETITIA · 无用发明实验室

用 Vibe Coding，把离谱需求做成真的能跑的小玩意。

当前版本只搭建网站结构，**没有实现任何具体选题**。首页展示 6 个待开工展位，包含响应式布局、自动计数、模块卡片，以及为未来小功能预留的弹窗容器。

## 文件结构

```text
dist/
  index.html           首页与模块弹窗
  styles.css           全站样式、手机适配
  app.js               卡片渲染、模块启动和资源清理
  favicon.svg          网站图标
  modules/
    registry.js        发明注册表（目前为空）
.openai/hosting.json   Sites 托管配置
```

纯 HTML、CSS、JavaScript，无依赖、无构建步骤。`dist` 是直接维护的源文件目录，不是自动生成目录，必须提交到 Git。

## 本地运行

在仓库根目录执行 `python3 -m http.server 8080 --directory dist`，然后打开 `http://localhost:8080`。由于使用 ES Modules，请通过 HTTP 打开，不要双击 HTML 文件。

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

此代码仅说明接口；仓库没有添加演示发明。只展示 `status: 'live'` 的模块；草稿不会出现在首页。数组顺序就是展位顺序，不限数量。点击已上线卡片时才加载功能，在当前网页的弹窗中运行；关闭可返回展位。空展位没有可点击动作，不会冒充已上线功能。

模块样式应限定在各自的容器内，避免改变首页。模块使用摄像头、麦克风等能力时应在用户主动启动时申请权限，并在关闭时释放资源。API 密钥不得放进前端；将来需要 AI 服务时再增加服务端接口。

## 托管

静态托管的发布目录为 `dist`。所有资源路径均为相对路径，支持独立域名和 `/LETITIA/` 这样的子路径。可以将 `dist` 部署到静态托管服务，也可以在 GitHub Pages 的发布流程中将 `dist` 作为页面产物。

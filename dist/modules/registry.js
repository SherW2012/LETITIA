/**
 * 唯一的发明注册入口。
 * 新模块字段及接入方式见 README.md。
 * load 使用明确的本地 import，避免从用户输入加载代码。
 */
export const modules = [
  {
    id: 'boss-guard',
    title: '打工人保命系统',
    description: '身后有人，自动跳到你指定的网页。',
    category: '摄像头实验 · 本地识别',
    status: 'live',
    load: () => import('./boss-guard/index.js'),
  },
  {
    id: 'moments-detector',
    title: '朋友圈装逼浓度检测器',
    description: '发一张截图，看看有多少人想翻白眼。',
    category: '社交实验 · 支持截图',
    status: 'live',
    load: () => import('./moments-detector/index.js'),
  },
];

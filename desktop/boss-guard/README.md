# LETITIA · 打工人保命系统（Windows 本地版）

摄像头识别人 → 排除你本人 → 身后有其他人时切到选定的真实 Excel → 其他人离开后恢复原窗口。

## 启动

1. 安装 Windows 64 位 Python 3.11（https://www.python.org/downloads/）。需要已有 Microsoft Excel。
2. 解压完整文件夹，双击 `start.bat`。首次创建本文件夹内的虚拟环境并联网安装依赖，随后下载并校验人体检测模型。
3. 打开一个 Excel 工作簿，回到本程序刷新 Excel 列表并选择它。
4. 开启摄像头。默认编号 0；没有画面时关闭摄像头并尝试 1。点击画面里自己的框，确认其变绿。
5. 点击“测试切换”，确认 Excel 能到前台并在 3 秒后恢复。然后点击“开始守卫”，可以最小化本程序并正常使用电脑。
6. 人离开后默认等待 3 秒恢复。停止守卫或关闭程序会释放摄像头并尝试恢复窗口。

## 已实现与限制

- 使用 MediaPipe 0.10.18 / EfficientDet-Lite0，人体检测不是人脸身份识别；几何跟踪只用于排除你本人。
- 完全遮挡、视野外的人无法检测；只露出头、逆光、快速移动可能漏检。本人丢失超过 1.2 秒后锁定工作状态，需手动停止并重新标记。
- 几何跟踪在两个人高度重叠或位置互换时可能认错，需要实际座位校准。先用其他人从左右和身后走过的方式验证。
- Windows 前台窗口切换可能受系统限制；不会修改系统策略、申请管理员权限或注入键盘操作。切换失败会显示错误。独占全屏游戏、提权程序、不同桌面不保证切换。
- Excel 切换会最大化选定窗口，恢复时还原原窗口位置；如果用户已手动切到其他软件，不再强行恢复先前窗口。
- 摄像头画面不上传、不保存。首次安装会访问 PyPI；模型优先从 LETITIA 下载，失败时尝试 Google 官方源，均校验 SHA-256。下载完成后识别不需要网络。
- 本版本已做静态检查和跟踪逻辑测试，未在实际 Windows 摄像头和 Excel 环境完成端到端测试。

## 开源组件

MediaPipe：https://github.com/google-ai-edge/mediapipe ，Apache-2.0，许可证附于 MEDIAPIPE-LICENSE.txt。
模型：Google MediaPipe 官方 EfficientDet-Lite0 int8 v1（https://developers.google.com/edge/mediapipe/solutions/vision/object_detector）。
OpenCV、NumPy、Pillow 通过 pip 安装，其许可证随各包分发。

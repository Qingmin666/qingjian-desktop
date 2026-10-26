# 轻笺 2.0.0-beta.4 验证

## 自动验证
- 32个JavaScript文件语法检查；30项自动测试通过。
- 使用原始renderer.js及最小DOM测试环境验证真实事件绑定：＋打开主页面输入栏而不打开模态框；提交保存任务、清空输入并继续聚焦；每行三个点打开编辑器。
- 测试拖拽对应的数据移动动作：前后排序、拖入／拖出子任务、跨父任务、子任务内部排序、保留编号和提醒时间、更新父完成状态、拒绝循环及二级嵌套、带子任务主任务降级保护。
- 测试滑动轨迹：方向、单调透明度、固定内容尺寸、首尾准确。继承四角几何及原有任务／提醒／打包测试。

## 视觉与运行验收限制
渲染器事件测试是模拟DOM，不是实际Windows桌面鼠标验收；轨迹测试不等于毛玻璃合成视觉验收。本版使用独立测试数据目录启动即返回0x80000003，不能将本次代码测试称为实际桌面动画通过。

## 手动验收
1. ＋直接输入，连续Enter添加；三个点编辑截止／提醒；右键更多操作。
2. 六套主题下检查编辑器、设置、菜单和日期输入的协调性。
3. 三个边缘悬停、移入主页面、离开、动画中途收起托盘／切换模式。
4. 手动排序下拖⠿至上／下缘排序、中间移入、底部移出；跨父任务保持时间信息。

## 本次使用的接口文档
- Electron BrowserWindow.setOpacity：https://www.electronjs.org/docs/latest/api/browser-window
- Windows SetLayeredWindowAttributes：https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setlayeredwindowattributes

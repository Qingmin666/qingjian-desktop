# MCP接入验证记录

## 基线
以2.0.0-beta.5纵向排列修正版为基础；没有恢复已删除beta.6的长度调节逻辑。用户已确认早先任务交互人工测试通过。

## 已通过
38个JavaScript文件语法检查，51项自动测试。原36项保持通过，新增15项覆盖：
- 10个工具发现及声明，任务完整读写／级联删除，父子规则、排序、时区参数与校验。
- 数据版本冲突；持久化请求回执跨重启去重，编号重用检测。
- 真实HTTP处理器内存请求：四个协议版本、握手与无会话请求、标准返回、GET/DELETE行为、鉴权、Host/Origin、请求头与正文匹配、大小限制。
- TLS服务器用有效测试证书成功构建，不允许远程模式降级为明文。
- MCP配置默认关闭、重置令牌、配置损坏隔离，不将凭据放进任务导出。
- 设置UI事件：仅应用时保存，证书选择、复制配置和重置令牌单独触发。

## 尚未通过
真实回环TCP测试首次执行得到connect EACCES；7个联网相关用例因此失败。没有将失败算作成功。默认模式随后以同一HTTP处理器做内存请求覆盖（不用TCP），这些通过不能等同于TCP／TLS端到端通过。

真实网络测试模式：QJ_REAL_NETWORK=1，或运行tools/test-mcp-network.ps1。该模式不使用内存注入，并用临时测试证书验证实际HTTPS握手。此环境不可完成该模式。

本次新设置界面与实际Electron通知联动尚无桌面验收；跨机器HTTPS、各Agent客户端配置也未验收。不宣称已经接入ChatGPT、Codex或Claude。Skill尚未制作，客户端配置尚未修改。

## 2.1.0-beta.2
40 JavaScript files checked; 54 automated tests passed. Hidden/minimized renderer reports no longer block hover, stale interaction reports expire, and MCP startup is independent of hover polling. Native UI acceptance remains pending.
Installed beta.1 configuration was enabled on port 49321. Actual localhost request failed with Windows 10013 in the execution environment; connection success is NOT established. Run tools/Test-InstalledMCP.ps1 on the host; -WriteTest creates, edits, completes and deletes only its own synthetic task. This historical test did not modify global MCP registration. The separate QingJian Skill was developed afterward; this report does not validate its current repository or client-loading state.

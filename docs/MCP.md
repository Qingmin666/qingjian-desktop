# 轻笺内置MCP 2.1.0-beta.2

## 接入
软件运行／驻留托盘期间提供MCP；完全退出时关闭。默认不开启。设置中选择本机或远程、端口后保存应用；运行状态和错误在同一面板显示。

本机：`http://127.0.0.1:49321/mcp`。远程：设置自己的 `https://主机:端口/mcp`、证书链和未加密私钥。远程使用HTTPS，监听0.0.0.0；支持外部HTTPS反向代理的公网地址，代理需保留正确Host与Authorization。软件不会配置路由器、防火墙、DNS或隧道。尚未进行真实跨机器联调。

HTTP头：`Authorization: Bearer <TOKEN>`，`Content-Type: application/json`，`Accept: application/json, text/event-stream`。使用静态Bearer，不提供OAuth授权服务器。客户端须支持自定义Authorization头；通用JSON仅为配置示例，不保证直接适用于所有客户端。

## 协议
- 2025-03-26、2025-06-18、2025-11-25：initialize→notifications/initialized，后续携带MCP-Session-Id和协商的MCP-Protocol-Version。GET返回405（不提供独立SSE），DELETE终止会话。会话空闲1小时过期，最多256个。
- 2026-07-28：server/discover可选，无会话握手；每次请求必须携带params._meta中的protocolVersion和clientCapabilities，以及匹配的MCP-Protocol-Version、Mcp-Method、工具调用Mcp-Name请求头。结果带resultType=complete与serverInfo元数据。
- tools/list发现，tools/call执行；返回content文本及structuredContent，业务错误isError=true，协议错误JSON-RPC error。
- 固定工具清单，不提供SSE订阅、资源、提示词、采样或MRTR交互。

## 工具
| 名称 | 功能 |
|---|---|
| qingjian_info | 本机日期、时区、排序方式、数据版本 |
| qingjian_list_tasks | 按日期、完成状态、父ID、标题查询；offset分页，最多200条／页 |
| qingjian_get_task | 主／子任务详情及直接子任务 |
| qingjian_add_task | 新建主任务或一层子任务，默认本机当天 |
| qingjian_update_task | 标题、归属日期、截止、提醒；null清除时间 |
| qingjian_set_completed | 显式完成／重新打开，沿用现有父子联动 |
| qingjian_set_pinned | 主任务置顶／取消置顶 |
| qingjian_move_task | 移入／移出子任务，移动到指定前后位置 |
| qingjian_reorder_tasks | 设置一个完整手动分组顺序 |
| qingjian_delete_task | 删除条目及其直接子任务 |

参数规范见MCP-tools.json，由实际定义导出。时间使用带Z或UTC偏移的ISO8601；服务器不猜测自然语言时间。归属日期是YYYY-MM-DD，子任务跟随父任务。移动和排序要求软件当前为手动排序；不通过MCP更改外观设置。

## 多Agent与重试
每次写入必填expectedRevision和全局唯一requestId（建议UUID）。先info/list/get取得版本。任务变化／排序规则变化会使版本失效，返回CONFLICT，需重新读取并由客户端判断如何重做；窗口移动或外观变化不使任务版本失效。

网络中断后重试同一操作时，必须保持requestId及全部参数一致。服务在任务数据中原子保存最近128次成功写入的请求回执，支持软件重启后去重。相同编号但不同参数返回REQUEST_ID_REUSED。回执被淘汰后不保证去重，不应盲目重试很久以前的请求。回执可能包含曾创建任务的快照，删除不是清除所有历史备份／回执。

删除可直接调用，不要求服务器侧confirmed字段或弹窗；客户端／后续Skill必须先向用户说明删除对象及子任务范围并取得二次确认。该对话规则不能约束不加载Skill的其他客户端。

## 数据与凭据
MCP只操作应用内存，通过同一持久化入口保存并触发界面／提醒更新，不直接让客户端访问todos.json、路径、配置、私钥或全局环境。mcp-config.json不进入任务备份，也不应提交GitHub。Bearer令牌以本地配置文件保存，依赖Windows用户目录／文件访问权限，不宣称加密保管。测试fixtures/tls-test.json只是公开测试证书与测试私钥，不能用于部署。

## 验证范围
见VALIDATION-MCP.md。默认测试通过内存向真实HTTP request处理器送请求；真正网络模式通过tools/test-mcp-network.ps1运行，使用临时端口和隔离数据。本执行环境拒绝回环TCP连接，尚无实际客户端接入或远程连接通过的结论。

## 官方协议依据
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- https://modelcontextprotocol.io/specification/2025-11-25/server/tools
- https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
- https://modelcontextprotocol.io/specification/2026-07-28/server/discover

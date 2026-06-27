# 腾讯云 SCF 配置清单

函数代码位于 `cloudfunctions/reminder-poller`。开发阶段建议保持 `dry-run`，只写入 `delivery_logs`，不真实发送。

## 1. 函数基础配置

- 函数类型：事件函数
- 函数名称：`family-care-reminder-poller`
- 运行环境：Node.js 20.19
- 执行方法：`index.main_handler`
- 内存：128 MB
- 初始化超时时间：30 秒
- 执行超时时间：30 秒
- 定时 Cron：`0 */1 * * * * *`

上传：

```text
cloudfunctions/family-care-reminder-poller.zip
```

ZIP 根目录需要直接包含 `.js` 文件和 `package.json`。

## 2. 知晓云环境变量

知晓云认证二选一：

- `MINAPP_ACCESS_TOKEN`
- 或同时配置 `MINAPP_CLIENT_ID`、`MINAPP_CLIENT_SECRET`

表 ID 必须填知晓云后台显示的数字 ID，不是表名：

```text
MINAPP_REMINDERS_TABLE_ID=
MINAPP_BINDINGS_TABLE_ID=
MINAPP_SETTINGS_TABLE_ID=
MINAPP_DELIVERY_LOGS_TABLE_ID=
```

如果使用知晓云测试环境，再配置：

```text
MINAPP_ENVIRONMENT_ID=
```

生产环境一般留空。

## 3. 运行模式

开发/验证：

```text
APP_MODE=dry-run
ALLOW_LIVE_DELIVERY=false
```

真实发送：

```text
APP_MODE=live
ALLOW_LIVE_DELIVERY=true
```

只设置其中一个不会进入真实发送，避免误发。

## 4. 微信订阅消息配置

```text
WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_SUBSCRIBE_TEMPLATE_ID=wwEuEAmaJjIYlfxQRZxnu6I8V5AuTdYOsc14eWJe2zk
WECHAT_TEMPLATE_DATA_JSON={"time1":"{{scheduled_at}}","thing3":"请及时查看照护提醒","thing2":"照护事项"}
WECHAT_MESSAGE_PAGE=pages/home/home
```

当前模板字段：

- 日期：`time1`
- 温馨提示：`thing3`
- 记录类型：`thing2`

不要在模板里放家人姓名、药品名、疾病、血压血糖、备注原文等敏感信息。

## 5. 用户设置对应关系

小程序设置页会同步到 `user_settings`：

```text
notification_enabled   推送总开关
quiet_hours_enabled    是否启用免打扰
quiet_hours_start      免打扰开始时间，例如 22:00
quiet_hours_end        免打扰结束时间，例如 08:00
daily_push_limit       每日推送上限
subscription_renewal_prompt_limit  微信订阅消息每日续授权提示次数
preferred_channel      wechat_subscribe 或 wecom_external
timezone               Asia/Shanghai
```

云函数会按这些设置决定是否发送。如果命中免打扰、每日上限、关闭推送或未绑定，会写入：

```text
delivery_logs.status = suppressed
delivery_logs.failure_category = quiet_hours / daily_limit / notifications_disabled / no_binding
```

## 6. 企业微信外部联系人群发实验通道

企业微信通道保留为实验/人工群发方案，不作为默认自动提醒主链路。

当前发送接口：

```text
/cgi-bin/externalcontact/add_msg_template
```

这个接口会创建客户群发任务，可能需要在企业微信群发助手中手动确认，且存在客户触达频控。它适合低频通知或实验，不适合作为每日循环提醒主通道。

绑定记录至少需要：

```text
owner_id
local_id = wecom_external_default
channel = wecom_external
external_userid
sender_userid
consent_status = accepted
enabled = true
bound_at
```

云函数环境变量：

```text
WECOM_CORP_ID=
WECOM_CORP_SECRET=
WECOM_AGENT_ID=
WECOM_SENDER_USERID=
WECOM_MESSAGE_TEXT=照护提醒：{{scheduled_at}}，请及时查看小程序。
```

说明：

- `WECOM_CORP_SECRET` 使用具备客户联系接口权限的自建应用 secret。
- `WECOM_SENDER_USERID` 是企业成员账号，用于客户联系群发任务的发送人。
- 小程序设置页选择“企业微信长期提醒”后，云函数会优先寻找 `wecom_external` 绑定。
- 如果没有绑定，会记录 `failure_category = no_binding`。
- 由于该通道不是稳定自动送达能力，默认推荐使用微信订阅消息 + 打开小程序时续授权。

## 7. 常用验证方式

1. 设置 `APP_MODE=dry-run`，创建 2-3 分钟后的提醒。
2. 到点后查看 `delivery_logs` 是否出现 `failure_category = dry_run`。
3. 切换 `APP_MODE=live` 且 `ALLOW_LIVE_DELIVERY=true`。
4. 再创建一条测试提醒，成功时应看到：

```text
status = sent
provider_code = 0
```

测试完建议恢复：

```text
APP_MODE=dry-run
ALLOW_LIVE_DELIVERY=false
```

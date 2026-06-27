# 知晓云配置清单（最小必要上云版）

本方案只把“定时推送必须用到的数据”保存到知晓云。家人资料、健康记录、药品名、备注原文等敏感内容默认留在用户设备中。

## 1. 数据边界

允许上云：

- 匿名提醒标识、触发时间、重复规则、启用状态。
- 微信订阅消息 openid、企业微信 external_userid 等推送接收标识。
- 授权状态、解绑状态、免打扰时段、每日推送上限。
- 不含消息正文的投递状态和错误码。

禁止上云：

- 家人姓名、年龄、关系、头像、备注。
- 体重、症状、诊断、病史等健康记录。
- 药品名、医院名、提醒备注、用户输入的自由文本。
- 微信 AppSecret、知晓云 ClientSecret、企业微信 Secret、access_token。
- 完整第三方接口响应、请求头、消息正文。

## 2. 四张表通用字段

每张表都必须有：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `owner_id` | integer | 是 | 知晓云用户 ID |
| `local_id` | string | 是 | 当前用户范围内的业务唯一标识 |

建议建立组合索引：

```text
owner_id + local_id
```

权限原则：

- 匿名用户禁止访问。
- 登录用户只能读写自己创建的数据。
- SCF 使用服务端凭证访问，服务端凭证不能进入小程序代码。

## 3. reminders

用途：SCF 查询到期提醒。只保存调度信息，不保存具体照护内容。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `owner_id` | integer | 是 | 知晓云用户 ID |
| `local_id` | string | 是 | 本地提醒 ID |
| `target_ref` | string | 是 | 匿名家人引用，例如 `family_xxx` |
| `type_code` | string | 是 | 固定通用值，例如 `general` |
| `scheduled_at` | string/date | 否 | 原计划时间 |
| `recurrence_type` | string | 是 | `once` / `daily` / `weekly` |
| `recurrence_rule` | string | 否 | 简化重复规则，不含备注 |
| `next_trigger_at` | string/date | 是 | 下一次扫描时间 |
| `timezone` | string | 是 | `Asia/Shanghai` |
| `channel` | string | 是 | 默认 `wechat_subscribe` |
| `enabled` | boolean | 是 | 是否继续调度 |
| `status` | string | 是 | `active` / `paused` / `deleted` |
| `version` | integer | 是 | 初始 `1` |

建议索引：

```text
owner_id + local_id
enabled + next_trigger_at
owner_id + status
```

## 4. notification_bindings

用途：保存推送接收标识和授权状态。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `owner_id` | integer | 是 | 知晓云用户 ID |
| `local_id` | string | 是 | 如 `wechat_subscribe_xxx` / `wecom_external_default` |
| `channel` | string | 是 | `wechat_subscribe` / `wecom_external` |
| `recipient_id` | string | 否 | 微信订阅消息 openid |
| `template_id` | string | 否 | 微信订阅消息模板 ID |
| `external_userid` | string | 否 | 企业微信外部联系人 ID |
| `member_userid` | string | 否 | 废弃实验字段：内部成员通道曾使用，当前不再使用 |
| `sender_userid` | string | 否 | 企业微信客户群发任务发送成员 ID |
| `consent_status` | string | 是 | `accepted` / `rejected` / `revoked` |
| `enabled` | boolean | 是 | 当前绑定是否启用 |
| `bound_at` | string/date | 否 | 绑定时间 |
| `revoked_at` | string/date | 否 | 解绑时间 |

建议索引：

```text
owner_id + local_id
owner_id + channel
```

一键解绑时不建议第一版物理删除记录，而是写成：

```text
consent_status = revoked
enabled = false
revoked_at = 当前时间
```

## 5. user_settings

用途：SCF 在发送前做用户设置和风控判断。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `owner_id` | integer | 是 | 知晓云用户 ID |
| `local_id` | string | 是 | 固定 `default` |
| `notification_enabled` | boolean | 是 | 推送总开关 |
| `quiet_hours_enabled` | boolean | 是 | 是否启用免打扰 |
| `quiet_hours_start` | string | 否 | 如 `22:00` |
| `quiet_hours_end` | string | 否 | 如 `08:00` |
| `daily_push_limit` | integer | 是 | 建议默认 `8` |
| `subscription_renewal_prompt_limit` | integer | 否 | 微信订阅消息每日续授权提示次数，建议默认 `2` |
| `preferred_channel` | string | 是 | `wechat_subscribe` / `wecom_external` |
| `timezone` | string | 是 | `Asia/Shanghai` |

建议索引：

```text
owner_id + local_id
```

## 6. delivery_logs

用途：防重复发送、记录投递结果。不保存提醒详情和完整第三方响应。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `owner_id` | integer | 是 | 知晓云用户 ID |
| `local_id` | string | 是 | 幂等键：模式 + 用户 + 提醒 + 时间 + 通道 |
| `reminder_local_id` | string | 是 | 对应提醒本地 ID |
| `channel` | string | 是 | 实际投递通道 |
| `scheduled_at` | string/date | 是 | 原计划发送时间 |
| `status` | string | 是 | `claimed` / `sent` / `failed` / `suppressed` |
| `attempt_count` | integer | 是 | 初始 `0` 或 `1` |
| `provider_code` | string | 否 | 微信/企微错误码 |
| `failure_category` | string | 否 | `dry_run` / `quiet_hours` / `daily_limit` 等 |
| `sent_at` | string/date | 否 | 实际发送时间 |
| `expire_at` | string/date | 是 | 建议创建后 30 天 |

建议索引：

```text
owner_id + local_id
status + scheduled_at
expire_at
```

## 7. 上线前检查

- 两个测试账号互相不能读写对方记录。
- 小程序网络请求里没有上传家人姓名、健康记录、备注原文。
- SCF 日志不输出 openid、external_userid、secret、access_token。
- 一键解绑后，`notification_bindings` 变为 `revoked`，本地提醒不丢失。
- 开发阶段保持 `APP_MODE=dry-run`，真实验收再切 `live`。

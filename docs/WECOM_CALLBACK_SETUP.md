# 企业微信接收消息服务器 URL 校验函数

这个函数只用于通过企业微信自建应用的“接收消息服务器 URL”校验。它不处理业务消息，不存储用户数据。

函数代码位置：

```text
cloudfunctions/wecom-callback
```

## 1. 腾讯云函数配置

新建一个独立 Web 函数：

```text
函数名称：family-care-wecom-callback
运行环境：Node.js 20.19
函数类型：Web 函数
启动命令：node server.js
```

上传：

```text
cloudfunctions/family-care-wecom-callback.zip
```

ZIP 根目录需要直接包含：

```text
index.js
server.js
package.json
```

## 2. 环境变量

在腾讯云函数里配置：

```text
WECOM_CALLBACK_TOKEN=你自己填写的一串 Token
WECOM_ENCODING_AES_KEY=企业微信后台生成的 EncodingAESKey
```

建议 `WECOM_CALLBACK_TOKEN` 用随机字符串，例如 16-32 位英文数字组合。

不要把这两个值发到聊天里，也不要放进小程序代码。

## 3. 企业微信后台填写

进入：

```text
应用管理
→ 自建应用
→ 家人照护提醒
→ 接收消息
→ 设置 API 接收
```

填写：

```text
URL：腾讯云函数 HTTP 触发器访问地址
Token：和 WECOM_CALLBACK_TOKEN 完全一致
EncodingAESKey：和 WECOM_ENCODING_AES_KEY 完全一致
```

保存时，企业微信会请求这个 URL 校验。校验通过后，就可以继续配置企业可信 IP。

## 4. 校验通过后的下一步

回到企业微信：

```text
应用管理
→ 自建应用
→ 企业可信 IP
```

填入腾讯云函数固定公网 IP。

然后回到：

```text
客户与上下游
→ 客户联系
→ 支持通过 API 管理客户
→ 可调用接口的应用
→ 设置
```

选择“家人照护提醒”这个自建应用。

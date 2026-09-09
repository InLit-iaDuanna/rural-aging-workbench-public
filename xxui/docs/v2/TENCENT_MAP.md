# 腾讯地图接入

调试工作区新增「村庄地理定位」。登录后打开地图，输入完整村庄地址并查询。采用 TMap JSAPI GL，地址结果为 GCJ-02 坐标；该入口只辅助定位，不自动配准影像、修改道路或形成已核验观察。

服务端配置 `TENCENT_MAP_KEY` 和 `TENCENT_MAP_SK`，本地已写入忽略提交的 `work/local.env`，文件权限 0600。Key 同时按用户技能保存至本机腾讯地图配置。不要把这些值写入前端变量、模板或版本库。CLI 子进程过滤腾讯凭据。

前端 SDK 请求不携带 Key，使用 `/api/v1/map/delegate` 代理鉴权和 SDK 统计请求；代理只接受固定上游，不提供任意地址转发。所有地图 API 需要业务账户登录。地址查询使用 `/api/v1/map/geocode`；腾讯要求的 SN 签名只在服务端生成。无签名真实请求返回 111；带签名请求返回 0，已实测。这里使用平台标准 MD5 实现腾讯协议，不用于项目完整性校验或密码存储。

依据：[官方 Key 代理](https://lbs.qq.com/webApi/javascriptGL/glGuide/glKeyDelegate)、[官方 WebService 签名](https://lbs.qq.com/faq/serverFaq/webServiceKey)、本机腾讯地图 JSAPI GL 与 WebService 技能。

生产主机需要重新配置凭据，并在腾讯控制台配置实际域名、IP 和服务权限。本地成功的地址请求不能证明生产域名或全部 SDK 瓦片权限已开通。本版本不开放海外地图服务、任意 WebService 转发或客户端 SK。

更新：定位后可确认建立真实村庄档案，保存名称、地址、坐标、备注及来源；再次打开项目可读回，位置修改使用独立版本并记录操作。该记录不自动配准影像或声明道路已核验。

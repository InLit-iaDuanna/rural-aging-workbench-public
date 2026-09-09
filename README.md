# 乡村适老化建设辅助工作台

面向乡村适老化建设场景的辅助工作台，包含空间分析、项目工作区、调试工作台和方案展示等功能。

## 前端项目

前端源码位于 `xxui/`，基于 React、TypeScript、Vite/Vinext 和 Cloudflare Workers 构建。

```bash
cd xxui
npm install
npm run dev
```

生产构建：

```bash
npm run build
```

## 项目资料

- `乡村适老化建设辅助工作台项目总纲.md`：项目总体说明
- `乡村适老化建设辅助工作台_调试工作区方案说明_V1.0.pdf`：调试工作区方案
- `效果图/`：设计与效果参考图

## V2.0

新增业务服务、调查采集、受控角色推演、方案复核与行动回访。实施状态见 [V2.0 交付记录](xxui/docs/v2/IMPLEMENTATION.md)，本地启动与部署见 [运行手册](xxui/docs/v2/OPERATIONS.md)。当前真实试点及生产业务主机尚待落实。

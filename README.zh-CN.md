# NetCanvas

[English](README.md) | 简体中文

## 简介

NetCanvas 是一款虚拟网络规划工作台。它通过可视化画布帮助用户设计网络拓扑、组织设备与网络关系、审阅生成的命令方案、执行基础安全检查，并模拟简单路由路径。其不以完全自动化部署为第一目标，而是帮助用户把拓扑设计转为配置参考。

## 功能描述

- 无限拓扑画布，支持平移、缩放、框选、选择和节点拖拽。
- 支持 Linux 主机、路由器、无线接入点、虚拟设备和桥接网络。
- 支持一台节点同时加入多个网络。
- 支持临时模式和持久模式的命令方案生成。
- 内置 `systemd-networkd`、`iproute2-bridge`、`NetworkManager` 命令模板。
- 按主机或设备展示命令，包含执行顺序、权限说明、风险提示和回滚命令。
- 提供 CIDR 冲突、网关缺失、路由缺失、重复接口名等基础安全检查。
- 提供共享网络和简单路由器转发路径的基础路由模拟。
- 项目数据保存在本地浏览器。
- 支持项目导入和导出。

## 快速开始

使用 Node.js `>=20.19 <21` 或 `>=22.12`。

```bash
npm install
npm run dev
```

Vite 开发服务地址：

```text
http://127.0.0.1:5173
```

## 构建

```bash
npm run build
npm run check
```

`npm run build` 会执行 TypeScript 校验并把生产构建产物输出到 `dist/`。

## 许可

NetCanvas 使用 MIT License 发布。详见 [LICENSE](LICENSE)。

## 后续扩展方向

NetCanvas 后续可逐步扩展更多网络类型、平台和规划目标：

- VLAN。
- NAT 出口网络。
- 多网段路由。
- DHCP/DNS 服务。
- Wi-Fi 接入点。
- VPN 网络。
- Docker 网络。
- Proxmox 网络。
- OpenWrt。
- RouterOS。
- Kubernetes CNI 规划。
- Windows 和 macOS 网络设置参考。
- 企业网络设备配置模板。

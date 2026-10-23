# admin-front

继续工作前先读 `docs/work-summary.md`：包含三个相关仓库（admin-web、admin-server、log）的现状、环境、已知坑和待办。跨仓库公共开发规范见工作区根目录 [`docs/开发规范.md`](../docs/开发规范.md)。

- 直接在 `main` 上开发；只有用户明确要求时才提交、推送。
- 前端优先使用 vben 内置能力（`useVbenVxeGrid`、`useVbenForm`、`useVbenModal`）。
- 后端在 submodule `backend/`（仓库 admin-server），遵守工作区公共开发规范和 `backend/docs/development-guidelines.md` 中的项目补充。

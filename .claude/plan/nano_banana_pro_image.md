# Nano Banana Pro Image 工具实现计划

## 任务上下文

基于 Nano Banana Pro API 文档，为 kie-ai-mcp-server 添加新的 MCP 工具 `nano_banana_pro_image`。

## 核心决策

- **实现方案**: 统一工具模式（单一工具，多模式检测）
- **工具名称**: `nano_banana_pro_image`
- **api_type**: `nano-banana-pro-generate` / `nano-banana-pro-edit`
- **现有工具**: 保留 `nano_banana_image`（两者独立）

## API 规范摘要

- **模型名称**: `nano-banana-pro`
- **端点**: `POST /jobs/createTask`
- **状态查询**: `GET /jobs/recordInfo?taskId=xxx`

### 参数

| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| prompt | string | 是 | 文本描述（max 5000 字符）|
| image_input | array | 否 | 参考图像 URL（max 8 张，编辑模式）|
| aspect_ratio | enum | 否 | 宽高比（1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9）|
| resolution | enum | 否 | 分辨率（1K, 2K, 4K）|
| output_format | enum | 否 | 输出格式（png, jpg）|

### 模式检测

- **生成模式**: 仅 prompt
- **编辑模式**: prompt + image_input (1-8 张)

## 实现步骤

### 1. types.ts - 添加 Schema
- 添加 `NanoBananaProImageSchema`
- 添加类型 `NanoBananaProImageRequest`
- 更新 `TaskRecord.api_type` 联合类型

### 2. kie-ai-client.ts - 添加客户端方法
- 添加 `generateNanoBananaProImage()` 方法
- 更新 `getTaskStatus()` 路由

### 3. index.ts - 添加 MCP 工具
- 添加到 `TOOL_CATEGORIES.image`
- 添加工具定义（ListToolsRequestSchema）
- 添加 `handleNanoBananaProImage()` 方法
- 添加路由分支（CallToolRequestSchema）

### 4. 构建验证
- `npm run build`
- `npx tsc --noEmit`

## 预期结果

用户可以通过 Claude Desktop 调用 `nano_banana_pro_image` 工具:
- 生成图像: `{ prompt: "..." }`
- 编辑图像: `{ prompt: "...", image_input: ["url1", "url2"] }`

---

**创建时间**: 2025-11-22
**状态**: 执行中

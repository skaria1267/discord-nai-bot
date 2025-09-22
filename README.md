# Discord NovelAI Bot

Discord机器人，使用NovelAI API生成AI图片。

## 功能特点

- 🎨 斜杠命令 `/nai` 生成图片
- 📐 智能尺寸限制（最大1216×832像素）
- 🖼️ 支持横版、竖版、方形
- 🔧 完整参数控制
- ⚡ 一键部署到Zeabur

## 部署方法

### Zeabur部署

1. Fork本仓库
2. 在Zeabur导入GitHub仓库
3. 配置环境变量
4. 部署完成

### 环境变量

- `DISCORD_TOKEN` - Discord Bot Token
- `CLIENT_ID` - Discord Application ID
- `NAI_API_KEY` - NovelAI API Key

## 使用说明

基础命令：
```
/nai prompt:你的提示词
```

完整参数：
```
/nai prompt:1girl model:nai-diffusion-3 size:portrait_large steps:40 cfg:7
```

## 作者

Created by skaria1267 claude 4.1op thinking
作者什么都不懂，仅提供指令，全是小克写的
## License

MIT

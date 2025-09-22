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

Created by skaria1267/startling⭐ & claude 4.1op thinking
作者什么都不懂，仅提供指令，代码全是小克写的

## 致谢 / Credits

本项目的V4模型支持参考了 [nai-discordbot](https://github.com/saltysalrua/nai-discordbot) 项目的实现，特别是V4模型的特殊参数结构处理。该项目遵循MIT许可证。

This project's V4 model support references implementation from [nai-discordbot](https://github.com/saltysalrua/nai-discordbot), particularly the V4 model parameter structure handling. That project is licensed under MIT.

## License

本项目遵循MIT许可证 - 详见 [LICENSE](LICENSE) 文件

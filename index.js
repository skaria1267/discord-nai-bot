const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

// 环境变量
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const NAI_API_KEY = process.env.NAI_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;

// NAI API配置
const NAI_API_URL = 'https://api.novelai.net/ai/generate-image';

// 创建Discord客户端
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// 尺寸限制 - 最大面积 1216×832 = 1012352 像素
const SIZE_LIMITS = {
    maxPixels: 1216 * 832
};

// 预设尺寸选项
const SIZE_PRESETS = {
    'portrait_small': { width: 512, height: 768 },
    'portrait_normal': { width: 512, height: 1024 },
    'portrait_large': { width: 832, height: 1216 },
    'landscape_small': { width: 768, height: 512 },
    'landscape_normal': { width: 1024, height: 512 },
    'landscape_large': { width: 1216, height: 832 },
    'square_small': { width: 512, height: 512 },
    'square_normal': { width: 640, height: 640 },
    'square_large': { width: 832, height: 832 },
    'wallpaper': { width: 1216, height: 684 },
    'mobile': { width: 608, height: 1080 }
};

// 模型选项
const MODELS = {
    'nai-diffusion-3': 'NAI Diffusion V3',
    'nai-diffusion-2': 'NAI Diffusion V2',
    'nai-diffusion': 'NAI Diffusion V1',
    'safe-diffusion': 'Safe Diffusion',
    'nai-diffusion-furry': 'NAI Diffusion Furry'
};

// 注册斜杠命令
const commands = [
    new SlashCommandBuilder()
        .setName('nai')
        .setDescription('使用NovelAI生成图片')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('正向提示词')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('negative')
                .setDescription('负向提示词')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('model')
                .setDescription('选择模型')
                .setRequired(false)
                .addChoices(
                    { name: 'NAI Diffusion V3 (默认)', value: 'nai-diffusion-3' },
                    { name: 'NAI Diffusion V2', value: 'nai-diffusion-2' },
                    { name: 'NAI Diffusion V1', value: 'nai-diffusion' },
                    { name: 'Safe Diffusion', value: 'safe-diffusion' },
                    { name: 'Furry', value: 'nai-diffusion-furry' }
                ))
        .addStringOption(option =>
            option.setName('size')
                .setDescription('选择尺寸预设')
                .setRequired(false)
                .addChoices(
                    { name: '竖图小 (512×768)', value: 'portrait_small' },
                    { name: '竖图中 (512×1024)', value: 'portrait_normal' },
                    { name: '竖图大 (832×1216)', value: 'portrait_large' },
                    { name: '横图小 (768×512)', value: 'landscape_small' },
                    { name: '横图中 (1024×512)', value: 'landscape_normal' },
                    { name: '横图大 (1216×832)', value: 'landscape_large' },
                    { name: '方图小 (512×512)', value: 'square_small' },
                    { name: '方图中 (640×640)', value: 'square_normal' },
                    { name: '方图大 (832×832)', value: 'square_large' },
                    { name: '壁纸 (1216×684)', value: 'wallpaper' },
                    { name: '手机 (608×1080)', value: 'mobile' }
                ))
        .addIntegerOption(option =>
            option.setName('width')
                .setDescription('自定义宽度（64-1216）')
                .setRequired(false)
                .setMinValue(64)
                .setMaxValue(1216))
        .addIntegerOption(option =>
            option.setName('height')
                .setDescription('自定义高度（64-1216）')
                .setRequired(false)
                .setMinValue(64)
                .setMaxValue(1216))
        .addIntegerOption(option =>
            option.setName('steps')
                .setDescription('采样步数（默认28）')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(50))
        .addNumberOption(option =>
            option.setName('cfg')
                .setDescription('CFG Scale（默认5）')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(20))
        .addStringOption(option =>
            option.setName('sampler')
                .setDescription('采样器')
                .setRequired(false)
                .addChoices(
                    { name: 'Euler', value: 'k_euler' },
                    { name: 'Euler Ancestral (默认)', value: 'k_euler_ancestral' },
                    { name: 'DPM++ 2M', value: 'k_dpmpp_2m' },
                    { name: 'DPM++ 2S Ancestral', value: 'k_dpmpp_2s_ancestral' },
                    { name: 'DPM++ SDE', value: 'k_dpmpp_sde' },
                    { name: 'DDIM V3', value: 'ddim_v3' }
                ))
        .addIntegerOption(option =>
            option.setName('seed')
                .setDescription('随机种子')
                .setRequired(false)
                .setMinValue(0))
        .addBooleanOption(option =>
            option.setName('quality_tags')
                .setDescription('是否添加质量标签（默认true）')
                .setRequired(false))
        .addNumberOption(option =>
            option.setName('smea')
                .setDescription('SMEA强度（0-1）')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(1))
        .addNumberOption(option =>
            option.setName('dyn')
                .setDescription('DYN强度（0-1）')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(1)),
];

// 部署命令
async function deployCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        console.log('🔄 开始注册斜杠命令...');
        
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log('✅ 斜杠命令注册成功！');
    } catch (error) {
        console.error('❌ 注册命令时出错:', error);
    }
}

// 生成图片函数
async function generateImage(params) {
    const {
        prompt,
        negative_prompt = '',
        model = 'nai-diffusion-3',
        width = 512,
        height = 768,
        steps = 28,
        cfg = 5,
        sampler = 'k_euler_ancestral',
        seed = Math.floor(Math.random() * 2147483647),
        quality_tags = true,
        smea = 0,
        dyn = 0
    } = params;

    // 添加质量标签
    let finalPrompt = prompt;
    if (quality_tags) {
        finalPrompt = `masterpiece, best quality, ${prompt}`;
    }

    let finalNegative = negative_prompt;
    if (quality_tags) {
        finalNegative = `lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, ${negative_prompt}`;
    }

    const payload = {
        input: finalPrompt,
        model: model,
        action: 'generate',
        parameters: {
            width: width,
            height: height,
            scale: cfg,
            sampler: sampler,
            steps: steps,
            seed: seed,
            n_samples: 1,
            ucPreset: 0,
            qualityToggle: false,
            sm: smea > 0,
            sm_dyn: dyn > 0,
            dynamic_thresholding: false,
            controlnet_strength: 1,
            legacy: false,
            add_original_image: false,
            negative_prompt: finalNegative,
            smea: smea,
            dyn: dyn
        }
    };

    try {
        const response = await axios.post(NAI_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${NAI_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            responseType: 'arraybuffer'
        });

        // NAI返回的是zip文件，需要解析
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(response.data);
        
        // 获取第一个图片文件
        const files = Object.keys(zip.files);
        const imageFile = files.find(f => f.endsWith('.png'));
        
        if (imageFile) {
            const imageData = await zip.files[imageFile].async('nodebuffer');
            return imageData;
        }
        
        throw new Error('未找到生成的图片');
    } catch (error) {
        console.error('生成图片时出错:', error);
        throw error;
    }
}

// 处理交互命令
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'nai') {
        await interaction.deferReply();

        try {
            const prompt = interaction.options.getString('prompt');
            const negative = interaction.options.getString('negative') || '';
            const model = interaction.options.getString('model') || 'nai-diffusion-3';
            const sizePreset = interaction.options.getString('size');
            const customWidth = interaction.options.getInteger('width');
            const customHeight = interaction.options.getInteger('height');
            const steps = interaction.options.getInteger('steps') || 28;
            const cfg = interaction.options.getNumber('cfg') || 5;
            const sampler = interaction.options.getString('sampler') || 'k_euler_ancestral';
            const seed = interaction.options.getInteger('seed') || Math.floor(Math.random() * 2147483647);
            const qualityTags = interaction.options.getBoolean('quality_tags') ?? true;
            const smea = interaction.options.getNumber('smea') || 0;
            const dyn = interaction.options.getNumber('dyn') || 0;

            // 确定尺寸
            let width, height;
            if (customWidth && customHeight) {
                width = customWidth;
                height = customHeight;
            } else if (sizePreset && SIZE_PRESETS[sizePreset]) {
                width = SIZE_PRESETS[sizePreset].width;
                height = SIZE_PRESETS[sizePreset].height;
            } else {
                width = 512;
                height = 768;
            }

            // 检查尺寸限制
            const totalPixels = width * height;
            if (totalPixels > SIZE_LIMITS.maxPixels) {
                await interaction.editReply(
                    `❌ **尺寸超出限制！**\n` +
                    `📏 请求: ${width}×${height} = ${totalPixels.toLocaleString()} 像素\n` +
                    `⚠️ 最大: 1216×832 = 1,012,352 像素`
                );
                return;
            }

            console.log(`🎨 生成中: ${width}×${height}, Model: ${model}`);

            const imageBuffer = await generateImage({
                prompt,
                negative_prompt: negative,
                model,
                width,
                height,
                steps,
                cfg,
                sampler,
                seed,
                quality_tags: qualityTags,
                smea,
                dyn
            });

            const attachment = new AttachmentBuilder(imageBuffer, { name: `nai_${Date.now()}.png` });

            const orientation = width > height ? '🖼️ 横版' : (width < height ? '📱 竖版' : '⬜ 方形');
            const replyContent = {
                content: `✨ **图片生成完成！**\n` +
                        `${orientation} **尺寸:** ${width}×${height}\n` +
                        `📝 **提示词:** ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}\n` +
                        `🎯 **模型:** ${MODELS[model]}\n` +
                        `⚙️ **参数:** Steps: ${steps} | CFG: ${cfg} | Sampler: ${sampler}\n` +
                        `🌱 **种子:** ${seed}`,
                files: [attachment]
            };

            await interaction.editReply(replyContent);
            console.log(`✅ 生成成功！种子: ${seed}`);

        } catch (error) {
            console.error('❌ 处理命令时出错:', error);
            let errorMessage = '❌ **生成图片时出错**\n';
            
            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage += '🔑 API密钥无效或过期';
                } else if (error.response.status === 402) {
                    errorMessage += '💰 Anlas余额不足';
                } else {
                    errorMessage += `🚫 API错误: ${error.response.status}`;
                }
            } else {
                errorMessage += '⚠️ 未知错误，请稍后重试';
            }
            
            await interaction.editReply(errorMessage);
        }
    }
});

// 机器人就绪
client.once('ready', () => {
    console.log(`✅ 机器人已登录: ${client.user.tag}`);
    deployCommands();
    
    client.user.setPresence({
        activities: [{ name: '/nai - AI绘图', type: 2 }],
        status: 'online'
    });
});

// 错误处理
client.on('error', error => {
    console.error('Discord客户端错误:', error);
});

process.on('unhandledRejection', error => {
    console.error('未处理的错误:', error);
});

// 登录
console.log('🚀 正在启动机器人...');
client.login(DISCORD_TOKEN).catch(error => {
    console.error('❌ 登录失败:', error.message);
    process.exit(1);
});

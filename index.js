const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

// 环境变量
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const NAI_API_KEY = process.env.NAI_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;

// NAI API配置 - 正确的地址
const NAI_API_BASE = 'https://image.novelai.net';
const NAI_API_GENERATE = NAI_API_BASE + '/ai/generate-image';

// Discord客户端
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// 尺寸限制
const SIZE_LIMITS = { maxPixels: 1216 * 832 };

// 预设尺寸
const SIZE_PRESETS = {
    'portrait_s': { width: 512, height: 768 },
    'portrait_m': { width: 832, height: 1216 },
    'landscape_s': { width: 768, height: 512 },
    'landscape_m': { width: 1216, height: 832 },
    'square_s': { width: 512, height: 512 },
    'square_m': { width: 768, height: 768 },
    'square_l': { width: 1024, height: 1024 }
};

// 最新模型列表 (2025年9月)
const MODELS = {
    'nai-diffusion-4_5-full': 'V4.5 Full 最新',
    'nai-diffusion-4_5-curated': 'V4.5 Curated',
    'nai-diffusion-4-full': 'V4 Full',
    'nai-diffusion-4-curated': 'V4 Curated',
    'nai-diffusion-3': 'V3 Anime',
    'nai-diffusion-3-inpainting': 'V3 Inpainting',
    'nai-diffusion-2': 'V2 Anime',
    'nai-diffusion': 'V1 Anime',
    'safe-diffusion': 'V1 Curated',
    'nai-diffusion-furry': 'V1 Furry',
    'nai-diffusion-furry-v3': 'V3 Furry'
};

// 采样器
const SAMPLERS = {
    'k_euler': 'Euler',
    'k_euler_ancestral': 'Euler Ancestral',
    'k_dpmpp_2s_ancestral': 'DPM++ 2S Ancestral',
    'k_dpmpp_2m': 'DPM++ 2M',
    'k_dpmpp_sde': 'DPM++ SDE',
    'k_dpm_2': 'DPM2',
    'k_dpm_2_ancestral': 'DPM2 Ancestral',
    'ddim_v3': 'DDIM V3'
};

// 注册命令
const commands = [
    new SlashCommandBuilder()
        .setName('nai')
        .setDescription('使用NovelAI生成图片')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('正向提示词')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('model')
                .setDescription('选择模型')
                .setRequired(false)
                .addChoices(
                    { name: '🌟 V4.5 Full (最新最强)', value: 'nai-diffusion-4_5-full' },
                    { name: '✨ V4.5 Curated', value: 'nai-diffusion-4_5-curated' },
                    { name: '🎯 V4 Full', value: 'nai-diffusion-4-full' },
                    { name: '📌 V4 Curated', value: 'nai-diffusion-4-curated' },
                    { name: '🎨 V3 Anime (推荐)', value: 'nai-diffusion-3' },
                    { name: '🔧 V3 Inpainting', value: 'nai-diffusion-3-inpainting' },
                    { name: '🌸 V2 Anime', value: 'nai-diffusion-2' },
                    { name: '🦊 V3 Furry', value: 'nai-diffusion-furry-v3' }
                ))
        .addStringOption(option =>
            option.setName('negative')
                .setDescription('负向提示词')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('size')
                .setDescription('尺寸预设')
                .setRequired(false)
                .addChoices(
                    { name: '竖图 832×1216', value: 'portrait_m' },
                    { name: '横图 1216×832', value: 'landscape_m' },
                    { name: '方图 512×512', value: 'square_s' },
                    { name: '方图 768×768', value: 'square_m' },
                    { name: '方图 1024×1024', value: 'square_l' }
                ))
        .addIntegerOption(option =>
            option.setName('width')
                .setDescription('自定义宽度')
                .setRequired(false)
                .setMinValue(64)
                .setMaxValue(1216))
        .addIntegerOption(option =>
            option.setName('height')
                .setDescription('自定义高度')
                .setRequired(false)
                .setMinValue(64)
                .setMaxValue(1216))
        .addIntegerOption(option =>
            option.setName('steps')
                .setDescription('步数（V4默认28）')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(50))
        .addNumberOption(option =>
            option.setName('cfg')
                .setDescription('CFG（V4默认4，V3默认5）')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(20))
        .addStringOption(option =>
            option.setName('sampler')
                .setDescription('采样器')
                .setRequired(false)
                .addChoices(
                    { name: 'Euler Ancestral (推荐)', value: 'k_euler_ancestral' },
                    { name: 'DPM++ 2M (V3推荐)', value: 'k_dpmpp_2m' },
                    { name: 'DPM++ 2S Ancestral', value: 'k_dpmpp_2s_ancestral' },
                    { name: 'Euler', value: 'k_euler' },
                    { name: 'DPM++ SDE', value: 'k_dpmpp_sde' },
                    { name: 'DDIM V3', value: 'ddim_v3' }
                ))
        .addIntegerOption(option =>
            option.setName('seed')
                .setDescription('种子（-1随机）')
                .setRequired(false)
                .setMinValue(-1))
        .addBooleanOption(option =>
            option.setName('smea')
                .setDescription('SMEA（V3高分辨率推荐，V4不需要）')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('dyn')
                .setDescription('SMEA DYN（增强细节）')
                .setRequired(false))
];

// 部署命令
async function deployCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        console.log('🔄 注册命令中...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('✅ 命令注册成功！');
    } catch (error) {
        console.error('❌ 注册失败:', error);
    }
}

// 生成图片
async function generateImage(params) {
    const {
        prompt,
        negative_prompt = '',
        model = 'nai-diffusion-3',
        width = 832,
        height = 1216,
        steps = 28,
        cfg = 5,
        sampler = 'k_euler_ancestral',
        seed = -1,
        smea = false,
        dyn = false
    } = params;

    const actualSeed = seed === -1 ? Math.floor(Math.random() * 2147483647) : seed;
    
    // V4模型使用不同的质量标签格式
    let finalPrompt = prompt;
    let finalNegative = negative_prompt;
    
    if (model.includes('4')) {
        // V4/V4.5 使用{}格式
        finalPrompt = '{best quality}, {masterpiece}, ' + prompt;
        finalNegative = '{worst quality}, {bad quality}, ' + negative_prompt;
    } else {
        // V1-V3 使用普通格式
        finalPrompt = 'masterpiece, best quality, ' + prompt;
        finalNegative = 'lowres, bad anatomy, bad hands, text, error, ' + negative_prompt;
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
            seed: actualSeed,
            n_samples: 1,
            ucPreset: 0,
            qualityToggle: false,
            sm: smea && !model.includes('4'), // V4不支持SMEA
            sm_dyn: dyn && !model.includes('4'),
            dynamic_thresholding: false,
            controlnet_strength: 1,
            legacy: false,
            add_original_image: false,
            negative_prompt: finalNegative
        }
    };

    // V3特有参数
    if (model === 'nai-diffusion-3' && smea) {
        payload.parameters.smea = smea ? 0.12 : 0;
        payload.parameters.dyn = dyn ? 1 : 0;
    }

    // V4使用Karras调度器
    if (model.includes('4')) {
        payload.parameters.noise_schedule = 'karras';
    }

    console.log('📤 请求NAI:', NAI_API_GENERATE);
    console.log('📦 模型:', model);

    try {
        const response = await axios.post(NAI_API_GENERATE, payload, {
            headers: {
                'Authorization': 'Bearer ' + NAI_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/zip'
            },
            responseType: 'arraybuffer',
            timeout: 60000
        });

        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(response.data);
        const files = Object.keys(zip.files);
        const imageFile = files.find(f => f.endsWith('.png'));
        
        if (imageFile) {
            const imageData = await zip.files[imageFile].async('nodebuffer');
            return { buffer: imageData, seed: actualSeed };
        }
        throw new Error('未找到图片');
    } catch (error) {
        console.error('❌ 生成失败:', error.message);
        if (error.response) {
            console.error('状态码:', error.response.status);
        }
        throw error;
    }
}

// 处理命令
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'nai') return;

    await interaction.deferReply();

    try {
        const prompt = interaction.options.getString('prompt');
        const negative = interaction.options.getString('negative') || '';
        const model = interaction.options.getString('model') || 'nai-diffusion-3';
        const sizePreset = interaction.options.getString('size');
        const customWidth = interaction.options.getInteger('width');
        const customHeight = interaction.options.getInteger('height');
        const steps = interaction.options.getInteger('steps') || (model.includes('4') ? 28 : 28);
        const cfg = interaction.options.getNumber('cfg') || (model.includes('4') ? 4 : 5);
        const sampler = interaction.options.getString('sampler') || 'k_euler_ancestral';
        const seed = interaction.options.getInteger('seed') || -1;
        const smea = interaction.options.getBoolean('smea') || false;
        const dyn = interaction.options.getBoolean('dyn') || false;

        let width, height;
        if (customWidth && customHeight) {
            width = customWidth;
            height = customHeight;
        } else if (sizePreset && SIZE_PRESETS[sizePreset]) {
            width = SIZE_PRESETS[sizePreset].width;
            height = SIZE_PRESETS[sizePreset].height;
        } else {
            width = 832;
            height = 1216;
        }

        // 检查尺寸
        if (width * height > SIZE_LIMITS.maxPixels) {
            await interaction.editReply('❌ 尺寸超限！最大1216×832');
            return;
        }

        console.log('🎨 生成中:', width + 'x' + height, '模型:', model);

        const result = await generateImage({
            prompt, negative_prompt: negative, model,
            width, height, steps, cfg, sampler, seed, smea, dyn
        });

        const attachment = new AttachmentBuilder(result.buffer, { 
            name: 'nai_' + result.seed + '.png' 
        });

        const info = '✨ **生成完成！**\n' +
                    '📐 ' + width + '×' + height + '\n' +
                    '🎯 ' + (MODELS[model] || model) + '\n' +
                    '⚙️ Steps:' + steps + ' CFG:' + cfg + '\n' +
                    '🌱 种子:' + result.seed;

        await interaction.editReply({ content: info, files: [attachment] });

    } catch (error) {
        console.error('❌ 错误:', error);
        let msg = '❌ 生成失败\n';
        if (error.response?.status === 401) msg += '密钥无效';
        else if (error.response?.status === 402) msg += 'Anlas不足';
        else if (error.response?.status === 404) msg += 'API错误';
        else msg += error.message;
        await interaction.editReply(msg);
    }
});

// 启动
client.once('clientReady', () => {
    console.log('✅ 已登录:', client.user.tag);
    deployCommands();
    client.user.setPresence({
        activities: [{ name: '/nai - AI绘图', type: 2 }],
        status: 'online'
    });
});

client.on('error', error => console.error('错误:', error));
process.on('unhandledRejection', error => console.error('未处理错误:', error));

console.log('🚀 启动中...');
client.login(DISCORD_TOKEN).catch(error => {
    console.error('❌ 登录失败:', error.message);
    process.exit(1);
});

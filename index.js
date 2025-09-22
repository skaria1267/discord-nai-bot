const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

// 环境变量
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const NAI_API_KEY = process.env.NAI_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;

// NAI API配置
const NAI_API_BASE = 'https://image.novelai.net';

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
    'portrait_l': { width: 1024, height: 1536 },
    'landscape_s': { width: 768, height: 512 },
    'landscape_m': { width: 1216, height: 832 },
    'landscape_l': { width: 1536, height: 1024 },
    'square_s': { width: 512, height: 512 },
    'square_m': { width: 768, height: 768 },
    'square_l': { width: 1024, height: 1024 }
};

// 所有可能的模型名称
const POSSIBLE_MODELS = [
    // V4.5系列（尝试各种可能的命名）
    'nai-diffusion-4.5-full',
    'nai-diffusion-4.5-curated',
    'nai-diffusion-4.5',
    'nai-diffusion-45-full',
    'nai-diffusion-45-curated',
    'nai-diffusion-45',
    'nai_diffusion_4_5_full',
    'nai_diffusion_4_5_curated',
    'v4.5-full',
    'v4.5-curated',
    'v4.5',
    'v45',
    
    // V4系列
    'nai-diffusion-4-full',
    'nai-diffusion-4-curated-preview',
    'nai-diffusion-4-curated',
    'nai-diffusion-4',
    'nai_diffusion_4_full',
    'nai_diffusion_4_curated_preview',
    'v4-full',
    'v4-curated',
    'v4',
    
    // V3系列（确认可用）
    'nai-diffusion-3',
    'nai-diffusion-3-inpainting',
    'nai_diffusion_3',
    'v3',
    
    // V2系列
    'nai-diffusion-2',
    'nai_diffusion_2',
    'v2',
    
    // V1系列
    'nai-diffusion',
    'safe-diffusion',
    'nai-diffusion-furry',
    'nai-diffusion-furry-v3',
    'v1'
];

// 可用模型缓存
let availableModels = {};

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
                .setDescription('模型名称（留空用默认）')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('negative')
                .setDescription('负向提示词')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('size')
                .setDescription('尺寸预设')
                .setRequired(false)
                .addChoices(
                    { name: '📱 竖图 832×1216', value: 'portrait_m' },
                    { name: '🖼️ 横图 1216×832', value: 'landscape_m' },
                    { name: '⬜ 方图 512×512', value: 'square_s' },
                    { name: '◻️ 方图 768×768', value: 'square_m' },
                    { name: '◼ 方图 1024×1024', value: 'square_l' }
                ))
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
                    { name: 'Euler Ancestral (推荐)', value: 'k_euler_ancestral' },
                    { name: 'DPM++ 2M', value: 'k_dpmpp_2m' },
                    { name: 'Euler', value: 'k_euler' }
                ))
        .addBooleanOption(option =>
            option.setName('smea')
                .setDescription('启用SMEA')
                .setRequired(false)),
    
    // 探测模型命令
    new SlashCommandBuilder()
        .setName('nai_models')
        .setDescription('探测所有可用的NAI模型'),
    
    // 测试API命令
    new SlashCommandBuilder()
        .setName('nai_test')
        .setDescription('测试NAI API连接')
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

// 测试单个模型
async function testModel(modelName) {
    try {
        const payload = {
            input: 'test',
            model: modelName,
            action: 'generate',
            parameters: {
                width: 64,
                height: 64,
                scale: 5,
                sampler: 'k_euler',
                steps: 1,
                seed: 12345,
                n_samples: 1,
                ucPreset: 0,
                negative_prompt: ''
            }
        };

        const response = await axios.post(NAI_API_BASE + '/ai/generate-image', payload, {
            headers: {
                'Authorization': 'Bearer ' + NAI_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 5000
        });
        
        return true;
    } catch (error) {
        if (error.response?.status === 400 && error.response?.data?.message?.includes('model')) {
            return false;
        }
        // 其他错误可能是API问题，不是模型问题
        if (error.response?.status === 402) {
            console.log('⚠️ Anlas不足，但模型可能有效:', modelName);
        }
        return false;
    }
}

// 探测所有模型
async function discoverModels() {
    console.log('🔍 开始探测NAI模型...');
    const found = {};
    
    for (const model of POSSIBLE_MODELS) {
        const isValid = await testModel(model);
        if (isValid) {
            console.log('✅ 发现可用模型:', model);
            found[model] = model;
        }
    }
    
    if (Object.keys(found).length === 0) {
        console.log('⚠️ 未找到可用模型，使用默认列表');
        found['nai-diffusion-3'] = 'V3 Anime';
        found['nai-diffusion-2'] = 'V2 Anime';
        found['nai-diffusion'] = 'V1 Anime';
    }
    
    availableModels = found;
    console.log('📦 可用模型:', Object.keys(availableModels).join(', '));
    return found;
}

// 测试API基础连接
async function testAPIConnection() {
    try {
        // 尝试生成一个最小的图片
        const response = await axios.post(NAI_API_BASE + '/ai/generate-image', {
            input: 'test',
            model: 'nai-diffusion-3',
            action: 'generate',
            parameters: {
                width: 64,
                height: 64,
                scale: 5,
                sampler: 'k_euler',
                steps: 1,
                seed: 12345,
                n_samples: 1,
                ucPreset: 0,
                negative_prompt: ''
            }
        }, {
            headers: {
                'Authorization': 'Bearer ' + NAI_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        return { success: true, status: response.status };
    } catch (error) {
        return { 
            success: false, 
            status: error.response?.status,
            message: error.response?.statusText || error.message
        };
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
    
    // 质量标签
    let finalPrompt = 'masterpiece, best quality, ' + prompt;
    let finalNegative = negative_prompt || 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';

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
            sm: smea,
            sm_dyn: dyn,
            dynamic_thresholding: false,
            controlnet_strength: 1,
            legacy: false,
            add_original_image: false,
            negative_prompt: finalNegative
        }
    };

    console.log('📤 生成请求 模型:', model);

    try {
        const response = await axios.post(NAI_API_BASE + '/ai/generate-image', payload, {
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
        console.error('❌ 生成失败:', error.response?.status || error.message);
        throw error;
    }
}

// 处理交互
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // 测试API
    if (interaction.commandName === 'nai_test') {
        await interaction.deferReply();
        const result = await testAPIConnection();
        if (result.success) {
            await interaction.editReply('✅ NAI API连接成功！');
        } else {
            let msg = '❌ NAI API连接失败！\n';
            if (result.status === 401) msg += '🔑 API密钥无效';
            else if (result.status === 402) msg += '💰 Anlas余额不足';
            else if (result.status === 404) msg += '🔍 API端点错误';
            else msg += '错误: ' + result.message;
            await interaction.editReply(msg);
        }
        return;
    }

    // 探测模型
    if (interaction.commandName === 'nai_models') {
        await interaction.deferReply();
        await interaction.editReply('🔍 正在探测所有可用模型，请稍候...');
        
        const models = await discoverModels();
        const modelList = Object.keys(models);
        
        if (modelList.length > 0) {
            await interaction.editReply('✅ **发现 ' + modelList.length + ' 个可用模型：**\n```\n' + modelList.join('\n') + '\n```');
        } else {
            await interaction.editReply('❌ 未找到可用模型，请检查API密钥');
        }
        return;
    }

    // 主命令
    if (interaction.commandName === 'nai') {
        await interaction.deferReply();

        try {
            const prompt = interaction.options.getString('prompt');
            const model = interaction.options.getString('model') || 'nai-diffusion-3';
            const negative = interaction.options.getString('negative') || '';
            const sizePreset = interaction.options.getString('size');
            const steps = interaction.options.getInteger('steps') || 28;
            const cfg = interaction.options.getNumber('cfg') || 5;
            const sampler = interaction.options.getString('sampler') || 'k_euler_ancestral';
            const smea = interaction.options.getBoolean('smea') || false;

            let width = 832, height = 1216;
            if (sizePreset && SIZE_PRESETS[sizePreset]) {
                width = SIZE_PRESETS[sizePreset].width;
                height = SIZE_PRESETS[sizePreset].height;
            }

            const result = await generateImage({
                prompt, negative_prompt: negative, model,
                width, height, steps, cfg, sampler, smea
            });

            const attachment = new AttachmentBuilder(result.buffer, { 
                name: 'nai_' + result.seed + '.png' 
            });

            const info = '✨ **生成完成！**\n' +
                        '📐 ' + width + '×' + height + '\n' +
                        '🎯 模型: ' + model + '\n' +
                        '⚙️ Steps: ' + steps + ' | CFG: ' + cfg + '\n' +
                        '🌱 种子: ' + result.seed;

            await interaction.editReply({ content: info, files: [attachment] });

        } catch (error) {
            let msg = '❌ **生成失败**\n';
            if (error.response?.status === 400) {
                msg += '⚠️ 模型名称可能不正确\n';
                msg += '请运行 /nai_models 探测可用模型';
            } else if (error.response?.status === 401) {
                msg += '🔑 API密钥无效';
            } else if (error.response?.status === 402) {
                msg += '💰 Anlas余额不足';
            } else {
                msg += error.message;
            }
            await interaction.editReply(msg);
        }
    }
});

// 启动
client.once('clientReady', () => {
    console.log('✅ 已登录:', client.user.tag);
    deployCommands();
    
    // 启动时探测模型
    setTimeout(() => {
        discoverModels().catch(console.error);
    }, 2000);
});

client.on('error', error => console.error('错误:', error));
process.on('unhandledRejection', error => console.error('未处理错误:', error));

console.log('🚀 启动中...');
client.login(DISCORD_TOKEN).catch(error => {
    console.error('❌ 登录失败:', error.message);
    process.exit(1);
});

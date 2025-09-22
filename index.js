const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

// 环境变量
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const NAI_API_KEY = process.env.NAI_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;

// NAI API配置
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
    'portrait_l': { width: 1024, height: 1536 },
    'landscape_s': { width: 768, height: 512 },
    'landscape_m': { width: 1216, height: 832 },
    'landscape_l': { width: 1536, height: 1024 },
    'square_s': { width: 512, height: 512 },
    'square_m': { width: 768, height: 768 },
    'square_l': { width: 1024, height: 1024 }
};

// 正确的模型名称（基于API实际格式）
const MODELS = {
    // 主要模型
    'nai-diffusion-3': 'V3 Anime (主力)',
    'nai-diffusion-2': 'V2 Anime',
    'nai-diffusion': 'V1 Anime',
    'safe-diffusion': 'V1 Curated',
    'nai-diffusion-furry': 'V1 Furry',
    'nai-diffusion-3-inpainting': 'V3 Inpainting',
    
    // V4模型（可能的名称）
    'nai-diffusion-4-curated-preview': 'V4 Curated Preview',
    'nai-diffusion-4': 'V4',
    
    // 尝试的V4.5名称
    'nai-diffusion-4.5-curated': 'V4.5 Curated',
    'nai-diffusion-4.5': 'V4.5',
    'nai-diffusion-45-curated': 'V4.5 Curated (无点)',
    'nai-diffusion-45': 'V4.5 (无点)'
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
    'k_dpm_adaptive': 'DPM Adaptive',
    'k_dpm_fast': 'DPM Fast',
    'ddim_v3': 'DDIM V3',
    'ddim': 'DDIM'
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
                .setDescription('选择模型（如果V4报错请用V3）')
                .setRequired(false)
                .addChoices(
                    { name: '🎨 V3 Anime (推荐)', value: 'nai-diffusion-3' },
                    { name: '📌 V4 Preview (测试)', value: 'nai-diffusion-4-curated-preview' },
                    { name: '🆕 V4.5 Curated (尝试)', value: 'nai-diffusion-4.5-curated' },
                    { name: '🌸 V2 Anime', value: 'nai-diffusion-2' },
                    { name: '🎯 V1 Anime', value: 'nai-diffusion' },
                    { name: '🔧 V3 Inpainting', value: 'nai-diffusion-3-inpainting' },
                    { name: '✅ V1 Curated', value: 'safe-diffusion' },
                    { name: '🦊 V1 Furry', value: 'nai-diffusion-furry' }
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
                    { name: 'DPM++ 2M (稳定)', value: 'k_dpmpp_2m' },
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
                .setDescription('启用SMEA（V3高分辨率推荐）')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('dyn')
                .setDescription('启用SMEA DYN（增强细节）')
                .setRequired(false)),
    
    // 测试命令
    new SlashCommandBuilder()
        .setName('nai_test')
        .setDescription('测试NAI连接和模型'),
    
    // 尝试模型命令
    new SlashCommandBuilder()
        .setName('nai_try')
        .setDescription('尝试不同的模型名称')
        .addStringOption(option =>
            option.setName('model')
                .setDescription('输入模型名称尝试')
                .setRequired(true))
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

// 测试API连接
async function testNAIConnection() {
    try {
        console.log('🔍 测试NAI API连接...');
        const response = await axios.get(NAI_API_BASE + '/user/information', {
            headers: {
                'Authorization': 'Bearer ' + NAI_API_KEY,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        return { success: true, data: response.data };
    } catch (error) {
        return { 
            success: false, 
            error: error.response?.status || error.message 
        };
    }
}

// 生成图片（带详细日志）
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
    
    // 根据模型选择提示词格式
    let finalPrompt = prompt;
    let finalNegative = negative_prompt || '';
    
    // 添加质量标签
    if (model.includes('3') || model.includes('2') || model === 'nai-diffusion') {
        // V1-V3使用普通格式
        finalPrompt = 'masterpiece, best quality, ' + prompt;
        if (!finalNegative) {
            finalNegative = 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';
        }
    } else if (model.includes('4')) {
        // V4/V4.5使用花括号格式
        finalPrompt = '{best quality}, {masterpiece}, ' + prompt;
        if (!finalNegative) {
            finalNegative = '{worst quality}, {bad quality}, text, signature, watermark';
        }
    }

    // 构建请求
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
            sm: smea && !model.includes('4'),
            sm_dyn: dyn && !model.includes('4'),
            dynamic_thresholding: false,
            controlnet_strength: 1,
            legacy: false,
            add_original_image: false,
            negative_prompt: finalNegative
        }
    };

    // V3特有SMEA参数
    if (model === 'nai-diffusion-3' && smea) {
        payload.parameters.smea = 0.12;
        payload.parameters.dyn = dyn ? 1.0 : 0;
    }

    // V4可能需要的参数
    if (model.includes('4')) {
        payload.parameters.noise_schedule = 'karras';
        payload.parameters.params_version = 3;
    }

    console.log('📤 发送请求到:', NAI_API_GENERATE);
    console.log('📦 使用模型:', model);
    console.log('⚙️ 参数:', JSON.stringify(payload.parameters, null, 2));

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

        console.log('✅ 收到响应，解析中...');
        const JSZip = require('jszip');
        const zip = await JSZip.loadAsync(response.data);
        const files = Object.keys(zip.files);
        const imageFile = files.find(f => f.endsWith('.png'));
        
        if (imageFile) {
            const imageData = await zip.files[imageFile].async('nodebuffer');
            return { buffer: imageData, seed: actualSeed, model: model };
        }
        throw new Error('未找到图片');
    } catch (error) {
        console.error('❌ 生成失败:', error.message);
        if (error.response) {
            console.error('状态码:', error.response.status);
            console.error('响应:', error.response.statusText);
            // 尝试解析错误信息
            try {
                const errorText = error.response.data.toString('utf-8');
                console.error('错误详情:', errorText);
            } catch (e) {}
        }
        throw error;
    }
}

// 处理命令
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // 测试命令
    if (interaction.commandName === 'nai_test') {
        await interaction.deferReply();
        const test = await testNAIConnection();
        if (test.success) {
            await interaction.editReply('✅ NAI API连接成功！\n可用模型请尝试：\n- nai-diffusion-3 (V3)\n- nai-diffusion-2 (V2)\n- nai-diffusion (V1)');
        } else {
            await interaction.editReply('❌ NAI API连接失败！\n错误：' + test.error);
        }
        return;
    }

    // 尝试模型命令
    if (interaction.commandName === 'nai_try') {
        await interaction.deferReply();
        const modelName = interaction.options.getString('model');
        
        try {
            console.log('🧪 尝试模型:', modelName);
            const result = await generateImage({
                prompt: 'test',
                model: modelName,
                width: 512,
                height: 512,
                steps: 1
            });
            await interaction.editReply('✅ 模型 ' + modelName + ' 可用！');
        } catch (error) {
            await interaction.editReply('❌ 模型 ' + modelName + ' 不可用\n错误：' + (error.response?.status || error.message));
        }
        return;
    }

    // 主命令
    if (interaction.commandName === 'nai') {
        await interaction.deferReply();

        try {
            const prompt = interaction.options.getString('prompt');
            const negative = interaction.options.getString('negative') || '';
            const model = interaction.options.getString('model') || 'nai-diffusion-3';
            const sizePreset = interaction.options.getString('size');
            const steps = interaction.options.getInteger('steps') || 28;
            const cfg = interaction.options.getNumber('cfg') || 5;
            const sampler = interaction.options.getString('sampler') || 'k_euler_ancestral';
            const seed = interaction.options.getInteger('seed') || -1;
            const smea = interaction.options.getBoolean('smea') || false;
            const dyn = interaction.options.getBoolean('dyn') || false;

            // 确定尺寸
            let width = 832, height = 1216;
            if (sizePreset && SIZE_PRESETS[sizePreset]) {
                width = SIZE_PRESETS[sizePreset].width;
                height = SIZE_PRESETS[sizePreset].height;
            }

            // 检查尺寸
            if (width * height > SIZE_LIMITS.maxPixels) {
                await interaction.editReply('❌ 尺寸超限！最大1216×832');
                return;
            }

            console.log('🎨 开始生成...');
            const result = await generateImage({
                prompt, negative_prompt: negative, model,
                width, height, steps, cfg, sampler, seed, smea, dyn
            });

            const attachment = new AttachmentBuilder(result.buffer, { 
                name: 'nai_' + result.seed + '.png' 
            });

            const modelName = MODELS[model] || model;
            const info = '✨ **生成完成！**\n' +
                        '📐 尺寸：' + width + '×' + height + '\n' +
                        '🎯 模型：' + modelName + '\n' +
                        '⚙️ 参数：Steps ' + steps + ' | CFG ' + cfg + '\n' +
                        '🌱 种子：' + result.seed;

            await interaction.editReply({ content: info, files: [attachment] });
            console.log('✅ 发送成功');

        } catch (error) {
            console.error('❌ 错误:', error);
            let msg = '❌ **生成失败**\n';
            
            if (error.response?.status === 400) {
                msg += '⚠️ 参数错误（可能是模型名称不正确）\n';
                msg += '请尝试使用 V3 模型或运行 /nai_test 检查连接';
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
    testNAIConnection().then(result => {
        if (result.success) {
            console.log('✅ NAI API连接正常');
        } else {
            console.log('⚠️ NAI API连接失败:', result.error);
        }
    });
});

client.on('error', error => console.error('错误:', error));
process.on('unhandledRejection', error => console.error('未处理错误:', error));

console.log('🚀 启动中...');
client.login(DISCORD_TOKEN).catch(error => {
    console.error('❌ 登录失败:', error.message);
    process.exit(1);
});

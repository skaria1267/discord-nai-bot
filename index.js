const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const NAI_API_KEY = process.env.NAI_API_KEY;
const CLIENT_ID = process.env.CLIENT_ID;

const NAI_API_BASE = 'https://image.novelai.net';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const SIZE_LIMITS = { 
    maxPixels: 832 * 1216,
    maxWidth: 1216,
    maxHeight: 1216
};

const SIZE_PRESETS = {
    'portrait_s': { width: 512, height: 768 },
    'portrait_m': { width: 832, height: 1216 },
    'landscape_s': { width: 768, height: 512 },
    'landscape_m': { width: 1216, height: 832 },
    'square_s': { width: 512, height: 512 },
    'square_m': { width: 768, height: 768 },
    'square_l': { width: 832, height: 832 }
};

const MODELS = {
    'nai-diffusion-4-5-full': '🌟 V4.5 Full',
    'nai-diffusion-4-5-curated': '✨ V4.5 Curated',
    'nai-diffusion-4-full': '🎯 V4 Full',
    'nai-diffusion-4-curated': '📌 V4 Curated',
    'nai-diffusion-4-curated-preview': '👁️ V4 Preview',
    'nai-diffusion-3': '🎨 V3 Anime',
    'nai-diffusion-3-inpainting': '🔧 V3 Inpainting',
    'nai-diffusion-2': '🌸 V2 Anime',
    'nai-diffusion': '🎯 V1 Anime',
    'safe-diffusion': '✅ V1 Curated',
    'nai-diffusion-furry': '🦊 V1 Furry',
    'nai-diffusion-furry-v3': '🐺 V3 Furry'
};

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
                    { name: '🌟 V4.5 Full', value: 'nai-diffusion-4-5-full' },
                    { name: '✨ V4.5 Curated', value: 'nai-diffusion-4-5-curated' },
                    { name: '🎯 V4 Full', value: 'nai-diffusion-4-full' },
                    { name: '📌 V4 Curated', value: 'nai-diffusion-4-curated' },
                    { name: '👁️ V4 Preview', value: 'nai-diffusion-4-curated-preview' },
                    { name: '🎨 V3 Anime', value: 'nai-diffusion-3' },
                    { name: '🔧 V3 Inpainting', value: 'nai-diffusion-3-inpainting' },
                    { name: '🌸 V2 Anime', value: 'nai-diffusion-2' },
                    { name: '🎯 V1 Anime', value: 'nai-diffusion' },
                    { name: '✅ V1 Curated', value: 'safe-diffusion' },
                    { name: '🦊 V1 Furry', value: 'nai-diffusion-furry' },
                    { name: '🐺 V3 Furry', value: 'nai-diffusion-furry-v3' }
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
                    { name: '📱 竖图小 512×768', value: 'portrait_s' },
                    { name: '🖼️ 横图 1216×832', value: 'landscape_m' },
                    { name: '🖼️ 横图小 768×512', value: 'landscape_s' },
                    { name: '⬜ 方图 512×512', value: 'square_s' },
                    { name: '◻️ 方图 768×768', value: 'square_m' },
                    { name: '◼ 方图 832×832', value: 'square_l' }
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
                .setDescription('采样步数')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(50))
        .addNumberOption(option =>
            option.setName('cfg')
                .setDescription('CFG/Guidance')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(20))
        .addStringOption(option =>
            option.setName('sampler')
                .setDescription('采样器')
                .setRequired(false)
                .addChoices(
                    { name: 'Euler Ancestral', value: 'k_euler_ancestral' },
                    { name: 'Euler', value: 'k_euler' },
                    { name: 'DPM++ 2M', value: 'k_dpmpp_2m' },
                    { name: 'DPM++ 2S Ancestral', value: 'k_dpmpp_2s_ancestral' },
                    { name: 'DPM++ SDE', value: 'k_dpmpp_sde' },
                    { name: 'DDIM V3', value: 'ddim_v3' }
                ))
        .addIntegerOption(option =>
            option.setName('seed')
                .setDescription('种子')
                .setRequired(false)
                .setMinValue(-1))
        .addBooleanOption(option =>
            option.setName('smea')
                .setDescription('SMEA')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('dyn')
                .setDescription('SMEA DYN')
                .setRequired(false))
];

async function deployCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Commands deployed');
    } catch (error) {
        console.error('Deploy error:', error);
    }
}

function buildV4Prompt(prompt, isNegative = false) {
    return {
        caption: {
            base_caption: prompt,
            char_captions: []
        },
        use_coords: true,
        use_order: true
    };
}

function getModelDefaults(model) {
    const base = {
        width: 832,
        height: 1216,
        scale: 5,
        sampler: 'k_euler_ancestral',
        steps: 28,
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: false,
        negative_prompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry'
    };
    
    if (model.startsWith('nai-diffusion-4')) {
        return {
            ...base,
            params_version: 3,
            use_coords: true,
            sm: false,
            sm_dyn: false,
            noise_schedule: 'karras',
            scale: 7.0
        };
    }
    
    return {
        ...base,
        sm: true,
        sm_dyn: true
    };
}

async function generateImage(params) {
    const {
        prompt,
        negative_prompt,
        model,
        width,
        height,
        steps,
        cfg,
        sampler,
        seed,
        smea,
        dyn
    } = params;

    const actualSeed = seed === -1 ? Math.floor(Math.random() * 2147483647) : seed;
    const defaults = getModelDefaults(model);
    
    let finalPrompt = prompt;
    let finalNegative = negative_prompt || defaults.negative_prompt;
    
    if (!model.startsWith('nai-diffusion-4')) {
        finalPrompt = 'masterpiece, best quality, ' + prompt;
    }

    const baseParams = {
        width: width,
        height: height,
        scale: cfg || defaults.scale,
        sampler: sampler || defaults.sampler,
        steps: steps || defaults.steps,
        seed: actualSeed,
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: false,
        dynamic_thresholding: false,
        controlnet_strength: 1,
        legacy: false,
        add_original_image: false,
        negative_prompt: finalNegative
    };

    let payload = {
        input: finalPrompt,
        model: model,
        action: 'generate',
        parameters: baseParams
    };

    if (model.startsWith('nai-diffusion-4')) {
        payload.parameters.params_version = 3;
        payload.parameters.use_coords = true;
        payload.parameters.sm = false;
        payload.parameters.sm_dyn = false;
        payload.parameters.noise_schedule = 'karras';
        
        payload.parameters.v4_prompt = buildV4Prompt(finalPrompt);
        payload.parameters.v4_negative_prompt = buildV4Prompt(finalNegative, true);
    } else {
        payload.parameters.sm = smea !== undefined ? smea : defaults.sm;
        payload.parameters.sm_dyn = dyn !== undefined ? dyn : defaults.sm_dyn;
    }

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
        throw new Error('No image in ZIP');
    } catch (error) {
        if (error.response?.status === 500 && model.startsWith('nai-diffusion-4')) {
            console.error('V4 model 500 error, retrying with simplified params');
            delete payload.parameters.v4_prompt;
            delete payload.parameters.v4_negative_prompt;
            
            const retryResponse = await axios.post(NAI_API_BASE + '/ai/generate-image', payload, {
                headers: {
                    'Authorization': 'Bearer ' + NAI_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'application/zip'
                },
                responseType: 'arraybuffer',
                timeout: 60000
            });
            
            const JSZip = require('jszip');
            const zip = await JSZip.loadAsync(retryResponse.data);
            const files = Object.keys(zip.files);
            const imageFile = files.find(f => f.endsWith('.png'));
            
            if (imageFile) {
                const imageData = await zip.files[imageFile].async('nodebuffer');
                return { buffer: imageData, seed: actualSeed };
            }
        }
        throw error;
    }
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'nai') return;

    await interaction.deferReply();

    try {
        const prompt = interaction.options.getString('prompt');
        const model = interaction.options.getString('model') || 'nai-diffusion-3';
        const negative = interaction.options.getString('negative');
        const sizePreset = interaction.options.getString('size');
        const customWidth = interaction.options.getInteger('width');
        const customHeight = interaction.options.getInteger('height');
        const steps = interaction.options.getInteger('steps');
        const cfg = interaction.options.getNumber('cfg');
        const sampler = interaction.options.getString('sampler');
        const seed = interaction.options.getInteger('seed') || -1;
        const smea = interaction.options.getBoolean('smea');
        const dyn = interaction.options.getBoolean('dyn');

        let width = 512, height = 768;
        if (customWidth && customHeight) {
            width = customWidth;
            height = customHeight;
        } else if (sizePreset && SIZE_PRESETS[sizePreset]) {
            width = SIZE_PRESETS[sizePreset].width;
            height = SIZE_PRESETS[sizePreset].height;
        }

        if (width * height > SIZE_LIMITS.maxPixels || width > SIZE_LIMITS.maxWidth || height > SIZE_LIMITS.maxHeight) {
            await interaction.editReply('❌ 尺寸超限！最大832×1216');
            return;
        }

        const result = await generateImage({
            prompt, negative_prompt: negative, model,
            width, height, steps, cfg, sampler, seed, smea, dyn
        });

        const attachment = new AttachmentBuilder(result.buffer, { 
            name: 'nai_' + result.seed + '.png' 
        });

        const info = '✨ 生成完成\n' +
                    '📏 ' + width + '×' + height + '\n' +
                    '🤖 ' + (MODELS[model] || model) + '\n' +
                    '🌱 种子: ' + result.seed;

        await interaction.editReply({ content: info, files: [attachment] });

    } catch (error) {
        let msg = '❌ 生成失败\n';
        if (error.response?.status === 400) msg += '参数错误';
        else if (error.response?.status === 401) msg += 'API密钥无效';
        else if (error.response?.status === 402) msg += 'Anlas不足';
        else if (error.response?.status === 500) msg += '服务器错误，请尝试V3模型';
        else msg += error.message || '未知错误';
        await interaction.editReply(msg);
    }
});

client.once('clientReady', () => {
    console.log('Bot ready:', client.user.tag);
    deployCommands();
});

client.on('error', e => console.error(e));
process.on('unhandledRejection', e => console.error(e));

client.login(DISCORD_TOKEN).catch(e => {
    console.error('Login failed:', e.message);
    process.exit(1);
});

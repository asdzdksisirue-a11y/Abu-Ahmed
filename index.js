const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const play = require('play-dl');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const VOICE_CHANNEL_ID = '1529174493753508062';
const player = createAudioPlayer();
let currentConnection = null;

const commands = [
    new SlashCommandBuilder()
        .setName('شغل')
        .setDescription('تشغيل أغنية أو طرب بالاسم أو الرابط')
        .addStringOption(option =>
            option.setName('اسم')
                .setDescription('اكتب اسم الأغنية أو رابط يوتيوب / ساوند كلاود')
                .setRequired(true)),
    new SlashCommandBuilder().setName('وقف').setDescription('إيقاف مؤقت'),
    new SlashCommandBuilder().setName('كمل').setDescription('استئناف التشغيل'),
    new SlashCommandBuilder().setName('إيقاف').setDescription('إيقاف نهائي')
].map(command => command.toJSON());

async function connectToVoiceChannel(guild) {
    const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
    if (!channel || !channel.isVoiceBased()) return;

    try {
        currentConnection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
        });

        currentConnection.subscribe(player);
    } catch (error) {
        console.error('فشل الاتصال بالروم:', error);
    }
}

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (error) {
        console.error(error);
    }

    const guild = client.guilds.cache.first();
    if (guild) connectToVoiceChannel(guild);
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, guild } = interaction;
    if (!guild) return;

    if (!currentConnection) {
        await connectToVoiceChannel(guild);
    }

    if (commandName === 'شغل') {
        const query = interaction.options.getString('اسم');
        await interaction.deferReply();
        
        try {
            let targetUrl = query;

            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                const searchResults = await play.search(query, { limit: 1 });
                if (!searchResults || searchResults.length === 0) {
                    return interaction.editReply('❌ ما حصلت شي بهذا الاسم، جرب اسم ثاني.');
                }
                targetUrl = searchResults[0].url;
            }

            let streamData;
            if (targetUrl.includes('soundcloud.com')) {
                streamData = await play.stream_soundcloud(targetUrl);
            } else {
                streamData = await play.stream(targetUrl);
            }

            const resource = createAudioResource(streamData.stream, { inputType: streamData.type });
            player.play(resource);
            
            await interaction.editReply(`🎶 سم طال عمرك، شغال الحين: **${query}**`);
        } catch (error) {
            console.error('خطأ التشغيل:', error);
            await interaction.editReply('⚠️ عذراً، صار خطأ بجلب المقطع، جرب رابط مباشر أو اسم أوضح.');
        }
    } else if (commandName === 'وقف') {
        player.pause();
        await interaction.reply({ content: '⏸️ تم الإيقاف المؤقت', ephemeral: true });
    } else if (commandName === 'كمل') {
        player.unpause();
        await interaction.reply({ content: '▶️ تم استئناف التشغيل', ephemeral: true });
    } else if (commandName === 'إيقاف') {
        player.stop();
        await interaction.reply({ content: '⏹️ تم إيقاف الصوت نهائياً', ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);

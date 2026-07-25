const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const yts = require('yt-search');
const ytdl = require('@distube/ytdl-core');

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
        .setDescription('تشغيل أغنية بالاسم أو الرابط')
        .addStringOption(option =>
            option.setName('اسم')
                .setDescription('اكتب اسم الأغنية أو الرابط')
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

        currentConnection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await entersState(currentConnection, VoiceConnectionStatus.Ready, 5_000);
            } catch (error) {
                currentConnection.destroy();
                setTimeout(() => connectToVoiceChannel(guild), 2000);
            }
        });
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

    if (!currentConnection || currentConnection.state.status === VoiceConnectionStatus.Disconnected) {
        await connectToVoiceChannel(guild);
    }

    if (commandName === 'شغل') {
        const query = interaction.options.getString('اسم');
        
        // منع انهيار الرد لو أخذ وقتاً طويلاً
        try {
            await interaction.deferReply();
        } catch (e) {
            console.error('Defer error:', e);
            return;
        }

        try {
            let videoUrl = query;

            // البحث إذا لم يكن رابطاً مباشراً
            if (!query.includes('http://') && !query.includes('https://')) {
                const searchResult = await yts(query);
                if (!searchResult || !searchResult.videos || searchResult.videos.length === 0) {
                    return interaction.editReply('❌ ما حصلت شي بهذا الاسم، جرب اسم ثاني.');
                }
                videoUrl = searchResult.videos[0].url;
            }

            const stream = ytdl(videoUrl, { filter: 'audioonly', highWaterMark: 1 << 25 });
            const resource = createAudioResource(stream);
            player.play(resource);
            
            await interaction.editReply(`🎶 شغال الحين: **${query}**`);
        } catch (error) {
            console.error('خطأ أثناء تشغيل الصوت:', error);
            // معالجة الخطأ بأمان وإبلاغ المستخدم بدون ما يطفى البوت
            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply('⚠️ صار فيه خطأ تقني أو تعذر جلب المقطع، حاول مرة ثانية.');
                }
            } catch (innerError) {
                console.error('فشل إرسال رسالة الخطأ:', innerError);
            }
        }
    } else if (commandName === 'وقف') {
        try {
            player.pause();
            await interaction.reply({ content: '⏸️ تم الإيقاف المؤقت', ephemeral: true });
        } catch (e) { console.error(e); }
    } else if (commandName === 'كمل') {
        try {
            player.unpause();
            await interaction.reply({ content: '▶️ تم استئناف التشغيل', ephemeral: true });
        } catch (e) { console.error(e); }
    } else if (commandName === 'إيقاف') {
        try {
            player.stop();
            await interaction.reply({ content: '⏹️ تم إيقاف الصوت نهائياً', ephemeral: true });
        } catch (e) { console.error(e); }
    }
});

client.login(process.env.DISCORD_TOKEN);

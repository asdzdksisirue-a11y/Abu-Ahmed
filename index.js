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

// آيدي الروم الصوتي المحدد اللي يثبت فيه البوت
const VOICE_CHANNEL_ID = '1529174493753508062';
const player = createAudioPlayer();
let currentConnection = null;

// تجهيز أوامر السلاش (/)
const commands = [
    new SlashCommandBuilder()
        .setName('شغل')
        .setDescription('تشغيل أغنية بالاسم من يوتيوب')
        .addStringOption(option =>
            option.setName('اسم')
                .setDescription('اكتب اسم الأغنية')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('وقف')
        .setDescription('إيقاف مؤقت للأغنية'),
    new SlashCommandBuilder()
        .setName('كمل')
        .setDescription('استئناف تشغيل الأغنية'),
    new SlashCommandBuilder()
        .setName('إيقاف')
        .setDescription('إيقاف التشغيل نهائياً')
].map(command => command.toJSON());

// دالة لتثبيت البوت وإبقائه داخل الروم الصوتي دائماً
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

        console.log('تم تثبيت البوت في الروم الصوتي بنجاح!');
    } catch (error) {
        console.error('فشل في الاتصال بالروم الصوتي:', error);
    }
}

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // تسجيل أوامر السلاش في ديسكورد
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('تم تسجيل أوامر السلاش بنجاح!');
    } catch (error) {
        console.error(error);
    }

    const guild = client.guilds.cache.first();
    if (guild) {
        connectToVoiceChannel(guild);
    }
});

// التعامل مع أوامر السلاش (/)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const guild = interaction.guild;
    if (!guild) return;

    // التأكد من اتصال البوت بالروم الثابت
    if (!currentConnection || currentConnection.state.status === VoiceConnectionStatus.Disconnected) {
        await connectToVoiceChannel(guild);
    }

    if (commandName === 'شغل') {
        const query = interaction.options.getString('اسم');
        try {
            await interaction.reply(`🔍 جاري البحث والتشغيل في الروم الثابت: **${query}**`);
            
            const searchResults = await play.search(query, { limit: 1 });
            if (!searchResults || searchResults.length === 0) {
                return interaction.editReply('ما حصلت شي بهذا الاسم!');
            }

            const videoUrl = searchResults[0].url;
            const stream = await play.stream(videoUrl);
            const resource = createAudioResource(stream.stream, { inputType: stream.type });

            player.play(resource);

        } catch (error) {
            console.error(error);
            await interaction.editReply('صار فيه مشكلة أثناء تشغيل الأغنية.');
        }
    } 
    
    else if (commandName === 'وقف') {
        player.pause();
        await interaction.reply({ content: '⏸️ تم إيقاف الأغنية مؤقتاً.', ephemeral: true });
    } 
    
    else if (commandName === 'كمل') {
        player.unpause();
        await interaction.reply({ content: '▶️ تم استئناف تشغيل الأغنية.', ephemeral: true });
    } 
    
    else if (commandName === 'إيقاف') {
        player.stop();
        await interaction.reply({ content: '⏹️ تم إيقاف الصوت نهائياً.', ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);

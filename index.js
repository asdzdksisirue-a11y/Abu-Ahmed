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
        .setDescription('تشغيل أغنية بالاسم أو الرابط')
        .addStringOption(option =>
            option.setName('اسم')
                .setDescription('اكتب اسم الأغنية أو رابط يوتيوب')
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

        console.log('تم تثبيت البوت في الروم الصوتي بنجاح!');
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
        await interaction.reply(`🔍 جاري التشغيل: **${query}**`);
        try {
            let videoUrl = query;
            if (!query.startsWith('http')) {
                const searchResults = await play.search(query, { limit: 1 });
                if (!searchResults || searchResults.length === 0) {
                    return interaction.editReply('ما حصلت شي بهذا الاسم!');
                }
                videoUrl = searchResults[0].url;
            }

            const stream = await play.stream(videoUrl);
            const resource = createAudioResource(stream.stream, { inputType: stream.type });
            player.play(resource);
            await interaction.editReply(`🎶 شغال الحين: **${query}**`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('صار فيه مشكلة أثناء التشغيل. تأكد من الرابط أو جرب رابط يوتيوب مباشر.');
        }
    } else if (commandName === 'وقف') {
        player.pause();
        await interaction.reply({ content: '⏸️ مؤقت', ephemeral: true });
    } else if (commandName === 'كمل') {
        player.unpause();
        await interaction.reply({ content: '▶️ كملنا', ephemeral: true });
    } else if (commandName === 'إيقاف') {
        player.stop();
        await interaction.reply({ content: '⏹️ وقفت الصوت', ephemeral: true });
    }
});

client.login(process.env.DISCORD_TOKEN);

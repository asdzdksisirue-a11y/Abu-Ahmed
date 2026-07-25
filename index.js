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
        .setDescription('تشغيل أغنية من سبوتيفاي بالاسم أو الرابط')
        .addStringOption(option =>
            option.setName('اسم')
                .setDescription('اكتب اسم الأغنية أو رابط سبوتيفاي')
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
        await interaction.deferReply();
        try {
            let trackInfo = query;
            
            // إذا كان رابط سبوتيفاي
            if (query.includes('spotify.com')) {
                const spotifyData = await play.spotify(query);
                const searchResults = await play.search(`${spotifyData.name} ${spotifyData.artists[0].name}`, { limit: 1 });
                if (!searchResults || searchResults.length === 0) {
                    return interaction.editReply('ما قدرت ألقى الأغنية من سبوتيفاي.');
                }
                trackInfo = searchResults[0].url;
            } else {
                // بحث عادي بالاسم ويجيبها
                const searchResults = await play.search(query, { limit: 1 });
                if (!searchResults || searchResults.length === 0) {
                    return interaction.editReply('ما حصلت شي بهذا الاسم!');
                }
                trackInfo = searchResults[0].url;
            }

            const streamData = await play.stream(trackInfo);
            const resource = createAudioResource(streamData.stream, { inputType: streamData.type });
            player.play(resource);
            
            await interaction.editReply(`🎶 شغال الحين من سبوتيفاي: **${query}**`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('صار فيه مشكلة أثناء التشغيل، جرب اسم ثاني.');
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

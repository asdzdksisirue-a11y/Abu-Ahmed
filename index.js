const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    createAudioPlayer,
} = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const player = createAudioPlayer();

// آيدي الروم الصوتي الخاص بك
const VOICE_CHANNEL_ID = '1529174493753508062';

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const channel = guild.channels.cache.get(VOICE_CHANNEL_ID);
        if (channel && channel.isVoiceBased()) {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 20 * 1000);
            connection.subscribe(player);
            console.log(`تم دخول البوت إلى الروم الصوتي بنجاح!`);
        } else {
            console.log('لم يتم العثور على الروم الصوتي، تأكد من الآيدي أو صلاحيات البوت!');
        }
    } catch (error) {
        console.error('فشل في الاتصال التلقائي بالروم الصوتي:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);

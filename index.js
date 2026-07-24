const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const TARGET_VOICE_CHANNEL_NAME = '⚡┃قصر الحاكم';

function joinSpecificVoiceChannel(guild) {
    const voiceChannel = guild.channels.cache.find(
        (channel) => channel.name === TARGET_VOICE_CHANNEL_NAME && channel.isVoiceBased()
    );

    if (!voiceChannel) {
        return null;
    }

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000)
            ]);
        } catch (error) {
            console.log(`⚠️ انقطع الاتصال في السيرفر: ${guild.name}، جارٍ محاولة إعادة الاتصال...`);

            connection.destroy();

            const newConnection = joinSpecificVoiceChannel(guild);
            if (newConnection) {
                console.log(`🔄 تمت إعادة الاتصال بقناة "${TARGET_VOICE_CHANNEL_NAME}" في السيرفر: ${guild.name}`);
            }
        }
    });

    connection.on('error', (error) => {
        console.error(`❌ خطأ في الاتصال الصوتي في السيرفر: ${guild.name}`, error);
    });

    return connection;
}

client.once('ready', () => {
    console.log(`✅ البوت شغال بنجاح باسم: ${client.user.tag}`);

    client.guilds.cache.forEach((guild) => {
        const connection = joinSpecificVoiceChannel(guild);
        if (connection) {
            console.log(`🔊 تم الاتصال بقناة "${TARGET_VOICE_CHANNEL_NAME}" في السيرفر: ${guild.name} والبقاء متصلاً بشكل دائم.`);
        } else {
            console.log(`❌ لم يتم العثور على قناة صوتية باسم "${TARGET_VOICE_CHANNEL_NAME}" في السيرفر: ${guild.name}`);
        }
    });
});

client.login(process.env.DISCORD_TOKEN);

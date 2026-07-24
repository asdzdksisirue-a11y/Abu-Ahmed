const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

function joinGeneralChannel(guild) {
    const voiceChannel = guild.channels.cache.find(
        (channel) => channel.name === 'General' && channel.isVoiceBased()
    );

    if (!voiceChannel) {
        return null;
    }

    return joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator
    });
}

client.once('ready', () => {
    console.log(`✅ البوت شغال بنجاح باسم: ${client.user.tag}`);

    client.guilds.cache.forEach((guild) => {
        const connection = joinGeneralChannel(guild);
        if (connection) {
            console.log(`🔊 تم الانضمام لقناة صوتية "General" في السيرفر: ${guild.name}`);
        }
    });
});

client.on('messageCreate', (message) => {
    if (message.author.bot || !message.guild) {
        return;
    }

    if (message.content === '!join') {
        const connection = joinGeneralChannel(message.guild);

        if (connection) {
            message.reply('✅ تم الانضمام لقناة "General" الصوتية.');
        } else {
            message.reply('❌ لم يتم العثور على قناة صوتية باسم "General".');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

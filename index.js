const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
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

// آيدي الروم الصوتي حقك اللي يثبت فيه البوت
const VOICE_CHANNEL_ID = '1529174493753508062';

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // دخول البوت تلقائياً للروم الصوتي أول ما يشتغل
    try {
        const guild = client.guilds.cache.first();
        if (guild) {
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
            }
        }
    } catch (error) {
        console.error('فشل في الاتصال التلقائي بالروم الصوتي:', error);
    }
});

// نظام الأوامر (مثل أمر التشغيل والأغاني)
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('شغل')) {
        const args = message.content.split(' ');
        const query = args.slice(1).join(' ');

        const channel = message.member?.voice.channel || client.guilds.cache.first()?.channels.cache.get(VOICE_CHANNEL_ID);
        if (!channel) {
            return message.reply('يا ليت تدخل روم صوتي أو تتأكد من روم البوت!');
        }

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 20 * 1000);
            connection.subscribe(player);
            
            message.reply(`ابشر يا مجيد، جاري تشغيل الطلب: ${query || 'بدون عنوان'}`);
        } catch (error) {
            console.error(error);
            message.reply('صار فيه مشكلة في تشغيل الصوت، تأكد من الرابط أو الأذونات.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);

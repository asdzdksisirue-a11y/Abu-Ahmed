const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    VoiceConnectionStatus,
    entersState,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType,
    getVoiceConnection
} = require('@discordjs/voice');
const play = require('play-dl');
process.env.FFMPEG_PATH = require('ffmpeg-static');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const TARGET_VOICE_CHANNEL_NAME = '⚡┃قصر الحاكم';

// خريطة لتخزين قائمة التشغيل (الطابور) لكل سيرفر
// كل عنصر: { guildId: { queue: [{ title, url }], player: AudioPlayer, connection, playing: bool } }
const guildQueues = new Map();

function getGuildQueue(guildId) {
    if (!guildQueues.has(guildId)) {
        guildQueues.set(guildId, {
            queue: [],
            player: createAudioPlayer(),
            connection: null,
            playing: false
        });
    }
    return guildQueues.get(guildId);
}

async function playNext(guild) {
    const guildData = getGuildQueue(guild.id);

    if (guildData.queue.length === 0) {
        guildData.playing = false;
        return;
    }

    const connection = guildData.connection || getVoiceConnection(guild.id);
    if (!connection) {
        guildData.playing = false;
        return;
    }

    const track = guildData.queue[0];

    try {
        const streamInfo = await play.stream(track.url);
        const resource = createAudioResource(streamInfo.stream, {
            inputType: StreamType.Opus,
            inlineVolume: true
        });

        connection.subscribe(guildData.player);
        guildData.player.play(resource);
        guildData.playing = true;
    } catch (error) {
        console.error(`❌ خطأ أثناء تشغيل المقطع: ${track.url}`, error);
        guildData.queue.shift();
        playNext(guild);
    }
}

async function playCommand(message, query) {
    if (!query) {
        message.reply('⚠️ الرجاء إدخال رابط أو اسم الأغنية بعد الأمر.');
        return;
    }

    const guild = message.guild;
    let connection = getVoiceConnection(guild.id);

    if (!connection) {
        const voiceChannel = guild.channels.cache.find(
            (channel) => channel.name === TARGET_VOICE_CHANNEL_NAME && channel.isVoiceBased()
        );

        if (!voiceChannel) {
            message.reply(`❌ لم يتم العثور على قناة صوتية باسم "${TARGET_VOICE_CHANNEL_NAME}".`);
            return;
        }

        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator
        });
    }

    const guildData = getGuildQueue(guild.id);
    guildData.connection = connection;
    connection.subscribe(guildData.player);

    setupPlayerListeners(guild);

    let url = query.trim();
    let title = url;

    try {
        if (play.yt_validate(url) !== 'video' && !url.startsWith('http')) {
            const results = await play.search(url, { limit: 1 });
            if (!results || results.length === 0) {
                message.reply('❌ لم يتم العثور على نتائج لهذا البحث.');
                return;
            }
            url = results[0].url;
            title = results[0].title;
        } else if (play.yt_validate(url) === 'video') {
            const info = await play.video_info(url);
            title = info.video_details.title;
        }
    } catch (error) {
        console.error('❌ خطأ أثناء البحث عن المقطع:', error);
        message.reply('❌ حدث خطأ أثناء البحث عن المقطع. تأكد من صحة الرابط أو اسم الأغنية.');
        return;
    }

    guildData.queue.push({ title, url });

    if (!guildData.playing) {
        await playNext(guild);
        message.reply(`🎶 جارٍ تشغيل: **${title}**`);
    } else {
        message.reply(`➕ تمت إضافة **${title}** إلى قائمة الانتظار.`);
    }
}

function setupPlayerListeners(guild) {
    const guildData = getGuildQueue(guild.id);

    if (guildData.player.listenerCount(AudioPlayerStatus.Idle) > 0) {
        return;
    }

    guildData.player.on(AudioPlayerStatus.Idle, () => {
        guildData.queue.shift();

        if (guildData.queue.length > 0) {
            playNext(guild);
        } else {
            guildData.playing = false;
        }
    });

    guildData.player.on('error', (error) => {
        console.error(`❌ خطأ في مشغل الصوت في السيرفر: ${guild.name}`, error);
        guildData.queue.shift();
        if (guildData.queue.length > 0) {
            playNext(guild);
        } else {
            guildData.playing = false;
        }
    });
}

function skipCommand(message) {
    const guildData = guildQueues.get(message.guild.id);

    if (!guildData || guildData.queue.length === 0 || !guildData.playing) {
        message.reply('⚠️ لا يوجد أي مقطع قيد التشغيل حالياً.');
        return;
    }

    message.reply('⏭️ تم تخطي المقطع الحالي.');
    guildData.player.stop();
}

function stopCommand(message) {
    const guildData = guildQueues.get(message.guild.id);

    if (!guildData || (!guildData.playing && guildData.queue.length === 0)) {
        message.reply('⚠️ لا يوجد تشغيل حالياً لإيقافه.');
        return;
    }

    guildData.queue = [];
    guildData.playing = false;
    guildData.player.stop();

    message.reply('⏹️ تم إيقاف التشغيل ومسح قائمة الانتظار.');
}

function showQueueCommand(message) {
    const guildData = guildQueues.get(message.guild.id);

    if (!guildData || guildData.queue.length === 0) {
        message.reply('📭 قائمة الانتظار فارغة حالياً.');
        return;
    }

    const list = guildData.queue
        .map((track, index) => `${index === 0 ? '▶️' : `${index}.`} ${track.title}`)
        .join('\n');

    message.reply(`🎵 **قائمة الانتظار الحالية:**\n${list}`);
}

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

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) {
        return;
    }

    const content = message.content.trim();

    if (content.startsWith('شغل ') || content.startsWith('تشغيل ')) {
        const query = content.startsWith('شغل ')
            ? content.slice('شغل '.length).trim()
            : content.slice('تشغيل '.length).trim();

        await playCommand(message, query);
    } else if (content === 'تخطي') {
        skipCommand(message);
    } else if (content === 'ايقاف') {
        stopCommand(message);
    } else if (content === 'قائمة') {
        showQueueCommand(message);
    }
});

client.login(process.env.DISCORD_TOKEN);


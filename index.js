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
// كل عنصر: { guildId: { queue: [{ title, url, artist, duration, thumbnail }], player: AudioPlayer, connection, playing: bool } }
const guildQueues = new Map();

/**
 * Initialize Spotify authentication using environment variables
 */
async function initSpotify() {
    const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
    const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const spotifyRefreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

    if (spotifyClientId && spotifyClientSecret && spotifyRefreshToken) {
        try {
            play.setToken({
                spotify: {
                    client_id: spotifyClientId,
                    client_secret: spotifyClientSecret,
                    refresh_token: spotifyRefreshToken,
                    market: 'US' // Can be changed to user's market
                }
            });
            console.log('✅ تم إعداد مصادقة Spotify بنجاح');
            return true;
        } catch (error) {
            console.error('⚠️ خطأ في إعداد Spotify:', error.message);
            console.log('💡 ستعمل الوظائف الأخرى بشكل طبيعي بدون مصادقة Spotify');
            return false;
        }
    } else {
        console.log('⚠️ لم يتم توفير بيانات اعتماد Spotify. الميزات الاختيارية قد تكون محدودة.');
        console.log('💡 لتفعيل مصادقة Spotify، أضف هذه المتغيرات:');
        console.log('   - SPOTIFY_CLIENT_ID');
        console.log('   - SPOTIFY_CLIENT_SECRET');
        console.log('   - SPOTIFY_REFRESH_TOKEN');
        return false;
    }
}

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

/**
 * Resolve a query (URL or search term) to get YouTube URL and track info
 * Supports: YouTube URLs, Spotify URLs, and search queries
 */
async function resolveTrackInfo(query) {
    try {
        const trimmedQuery = query.trim();

        // Check if it's a YouTube URL
        if (play.yt_validate(trimmedQuery) === 'video') {
            const info = await play.video_info(trimmedQuery);
            return {
                url: trimmedQuery,
                title: info.video_details.title,
                artist: info.video_details.channel.name,
                duration: info.video_details.durationInSec ? formatDuration(info.video_details.durationInSec) : 'Unknown',
                thumbnail: info.video_details.thumbnails?.length > 0 ? info.video_details.thumbnails[0].url : null
            };
        }

        // Check if it's a Spotify URL
        if (trimmedQuery.includes('spotify.com')) {
            const spotifyInfo = await play.spotify(trimmedQuery);
            
            if (spotifyInfo?.type === 'track') {
                // Search YouTube for the Spotify track
                const searchQuery = `${spotifyInfo.name} ${spotifyInfo.artists?.map(a => a.name).join(' ')}`;
                const results = await play.search(searchQuery, { limit: 1 });
                
                if (results && results.length > 0) {
                    return {
                        url: results[0].url,
                        title: spotifyInfo.name,
                        artist: spotifyInfo.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
                        duration: spotifyInfo.durationMs ? formatDuration(Math.floor(spotifyInfo.durationMs / 1000)) : 'Unknown',
                        thumbnail: spotifyInfo.thumbnail?.url || null
                    };
                }
            } else if (spotifyInfo?.type === 'playlist') {
                // For playlists, return info about the playlist
                return {
                    url: null,
                    title: spotifyInfo.name,
                    artist: spotifyInfo.owner?.display_name || 'Spotify Playlist',
                    duration: `${spotifyInfo.tracks?.length || 0} tracks`,
                    thumbnail: spotifyInfo.thumbnail?.url || null,
                    isPlaylist: true,
                    tracks: spotifyInfo.tracks
                };
            }
        }

        // Default: treat as search query
        const results = await play.search(trimmedQuery, { limit: 1 });
        
        if (!results || results.length === 0) {
            return null;
        }

        const video = results[0];
        return {
            url: video.url,
            title: video.title,
            artist: video.channel?.name || 'Unknown Artist',
            duration: video.durationInSec ? formatDuration(video.durationInSec) : 'Unknown',
            thumbnail: video.thumbnails?.length > 0 ? video.thumbnails[0].url : null
        };
    } catch (error) {
        console.error('❌ خطأ في استخراج معلومات المقطع:', error);
        return null;
    }
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
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

    const loadingMsg = await message.reply('🔍 جارٍ البحث والتحضير...');

    try {
        const trackInfo = await resolveTrackInfo(query);

        if (!trackInfo) {
            await loadingMsg.edit('❌ لم يتم العثور على نتائج لهذا البحث.');
            return;
        }

        // Handle Spotify playlists
        if (trackInfo.isPlaylist && trackInfo.tracks) {
            let addedCount = 0;
            for (const spotifyTrack of trackInfo.tracks.slice(0, 50)) {
                // Limit to first 50 tracks
                const searchQuery = `${spotifyTrack.name} ${spotifyTrack.artists?.map(a => a.name).join(' ')}`;
                const results = await play.search(searchQuery, { limit: 1 });

                if (results && results.length > 0) {
                    guildData.queue.push({
                        title: spotifyTrack.name,
                        url: results[0].url,
                        artist: spotifyTrack.artists?.map(a => a.name).join(', ') || 'Unknown',
                        duration: spotifyTrack.durationMs ? formatDuration(Math.floor(spotifyTrack.durationMs / 1000)) : 'Unknown',
                        thumbnail: spotifyTrack.thumbnail?.url || null
                    });
                    addedCount++;
                }
            }

            if (!guildData.playing) {
                await playNext(guild);
                await loadingMsg.edit(
                    `📋 تمت إضافة **${trackInfo.title}** (${addedCount} أغنية)\n🎵 جارٍ تشغيل الأولى...`
                );
            } else {
                await loadingMsg.edit(`📋 تمت إضافة ${addedCount} أغنية من **${trackInfo.title}** إلى قائمة الانتظار.`);
            }
            return;
        }

        // Handle single tracks
        guildData.queue.push(trackInfo);

        if (!guildData.playing) {
            await playNext(guild);
            await loadingMsg.edit(
                `🎵 جارٍ التشغيل: **${trackInfo.title}**\n👤 الفنان: ${trackInfo.artist}\n⏱️ المدة: ${trackInfo.duration}`
            );
        } else {
            await loadingMsg.edit(
                `➕ تمت الإضافة: **${trackInfo.title}**\n👤 الفنان: ${trackInfo.artist}\n⏱️ المدة: ${trackInfo.duration}`
            );
        }
    } catch (error) {
        console.error('❌ خطأ في أمر التشغيل:', error);
        await loadingMsg.edit('❌ حدث خطأ أثناء البحث عن المقطع. تأكد من صحة الرابط أو اسم الأغنية.');
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

    const skipped = guildData.queue[0];
    message.reply(`⏭️ تم تخطي: **${skipped.title}**`);
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
        .map((track, index) => {
            const marker = index === 0 ? '▶️ **الآن**' : `**${index}.**`;
            return `${marker} ${track.title}\n   👤 ${track.artist} | ⏱️ ${track.duration}`;
        })
        .join('\n');

    message.reply(`🎵 **قائمة الانتظار (${guildData.queue.length} أغنية):**\n${list}`);
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

client.once('ready', async () => {
    console.log(`✅ البوت شغال بنجاح باسم: ${client.user.tag}`);

    // Initialize Spotify authentication
    await initSpotify();

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


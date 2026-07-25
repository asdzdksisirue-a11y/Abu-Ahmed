const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// إعداد DisTube للبحث والتشغيل من يوتيوب
const distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    plugins: [new YtDlpPlugin()]
});

// آيدي الروم الصوتي حقك اللي يثبت فيه البوت
const VOICE_CHANNEL_ID = '1529174493753508062';

// تجهيز أوامر السلاش (تشغيل، إيقاف، استئناف، إنهاء، مستوى الصوت)
const commands = [
    new SlashCommandBuilder()
        .setName('شغل')
        .setDescription('تشغيل أغنية بالاسم أو الرابط')
        .addStringOption(option =>
            option.setName('البحث')
                .setDescription('اكتب اسم الأغنية أو الرابط')
                .setRequired(true)),
    new SlashCommandBuilder()
        .setName('وقف')
        .setDescription('إيقاف مؤقت للأغنية'),
    new SlashCommandBuilder()
        .setName('كمل')
        .setDescription('استئناف تشغيل الأغنية'),
    new SlashCommandBuilder()
        .setName('إيقاف')
        .setDescription('إيقاف الأغنية نهائياً وإخراج البوت أو مسح القائمة'),
    new SlashCommandBuilder()
        .setName('صوت')
        .setDescription('تغيير مستوى صوت البوت')
        .addIntegerOption(option =>
            option.setName('القيمة')
                .setDescription('اختر مستوى الصوت من 1 إلى 100')
                .setRequired(true))
].map(command => command.toJSON());

client.on('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    // تسجيل أوامر السلاش في ديسكورد تلقائياً
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
                console.log(`تم دخول البوت إلى الروم الصوتي بنجاح!`);
            }
        }
    } catch (error) {
        console.error('فشل في الاتصال التلقائي بالروم الصوتي:', error);
    }
});

// التفاعل مع أوامر السلاش (/)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    const voiceChannel = interaction.member?.voice.channel || interaction.guild?.channels.cache.get(VOICE_CHANNEL_ID);

    if (commandName === 'شغل') {
        const query = interaction.options.getString('البحث');
        if (!voiceChannel) {
            return interaction.reply({ content: 'يا ليت تدخل روم صوتي أول!', ephemeral: true });
        }

        try {
            await interaction.reply(`🔍 جاري البحث والتشغيل: **${query}**`);
            await distube.play(voiceChannel, query, {
                textChannel: interaction.channel,
                member: interaction.member,
            });
        } catch (error) {
            console.error(error);
            await interaction.editReply('صار فيه مشكلة في تشغيل الأغنية، تأكد من الاسم.');
        }
    } 
    
    else if (commandName === 'وقف') {
        try {
            const queue = distube.getQueue(interaction.guild.id);
            if (!queue) return interaction.reply({ content: 'ما فيه شي شغال حالياً!', ephemeral: true });
            queue.pause();
            await interaction.reply('⏸️ تم إيقاف الأغنية مؤقتاً.');
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'حدث خطأ أثناء إيقاف الأغنية.', ephemeral: true });
        }
    } 
    
    else if (commandName === 'كمل') {
        try {
            const queue = distube.getQueue(interaction.guild.id);
            if (!queue) return interaction.reply({ content: 'ما فيه شي متوقف حالياً!', ephemeral: true });
            queue.resume();
            await interaction.reply('▶️ تم استئناف تشغيل الأغنية.');
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'حدث خطأ أثناء استئناف الأغنية.', ephemeral: true });
        }
    } 
    
    else if (commandName === 'إيقاف') {
        try {
            const queue = distube.getQueue(interaction.guild.id);
            if (!queue) return interaction.reply({ content: 'ما فيه شي شغال أساساً!', ephemeral: true });
            queue.stop();
            await interaction.reply('⏹️ تم إيقاف الصوت.');
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'حدث خطأ أثناء الإيقاف.', ephemeral: true });
        }
    } 
    
    else if (commandName === 'صوت') {
        const volume = interaction.options.getInteger('القيمة');
        try {
            const queue = distube.getQueue(interaction.guild.id);
            if (!queue) return interaction.reply({ content: 'البوت مو قاعد يشغل شي حالياً عشان تغير صوته!', ephemeral: true });
            
            if (volume < 0 || volume > 100) {
                return interaction.reply({ content: 'اختر قيمة الصوت بين 1 و 100 فقط!', ephemeral: true });
            }

            queue.setVolume(volume);
            await interaction.reply(`🔊 تم ضبط مستوى الصوت على: **${volume}%**`);
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'حدث خطأ أثناء تغيير مستوى الصوت.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
